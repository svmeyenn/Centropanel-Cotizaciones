import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import DepurarLeads, { type GrupoCaduco } from "@/components/DepurarLeads";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { puedeEscribirLeads } from "@/lib/leads";
import { aplicarFiltrosLeads } from "@/lib/filtrosLeads";
import { DIAS_POR_DEFECTO, REGLAS, filtroDeRegla, type ClaveCaducidad } from "@/lib/caducidad";

export const metadata = { title: "Depurar leads" };

// Depuracion de la cartera: los leads que quedaron atras, agrupados por la
// razon por la que quedaron atras. Cuenta con el mismo filtro con que la lista
// despues los muestra, asi que las dos pantallas nunca dicen cosas distintas.
export default async function Depurar() {
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { idPaisActivo, activo } = await contextoMercado(v);

  // Los plazos del mercado que se esta mirando. Sin mercado activo --cuando se
  // ven los dos juntos-- se usan los de referencia.
  const { data: params } = await conPais(
    supabase.from("parametros").select("clave, valor_num"),
    idPaisActivo
  ).in("clave", Object.keys(DIAS_POR_DEFECTO));
  const guardado = new Map((params ?? []).map((p) => [String(p.clave), Number(p.valor_num)]));
  const diasDe = (clave: ClaveCaducidad) => {
    const n = guardado.get(clave);
    return n != null && Number.isFinite(n) ? n : DIAS_POR_DEFECTO[clave];
  };

  // Un conteo por regla, todos a la vez.
  const grupos: GrupoCaduco[] = await Promise.all(
    REGLAS.map(async (r) => {
      const dias = diasDe(r.clave);
      const { count } = await aplicarFiltrosLeads(
        conPais(
          supabase.from("v_leads").select("id_clientify", { count: "exact", head: true }),
          idPaisActivo
        ),
        filtroDeRegla(r, dias)
      );
      return { ...r, dias, n: count ?? 0 };
    })
  );
  const total = grupos.reduce((a, g) => a + g.n, 0);

  return (
    <div className="min-h-screen">
      <Cabecera titulo="DEPURAR LEADS" subtitulo="Lo que quedo atras, y que hacer con cada grupo" />
      <div className="max-w-screen-lg mx-auto p-4 space-y-3">
        <BarraNavegacion />

        <div className="bg-white border border-gray-200 rounded px-3 py-2 text-[11px] space-y-1">
          <p>
            <b className="text-sm">{total.toLocaleString("es-CL")}</b> leads quedaron atras segun
            los plazos de {activo ? activo.nombre : "referencia"}. Un lead que nunca contesto o que
            nadie toco en meses infla la cartera y ensucia la conversion.
          </p>
          <p className="text-gray-600">
            Los plazos se editan aqui y se guardan por mercado. Nada se borra: el lead cambia de
            estado, queda en su historial y se puede volver atras desde su ficha.
          </p>
          <p className="text-dorado-osc">
            El CRM es el origen de los leads. Haga el mismo cambio en Clientify, o la proxima
            importacion volvera a traer el estado antiguo para los leads que no se hayan corregido
            a mano aqui.
          </p>
          {!activo && (
            <p className="text-gray-600">
              Esta viendo los dos mercados juntos. Elija uno en la cabecera para usar sus plazos y
              poder guardarlos.
            </p>
          )}
        </div>

        <DepurarLeads
          grupos={grupos}
          puedeEditar={puedeEscribirLeads(v)}
          puedeGuardarPlazos={tienePerfilAdmin(v) && activo != null}
          mercado={activo?.nombre ?? ""}
        />

        <p className="text-[11px] text-gray-600">
          <Link href="/leads" className="text-verde underline">
            Volver a la lista de leads
          </Link>
        </p>
      </div>
    </div>
  );
}
