import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import PanelRendiciones from "@/components/finanzas/PanelRendiciones";
import {
  cargarCuentaRendidores,
  cargarMaestros,
  cargarRendiciones,
  type FiltroRendicion,
} from "@/lib/finanzas/consultas";
import { etiquetaInterlocutor } from "@/lib/finanzas/tipos";
import { pesos } from "@/lib/formato";
import { puedeVerRuta } from "@/lib/menu";
import { contextoMercado, requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Lo que alguien gasto de su bolsillo --o con un anticipo-- y viene a cobrar.
// Dos permisos abren esta pantalla: quien rinde ve las suyas, quien paga las
// ve todas. Quien recorta de verdad es la base.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<FiltroRendicion>;
}) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/rendiciones")) redirect("/");

  const filtro = await searchParams;
  const { idPaisActivo } = await contextoMercado(v);

  const [{ interlocutores }, rendiciones] = await Promise.all([
    cargarMaestros(idPaisActivo),
    cargarRendiciones(filtro, idPaisActivo),
  ]);

  // La cuenta corriente de cada persona solo le interesa a quien paga.
  const cuentas = v.fin_pagar_gastos
    ? (await cargarCuentaRendidores(idPaisActivo)).filter(
        (c) => Number(c.saldo) !== 0
      )
    : [];

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Rendiciones de gastos"
        subtitulo="Boletas pagadas de su bolsillo o con un anticipo"
      />

      <div className="p-6 space-y-4">
        <BarraNavegacion />

        <PanelRendiciones
          rendiciones={rendiciones}
          interlocutores={interlocutores}
          puedePagar={v.fin_pagar_gastos}
        />

        {v.fin_pagar_gastos && (
          <section className="space-y-2 pt-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-dorado-osc">
              Cuenta corriente por persona
            </h2>

            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-verde text-white">
                    <tr>
                      <th className="text-left px-3 py-2 w-[28%]">Persona</th>
                      <th className="text-right px-3 py-2 w-[16%]">
                        Anticipos
                      </th>
                      <th className="text-right px-3 py-2 hidden md:table-cell w-[16%]">
                        Reintegros
                      </th>
                      <th className="text-right px-3 py-2 w-[16%]">Rendido</th>
                      <th className="text-left px-3 py-2 w-[24%]">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center text-gray-400 py-8"
                        >
                          Nadie tiene saldo pendiente.
                        </td>
                      </tr>
                    )}

                    {cuentas.map((c) => {
                      const saldo = Number(c.saldo);
                      return (
                        <tr
                          key={c.id_interlocutor}
                          className="border-t border-gray-100 hover:bg-crema"
                        >
                          <td className="px-3 py-2 truncate">
                            {etiquetaInterlocutor(
                              c.razon_social,
                              c.nombre_referencia
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {pesos(c.anticipos_entregados)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                            {pesos(c.reintegros_pagados)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {pesos(c.rendido_aprobado)}
                          </td>
                          <td
                            className={`px-3 py-2 ${
                              saldo > 0 ? "text-red-700" : "text-gray-700"
                            }`}
                          >
                            {saldo > 0
                              ? `Tiene ${pesos(saldo)} sin rendir`
                              : `Se le deben ${pesos(Math.abs(saldo))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              Saldo positivo: esa persona tiene plata de la empresa que todavia
              no rinde. Negativo: la empresa le debe.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
