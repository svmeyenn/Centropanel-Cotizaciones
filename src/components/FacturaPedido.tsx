"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos, fecha as fmtFecha, hoyISO } from "@/lib/formato";
import { facturarPedido, anularFactura } from "@/app/pedidos/acciones";

export interface FacturaVista {
  id: number;
  numero: string;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  quien: string | null;
}

// Ultima etapa del pedido. Registra la factura; no la emite: el documento
// tributario sale del sistema de facturacion electronica y aqui se guarda su
// numero para dejar amarrados pedido y factura.
export default function FacturaPedido({
  idPedido,
  factura,
  total,
  saldo,
  puedeCrear,
  esAdmin,
}: {
  idPedido: number;
  factura: FacturaVista | null;
  total: number;
  saldo: number;
  puedeCrear: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
        FACTURACION
      </div>

      <div className="p-3 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
            {error}
          </div>
        )}

        {factura ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Dato titulo="Factura" valor={factura.numero} destacado />
              <Dato titulo="Fecha" valor={fmtFecha(factura.fecha)} />
              <Dato titulo="Neto" valor={pesos(factura.neto)} />
              <Dato titulo="Total" valor={pesos(factura.total)} />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-xs text-gray-500">
                Pedido facturado{factura.quien ? ` por ${factura.quien}` : ""}.
                {saldo > 0
                  ? ` Queda un saldo por cobrar de ${pesos(saldo)}.`
                  : " Sin saldo pendiente."}
              </span>
              {esAdmin && (
                <button
                  onClick={() =>
                    empezar(async () => {
                      setError(null);
                      const r = await anularFactura(factura.id, idPedido);
                      if (r?.error) setError(r.error);
                      else router.refresh();
                    })
                  }
                  className="text-red-600 text-xs underline ml-auto"
                  title="Devuelve el pedido a Despachado para poder volver a facturarlo"
                >
                  anular factura
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-600">
              Ultima etapa del pedido. Se registra el numero de la factura ya
              emitida en el sistema de facturacion electronica; aqui no se emite
              el documento tributario.
            </p>

            {saldo > 0 && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
                Este pedido tiene un saldo por cobrar de{" "}
                <strong>{pesos(saldo)}</strong>. Se puede facturar igual, pero
                conviene revisarlo antes.
              </div>
            )}

            {puedeCrear &&
              (abierto ? (
                <div className="bg-crema border border-dorado rounded p-3 space-y-2">
                  <div className="grid md:grid-cols-3 gap-2">
                    <label className="text-xs">
                      <span className="block text-dorado-osc font-semibold mb-1">
                        N de factura
                      </span>
                      <input
                        className={input}
                        autoFocus
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      <span className="block text-dorado-osc font-semibold mb-1">
                        Fecha
                      </span>
                      <input
                        type="date"
                        className={input}
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                      />
                    </label>
                    <div className="text-xs self-end pb-1 text-gray-600">
                      Se factura por {pesos(total)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        empezar(async () => {
                          setError(null);
                          const r = await facturarPedido(idPedido, numero, fecha);
                          if (r?.error) {
                            setError(r.error);
                            return;
                          }
                          setAbierto(false);
                          router.refresh();
                        })
                      }
                      disabled={pendiente || !numero.trim()}
                      className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                    >
                      {pendiente ? "Facturando..." : "Facturar pedido"}
                    </button>
                    <button
                      onClick={() => setAbierto(false)}
                      className="border border-gray-300 text-gray-700 text-xs px-2.5 py-1 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setError(null);
                    setNumero("");
                    setFecha(hoyISO());
                    setAbierto(true);
                  }}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded"
                >
                  Facturar pedido
                </button>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function Dato({
  titulo,
  valor,
  destacado,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className={`rounded p-3 ${destacado ? "bg-crema" : "bg-gray-50"}`}>
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className={`font-bold ${destacado ? "text-verde" : "text-gray-800"}`}>
        {valor}
      </div>
    </div>
  );
}
