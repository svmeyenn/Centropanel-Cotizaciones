import { notFound, redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PestanasRRHH from "@/components/rrhh/PestanasRRHH";
import FichaPersonal from "@/components/rrhh/FichaPersonal";
import { nivelRRHH } from "@/lib/rrhh";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import type { Pais } from "@/types/database";
import { etiquetaProyecto } from "@/lib/finanzas/tipos";

export const metadata = { title: "Ficha de personal" };
export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  const v = await requerirVendedor();
  if (!nivelRRHH(v, "ver")) redirect("/");
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("rrhh_personal")
    .select("*, entidades(razon_social, rut, email, telefono, direccion)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const idPais = Number(p.id_pais);

  const desde12 = new Date();
  desde12.setMonth(desde12.getMonth() - 12);
  const [ctx, contratos, imputaciones, centros, proyectos, recurrentes, conceptos, novedades, anticipos, liquidaciones, instituciones] = await Promise.all([
    contextoMercado(v),
    supabase.from("rrhh_contratos").select("*").eq("id_personal", id).order("fecha_inicio", { ascending: false }),
    supabase.from("rrhh_imputaciones").select("id_centro_costo, id_proyecto, porcentaje").eq("id_personal", id).order("id"),
    supabase.from("centros_costo").select("id, codigo, nombre, unidades_negocio!inner(id_pais)").eq("unidades_negocio.id_pais", idPais).eq("activo", true).order("codigo"),
    supabase.from("proyectos").select("id_proyecto, nombre, cliente, num_pedido").eq("id_pais", idPais).eq("activo", true).eq("borrado", false).order("nombre"),
    supabase.from("rrhh_items_recurrentes").select("*").eq("id_personal", id).order("id"),
    supabase.from("rrhh_conceptos").select("id, codigo, nombre, tipo, imponible, sistema").eq("activo", true).in("tipo", ["Haber", "Descuento"]).order("orden"),
    supabase.from("rrhh_novedades").select("*").eq("id_personal", id).gte("periodo", desde12.toISOString().slice(0, 7) + "-01").order("periodo", { ascending: false }),
    supabase.from("rrhh_anticipos").select("*").eq("id_personal", id).order("id", { ascending: false }),
    supabase.from("rrhh_liquidaciones").select("id, periodo, tipo, estado, liquido, moneda").eq("id_personal", id).order("periodo", { ascending: false }).limit(24),
    supabase.from("rrhh_instituciones").select("id, tipo, nombre").eq("id_pais", idPais).eq("activo", true).order("nombre"),
  ]);

  const ent = (Array.isArray(p.entidades) ? p.entidades[0] : p.entidades) as {
    razon_social: string;
    rut: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
  } | null;
  const pais = ctx.accesibles.find((x: Pais) => x.id === idPais) ?? ctx.accesibles[0];

  return (
    <div className="min-h-screen">
      <Cabecera titulo={ent?.razon_social ?? "Ficha de personal"} subtitulo={[p.cargo, ent?.rut].filter(Boolean).join(" · ")} />
      <div className="max-w-[120rem] mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasRRHH activa="/rrhh" administra={nivelRRHH(v, "administrar")} />
        <FichaPersonal
          persona={{
            id,
            id_entidad: Number(p.id_entidad),
            id_pais: idPais,
            razon_social: ent?.razon_social ?? "",
            rut: ent?.rut ?? "",
            email: ent?.email ?? "",
            telefono: ent?.telefono ?? "",
            direccion: ent?.direccion ?? "",
            relacion: p.relacion as string,
            clase: (p.clase as string | null) ?? "Administrativo",
            cargo: (p.cargo as string | null) ?? "",
            oficio: (p.oficio as string | null) ?? "",
            fecha_ingreso: (p.fecha_ingreso as string | null) ?? "",
            fecha_termino: (p.fecha_termino as string | null) ?? "",
            estado: p.estado as string,
            fecha_nacimiento: (p.fecha_nacimiento as string | null) ?? "",
            nacionalidad: (p.nacionalidad as string | null) ?? "",
            cargas_familiares: Number(p.cargas_familiares ?? 0),
            contacto_emergencia: (p.contacto_emergencia as string | null) ?? "",
            telefono_emergencia: (p.telefono_emergencia as string | null) ?? "",
            banco: (p.banco as string | null) ?? "",
            tipo_cuenta: (p.tipo_cuenta as string | null) ?? "",
            numero_cuenta: (p.numero_cuenta as string | null) ?? "",
            notas: (p.notas as string | null) ?? "",
          }}
          pais={pais}
          contratos={(contratos.data ?? []) as never[]}
          imputaciones={(imputaciones.data ?? []).map((i) => ({ id_centro_costo: Number(i.id_centro_costo), id_proyecto: i.id_proyecto != null ? Number(i.id_proyecto) : null, porcentaje: Number(i.porcentaje) }))}
          centros={(centros.data ?? []).map((c) => ({ id: Number(c.id), texto: `${c.codigo} · ${c.nombre}` }))}
          proyectos={(proyectos.data ?? []).map((x) => ({ id: Number(x.id_proyecto), texto: etiquetaProyecto(x as { nombre: string; num_pedido?: string | null; cliente?: string | null }) }))}
          recurrentes={(recurrentes.data ?? []) as never[]}
          conceptos={(conceptos.data ?? []) as never[]}
          novedades={(novedades.data ?? []) as never[]}
          anticipos={(anticipos.data ?? []) as never[]}
          liquidaciones={(liquidaciones.data ?? []) as never[]}
          instituciones={(instituciones.data ?? []) as never[]}
          puedeOperar={nivelRRHH(v, "operar")}
        />
      </div>
    </div>
  );
}
