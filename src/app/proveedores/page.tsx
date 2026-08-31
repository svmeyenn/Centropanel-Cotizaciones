import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorProveedores from "@/components/GestorProveedores";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Proveedores y su maestra. Es pantalla de administracion: los costos de
// compra viven aqui, igual que en materias primas.
export default async function Pagina() {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") redirect("/");

  const supabase = await createClient();
  const [{ data: proveedores }, { data: items }] = await Promise.all([
    supabase.from("proveedores").select("*").order("razon_social"),
    supabase.from("proveedor_items").select("id_proveedor"),
  ]);

  // Cuantos items tiene cada maestra: un proveedor con cero no recibe ninguna
  // solicitud, y eso conviene verlo desde el listado.
  const cuenta = new Map<number, number>();
  for (const it of items ?? []) {
    const k = Number(it.id_proveedor);
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }

  const filas = (proveedores ?? []).map((p) => ({
    id: Number(p.id),
    razon_social: p.razon_social as string,
    rut: p.rut as string | null,
    contacto: p.contacto as string | null,
    email: p.email as string | null,
    telefono: p.telefono as string | null,
    direccion: p.direccion as string | null,
    activo: Boolean(p.activo),
    items: cuenta.get(Number(p.id)) ?? 0,
  }));

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Proveedores"
        subtitulo="Cada proveedor con su maestra de productos y sus costos"
      />
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorProveedores proveedores={filas} />
      </div>
    </div>
  );
}
