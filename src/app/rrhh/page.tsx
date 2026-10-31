import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasRRHH from "@/components/rrhh/PestanasRRHH";
import ListadoPersonal, { type FilaPersonal } from "@/components/rrhh/ListadoPersonal";
import { puedeVerRuta } from "@/lib/menu";
import { nivelRRHH } from "@/lib/rrhh";
import { conPais, contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Personal" };
export const dynamic = "force-dynamic";

// El personal de Centro Panel, el de oficina y el de obra, a contrato o a honorarios.
// Datos sensibles: la base solo los entrega a quien tiene permiso en Recursos humanos.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rrhh") || !nivelRRHH(v, "ver")) redirect("/");

  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);
  const [{ data: personal }, { data: contratos }, { data: imputaciones }] = await Promise.all([
    conPais(
      supabase.from("rrhh_personal").select("id, id_pais, relacion, clase, cargo, estado, fecha_ingreso, entidades(razon_social, rut)"),
      idPaisActivo
    ),
    supabase.from("rrhh_contratos").select("id_personal, tipo, sueldo_base, monto_honorario, moneda").eq("estado", "Vigente"),
    supabase.from("rrhh_imputaciones").select("id_personal"),
  ]);

  const contrato = new Map((contratos ?? []).map((c) => [Number(c.id_personal), c]));
  const conCentro = new Set((imputaciones ?? []).map((i) => Number(i.id_personal)));

  const filas: FilaPersonal[] = (personal ?? [])
    .map((p) => {
      const ent = (Array.isArray(p.entidades) ? p.entidades[0] : p.entidades) as { razon_social: string; rut: string | null } | null;
      const c = contrato.get(Number(p.id));
      return {
        id: Number(p.id),
        nombre: ent?.razon_social ?? "(sin nombre)",
        rut: ent?.rut ?? null,
        id_pais: Number(p.id_pais),
        relacion: p.relacion as string,
        clase: (p.clase as string | null) ?? "",
        cargo: p.cargo as string | null,
        estado: p.estado as string,
        contrato: c ? (c.tipo as string) : null,
        monto: c ? Number(c.tipo === "Honorarios" ? c.monto_honorario : c.sueldo_base) : null,
        moneda: c ? ((c.moneda as string | null) ?? null) : null,
        conCentro: conCentro.has(Number(p.id)),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="min-h-screen">
      <Cabecera titulo="Personal" subtitulo="Trabajadores a contrato y a honorarios, de oficina y de obra" />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasRRHH activa="/rrhh" administra={nivelRRHH(v, "administrar")} />
        <ListadoPersonal filas={filas} paises={paises} esAdminGeneral={esAdminGeneral} puedeOperar={nivelRRHH(v, "operar")} />
      </div>
    </div>
  );
}
