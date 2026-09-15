import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorFormasPago from "@/components/GestorFormasPago";
import GestorMediosPago from "@/components/GestorMediosPago";
import PestanasPais from "@/components/PestanasPais";
import { contextoMercado, paisAdministrado, requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string }>;
}) {
  const v = await requerirVendedor();
  // Cada mercado tiene sus condiciones y medios de pago, con sus comisiones.
  const ctx = await contextoMercado(v);
  const pais = paisAdministrado(ctx, (await searchParams).pais);
  if (!pais) redirect("/");

  const supabase = await createClient();
  const [{ data: formas }, { data: medios }] = await Promise.all([
    supabase.from("formas_pago").select("*").eq("id_pais", pais.id).order("orden"),
    supabase.from("medios_pago").select("*").eq("id_pais", pais.id).order("orden"),
  ]);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Formas de pago"
        subtitulo={`Condiciones de pago y medios con que paga el cliente en ${pais.nombre}`}
      />
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <PestanasPais
          paises={ctx.activo ? [] : ctx.accesibles}
          elegido={pais}
          ruta="/formas-pago"
        />
        <GestorFormasPago
          key={`f${pais.id}`}
          idPais={pais.id}
          formas={formas ?? []}
          esAdmin={v.rol === "Administrador"}
        />
        <GestorMediosPago
          key={`m${pais.id}`}
          idPais={pais.id}
          medios={(medios ?? []).map((m) => ({
            id: Number(m.id),
            nombre: m.nombre as string,
            comision_pct: Number(m.comision_pct),
            activo: Boolean(m.activo),
            id_pais: Number(m.id_pais),
          }))}
          esAdmin={v.rol === "Administrador"}
        />
      </div>
    </div>
  );
}
