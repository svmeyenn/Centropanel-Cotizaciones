"use client";

import { useState, useTransition } from "react";
import { importe } from "@/lib/formato";
import { marcarPreferente, quitarPreferente } from "@/app/proveedores/acciones";

export interface ProveedorDeItem {
  // Id del item en la maestra del proveedor.
  id: number;
  id_proveedor: number;
  proveedor: string;
  costo: number;
  // null = la moneda del mercado.
  moneda: string | null;
  activo: boolean;
  preferente: boolean;
}

// Los proveedores de un insumo o producto, con un check para elegir cual es el preferente
// --el que define su costo--. Es el mismo check que hay en la maestra de cada proveedor.
export default function ProveedoresDelItem({
  proveedores,
  monedaMercado,
  onCostoCambiado,
}: {
  proveedores: ProveedorDeItem[];
  monedaMercado: string;
  // El costo del insumo cambio porque se eligio otro preferente.
  onCostoCambiado?: (costo: number) => void;
}) {
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  function alternar(p: ProveedorDeItem) {
    setMensaje(null);
    empezar(async () => {
      if (p.preferente) {
        const r = await quitarPreferente(p.id, p.id_proveedor);
        if (r?.error) setMensaje({ ok: false, texto: r.error });
        else
          setMensaje({
            ok: true,
            texto: "Se quito la marca. El costo queda como estaba hasta que se marque otro proveedor.",
          });
      } else {
        const r = await marcarPreferente(p.id, p.id_proveedor);
        if (r?.error) setMensaje({ ok: false, texto: r.error });
        else {
          onCostoCambiado?.(Number(r.costo));
          setMensaje({
            ok: true,
            texto: `${p.proveedor} es ahora el preferente (${importe(r.costo, monedaMercado)}). Se recostearon ${r.paneles} paneles y ${r.cotizaciones} lineas de cotizaciones sin pedido; los pedidos no se tocaron.`,
          });
        }
      }
    });
  }

  return (
    <div className="border border-gray-200 rounded">
      <div className="bg-crema px-3 py-1.5 text-xs font-semibold text-dorado-osc">
        PROVEEDORES Y PROVEEDOR PREFERENTE
      </div>
      {proveedores.length === 0 ? (
        <p className="px-3 py-2 text-xs text-gray-500">
          Ningun proveedor lo tiene en su maestra: el costo se escribe a mano.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-3 py-1 w-24">Preferente</th>
              <th className="px-3 py-1">Proveedor</th>
              <th className="px-3 py-1 text-right">Costo</th>
              <th className="px-3 py-1">Estado</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => {
              const sinCosto = !(p.costo > 0);
              return (
                <tr key={p.id} className={`border-t border-gray-100 ${sinCosto ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-1">
                    <input
                      type="checkbox"
                      checked={p.preferente}
                      disabled={pendiente || (!p.preferente && (sinCosto || !p.activo))}
                      onChange={() => alternar(p)}
                      title={
                        sinCosto
                          ? "Asigne el costo de este proveedor para poder elegirlo"
                          : p.preferente
                            ? "Quitar la marca de preferente"
                            : "Usar el costo de este proveedor"
                      }
                      aria-label={`${p.proveedor} es el proveedor preferente`}
                    />
                  </td>
                  <td className="px-3 py-1">{p.proveedor}</td>
                  <td className="px-3 py-1 text-right">
                    {sinCosto ? (
                      <span className="inline-block bg-amber-200 text-amber-900 font-semibold px-1.5 py-0.5 rounded">
                        Falta costo
                      </span>
                    ) : (
                      importe(p.costo, p.moneda ?? monedaMercado)
                    )}
                  </td>
                  <td className="px-3 py-1">
                    {p.activo ? (
                      <span className="text-green-700">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {mensaje && (
        <p className={`px-3 py-1.5 text-xs font-semibold ${mensaje.ok ? "text-green-700" : "text-red-700"}`}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
