import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import MaestraProveedor, {
  type Candidato,
  type ItemMaestra,
} from "@/components/MaestraProveedor";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") redirect("/");

  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [{ data: prov }, { data: items }, { data: materias }, { data: productos }] =
    await Promise.all([
      supabase.from("proveedores").select("*").eq("id", id).single(),
      supabase
        .from("proveedor_items")
        .select(
          "id, codigo, costo, activo, id_materia_prima, id_producto, materias_primas(nombre, tipo), productos(descripcion, familia)"
        )
        .eq("id_proveedor", id),
      supabase
        .from("materias_primas")
        .select("id, nombre, tipo")
        .eq("activo", true)
        .order("tipo")
        .order("nombre"),
      // Los paneles no se compran: se fabrican con las materias primas de
      // arriba. A un proveedor solo se le pide lo que efectivamente vende.
      supabase
        .from("productos")
        .select("id, descripcion, familia")
        .eq("activo", true)
        .neq("tipo", "Panel SIP")
        .neq("familia", "Servicios")
        .order("familia")
        .order("descripcion"),
    ]);

  if (!prov) notFound();

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  const filas: ItemMaestra[] = (items ?? []).map((it) => {
    const mp = uno<{ nombre: string; tipo: string }>(it.materias_primas);
    const pr = uno<{ descripcion: string; familia: string | null }>(it.productos);
    return {
      id: Number(it.id),
      descripcion: mp?.nombre ?? pr?.descripcion ?? "",
      grupo: mp ? `Materia prima - ${mp.tipo}` : (pr?.familia ?? "Productos"),
      codigo: it.codigo as string | null,
      costo: Number(it.costo),
      activo: Boolean(it.activo),
    };
  });

  const yaEsta = new Set(
    (items ?? []).map((it) =>
      it.id_materia_prima ? `mp:${it.id_materia_prima}` : `prod:${it.id_producto}`
    )
  );

  const candidatos: Candidato[] = [
    ...(materias ?? []).map((m) => ({
      clave: `mp:${m.id}`,
      etiqueta: m.nombre as string,
      grupo: `Materia prima - ${m.tipo}`,
    })),
    ...(productos ?? []).map((p) => ({
      clave: `prod:${p.id}`,
      etiqueta: p.descripcion as string,
      grupo: (p.familia as string | null) ?? "Productos",
    })),
  ].filter((c) => !yaEsta.has(c.clave));

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={prov.razon_social as string}
        subtitulo="Maestra del proveedor: que vende y a que costo"
      />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion volverA="/proveedores">
          <Link
            href="/proveedores"
            className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded hover:bg-white"
          >
            Todos los proveedores
          </Link>
        </BarraNavegacion>

        <div className="bg-white border border-gray-200 rounded p-4 text-sm grid md:grid-cols-4 gap-3">
          <Dato titulo="RUT" valor={(prov.rut as string) ?? "--"} />
          <Dato titulo="Contacto" valor={(prov.contacto as string) ?? "--"} />
          <Dato titulo="Correo" valor={(prov.email as string) ?? "--"} />
          <Dato titulo="Telefono" valor={(prov.telefono as string) ?? "--"} />
        </div>

        <MaestraProveedor
          idProveedor={id}
          items={filas}
          candidatos={candidatos}
        />
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="font-semibold text-gray-800">{valor}</div>
    </div>
  );
}
