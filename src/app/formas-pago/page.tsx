import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorFormasPago from "@/components/GestorFormasPago";
import GestorMediosPago from "@/components/GestorMediosPago";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const [{ data: formas }, { data: medios }] = await Promise.all([
    supabase.from("formas_pago").select("*").order("orden"),
    supabase.from("medios_pago").select("*").order("orden"),
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Formas de pago"
        subtitulo="Condiciones de pago y medios con que paga el cliente"
      />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorFormasPago
          formas={formas ?? []}
          esAdmin={v.rol === "Administrador"}
        />
        <GestorMediosPago
          medios={(medios ?? []).map((m) => ({
            id: Number(m.id),
            nombre: m.nombre as string,
            comision_pct: Number(m.comision_pct),
            activo: Boolean(m.activo),
          }))}
          esAdmin={v.rol === "Administrador"}
        />
      </div>
    </div>
  );
}
