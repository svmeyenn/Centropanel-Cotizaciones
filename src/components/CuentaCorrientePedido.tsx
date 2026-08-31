"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos, porcentaje, fecha as fmtFecha, hoyISO } from "@/lib/formato";
import {
  registrarPago,
  anularPago,
  type DatosPago,
} from "@/app/pedidos/acciones";

export interface Cuenta {
  total_neto: number;
  iva: number;
  total_sin_comision: number;
  comision_pct: number;
  comision_monto: number;
  total: number;
  pie_pct: number;
  pie_monto: number;
  abonado: number;
  saldo: number;
  pie_cubierto: boolean;
}

export interface PagoVista {
  id: number;
  fecha: string;
  monto: number;
  medio: string | null;
  referencia: string | null;
  quien: string | null;
}

const MEDIOS = [
  "Transferencia",
  "Efectivo",
  "Cheque",
  "Tarjeta",
  "Link de Pago",
  "Otro",
];

// Cuenta corriente del pedido: lo pactado, lo abonado y lo que falta. El pie
// no es informativo: mientras no este cubierto, el pedido no puede pedir
// insumos a los proveedores.
export default function CuentaCorrientePedido({
  idPedido,
  formaPago,
  medioPago,
  cuenta,
  pagos,
  puedeCrear,
  esAdmin,
}: {
  idPedido: number;
  formaPago: string | null;
  medioPago: string | null;
  cuenta: Cuenta;
  pagos: PagoVista[];
  puedeCrear: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState<DatosPago>({
    fecha: hoyISO(),
    monto: 0,
    medio: "Transferencia",
    referencia: "",
    notas: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const faltaPie = Math.max(cuenta.pie_monto - cuenta.abonado, 0);

  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="bg-verde text-white text-xs font-semibold px-3 py-2">
        CUENTA CORRIENTE
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Dato titulo="Total con IVA" valor={pesos(cuenta.total)} destacado />
          <Dato
            titulo={`Pie exigido (${porcentaje(cuenta.pie_pct)} %)`}
            valor={pesos(cuenta.pie_monto)}
          />
          <Dato titulo="Abonado" valor={pesos(cuenta.abonado)} />
          <Dato titulo="Saldo" valor={pesos(cuenta.saldo)} />
        </div>

        {(formaPago || medioPago) && (
          <p className="text-xs text-gray-500">
            {formaPago}
            {formaPago && medioPago ? " \u00b7 " : ""}
            {medioPago}
          </p>
        )}

        {cuenta.comision_pct > 0 && (
          <p className="text-xs text-gray-600">
            Total sin comision {pesos(cuenta.total_sin_comision)} + recargo{" "}
            {porcentaje(cuenta.comision_pct)} % ({pesos(cuenta.comision_monto)})
            = {pesos(cuenta.total)}. El recargo hace que el neto llegue completo.
          </p>
        )}

        {cuenta.pie_monto > 0 &&
          (cuenta.pie_cubierto ? (
            <div className="bg-green-50 border border-green-200 text-green-900 text-xs rounded p-3">
              <strong>Pie cubierto.</strong> El pedido ya puede pedir insumos a
              los proveedores.
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
              <strong>Falta el pie: {pesos(faltaPie)}.</strong> Hasta que se
              registre, no se generan solicitudes a proveedores: comprar antes
              seria financiar la produccion con caja propia.
            </div>
          ))}

        {cuenta.pie_monto === 0 && (
          <p className="text-xs text-gray-500">
            Esta forma de pago no exige pie, asi que se puede comprar de
            inmediato.
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3">
            {error}
          </div>
        )}

        {puedeCrear &&
          (abierto ? (
            <div className="bg-crema border border-dorado rounded p-3 space-y-2">
              <div className="text-sm font-semibold text-verde">
                Registrar pago
              </div>
              <div className="grid md:grid-cols-4 gap-2">
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Fecha
                  </span>
                  <input
                    type="date"
                    className={input}
                    value={d.fecha}
                    onChange={(e) => setD({ ...d, fecha: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Monto
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${input} text-right`}
                    value={pesos(d.monto)}
                    onChange={(e) =>
                      setD({
                        ...d,
                        monto: Number(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                  />
                  {faltaPie > 0 && (
                    <button
                      onClick={() => setD({ ...d, monto: faltaPie })}
                      className="text-[11px] text-verde underline mt-0.5"
                    >
                      usar el pie que falta ({pesos(faltaPie)})
                    </button>
                  )}
                </label>
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Medio
                  </span>
                  <select
                    className={input}
                    value={d.medio}
                    onChange={(e) => setD({ ...d, medio: e.target.value })}
                  >
                    {MEDIOS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Referencia
                  </span>
                  <input
                    className={input}
                    placeholder="N de transferencia, cheque..."
                    value={d.referencia}
                    onChange={(e) => setD({ ...d, referencia: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    empezar(async () => {
                      setError(null);
                      const r = await registrarPago(idPedido, d);
                      if (r?.error) {
                        setError(r.error);
                        return;
                      }
                      setAbierto(false);
                      setD({ ...d, monto: 0, referencia: "" });
                      router.refresh();
                    })
                  }
                  disabled={pendiente || !d.monto}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                >
                  {pendiente ? "Grabando..." : "Grabar pago"}
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
                setD({ ...d, monto: faltaPie > 0 ? faltaPie : 0 });
                setAbierto(true);
              }}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded"
            >
              Registrar pago
            </button>
          ))}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 w-28">Fecha</th>
                <th className="text-right px-3 py-2 w-32">Monto</th>
                <th className="text-left px-3 py-2">Medio</th>
                <th className="text-left px-3 py-2">Referencia</th>
                <th className="text-left px-3 py-2">Registro</th>
                {esAdmin && <th className="px-3" />}
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 && (
                <tr>
                  <td
                    colSpan={esAdmin ? 6 : 5}
                    className="text-center text-gray-400 py-6"
                  >
                    Sin pagos registrados.
                  </td>
                </tr>
              )}
              {pagos.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{fmtFecha(p.fecha)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {pesos(p.monto)}
                  </td>
                  <td className="px-3 py-2">{p.medio ?? ""}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {p.referencia ?? ""}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{p.quien ?? ""}</td>
                  {esAdmin && (
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() =>
                          empezar(async () => {
                            const r = await anularPago(p.id, idPedido);
                            if (r?.error) setError(r.error);
                            else router.refresh();
                          })
                        }
                        className="text-red-600 text-xs underline"
                      >
                        anular
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div
        className={`font-bold ${destacado ? "text-verde" : "text-gray-800"}`}
      >
        {valor}
      </div>
    </div>
  );
}
