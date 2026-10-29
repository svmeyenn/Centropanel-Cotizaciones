"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import { asignarMaestraProveedor, excluirItemsProveedor, incluirItemsManual } from "@/app/necesidades/acciones";

export interface ItemExcluible {
  id: number;
  sku: string | null;
  descripcion: string;
  unidad: string | null;
  cantidad: number;
  // Lo tiene asignado en su maestra (excluido o no).
  asignado: boolean;
  excluido: boolean;
  // No lo tiene en su maestra pero se incluyo a mano: sale sin precio.
  forzado: boolean;
  // Ya cotizo este item: no se puede sacar.
  cotizado: boolean;
}

const BTN = "border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";
const BTN_VERDE = "bg-verde text-white text-[11px] font-semibold px-2 py-0.5 rounded disabled:opacity-40";

// Quita de la solicitud de un proveedor todos sus items o solo algunos: el documento que se le envia lleva lo que queda.
export default function ExcluirItemsProveedor({ idNm, idPart, proveedor, folio, items }: { idNm: number; idPart: number; proveedor: string; folio: string; items: ItemExcluible[] }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const modificables = items.filter((i) => !i.cotizado);
  const estaIncluido = (i: ItemExcluible) => (i.asignado ? !i.excluido : i.forzado);
  const [incluidos, setIncluidos] = useState<Set<number>>(() => new Set(items.filter(estaIncluido).map((i) => i.id)));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const excluidos = items.filter((i) => i.asignado && i.excluido).length;
  const manuales = items.filter((i) => !i.asignado && i.forzado).length;

  function abrir() {
    setIncluidos(new Set(items.filter(estaIncluido).map((i) => i.id)));
    setError(null);
    setAbierta(true);
  }

  // Deja el item en la maestra del proveedor; los cambios de la ventana que aun no se guardan se conservan al volver.
  function agregarMaestra(idItem: number) {
    setError(null);
    empezar(async () => {
      const r = await asignarMaestraProveedor(idNm, idPart, [idItem]);
      if (!r.ok) return setError(r.error ?? "No se pudo agregar.");
      setAbierta(false);
      router.refresh();
    });
  }

  function guardar() {
    const cambia = modificables.filter((i) => estaIncluido(i) !== incluidos.has(i.id));
    const ids = (f: (i: ItemExcluible) => boolean) => cambia.filter(f).map((i) => i.id);
    const pasos: [number[], boolean, boolean][] = [
      [ids((i) => i.asignado && !incluidos.has(i.id)), true, true], // excluir un item de su maestra
      [ids((i) => i.asignado && incluidos.has(i.id)), false, true], // volver a incluirlo
      [ids((i) => !i.asignado && incluidos.has(i.id)), true, false], // incluir a mano uno que no tiene
      [ids((i) => !i.asignado && !incluidos.has(i.id)), false, false], // dejar de incluirlo
    ];
    if (pasos.every(([x]) => x.length === 0)) return setAbierta(false);
    setError(null);
    empezar(async () => {
      for (const [x, accion, deMaestra] of pasos) {
        if (x.length === 0) continue;
        const r = deMaestra ? await excluirItemsProveedor(idNm, idPart, x, accion) : await incluirItemsManual(idNm, idPart, x, accion);
        if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      }
      setAbierta(false);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className={BTN} onClick={abrir}>
        {excluidos + manuales > 0 ? `Items (${[excluidos ? `${excluidos} excluido${excluidos === 1 ? "" : "s"}` : "", manuales ? `${manuales} a mano` : ""].filter(Boolean).join(", ")})` : "Items"}
      </button>
      {abierta && (
        <Ventana titulo={`Items de ${proveedor}`} subtitulo={`${folio}: lo que se desmarca no sale en su solicitud; lo que no tiene en su maestra se puede marcar y sale sin precio`} onCerrar={() => setAbierta(false)} ancho="max-w-3xl">
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={BTN} disabled={pendiente} onClick={() => setIncluidos(new Set(items.map((i) => i.id)))}>
                Incluir todos
              </button>
              <button type="button" className={BTN} disabled={pendiente} onClick={() => setIncluidos(new Set(items.filter((i) => i.cotizado).map((i) => i.id)))}>
                Sacar de la solicitud
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded">
              <table className="w-full">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="w-8 px-2 py-1.5" />
                    <th className="text-left px-2 py-1.5">Item</th>
                    <th className="text-right px-2 py-1.5 w-28">Cantidad</th>
                    <th className="text-left px-2 py-1.5 w-44">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const fijo = i.cotizado;
                    return (
                      <tr key={i.id} className="border-t border-gray-100">
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            aria-label={`Incluir ${i.descripcion}`}
                            disabled={fijo || pendiente}
                            checked={incluidos.has(i.id)}
                            onChange={(e) => {
                              const n = new Set(incluidos);
                              if (e.target.checked) n.add(i.id);
                              else n.delete(i.id);
                              setIncluidos(n);
                            }}
                          />
                        </td>
                        <td className="px-2 py-1">{i.sku && <span className="font-mono text-[10px] text-gray-500 mr-1.5">{i.sku}</span>}{i.descripcion}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{Number(i.cantidad).toLocaleString("es-CL")} {i.unidad ?? ""}</td>
                        <td className="px-2 py-1 text-gray-600">
                          {i.cotizado ? "ya cotizado" : incluidos.has(i.id) ? (i.asignado ? "va en la solicitud" : <span className="text-amber-700">va sin precio: no esta en su maestra</span>) : i.asignado ? <span className="text-red-700">no va en la solicitud</span> : <span className="italic text-gray-400">no lo tiene en su maestra</span>}
                          {!i.asignado && !i.cotizado && (
                            <button type="button" className="ml-2 text-verde underline disabled:opacity-40" disabled={pendiente} onClick={() => agregarMaestra(i.id)}>
                              Agregar a su maestra
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {error && <p className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN} disabled={pendiente} onClick={() => setAbierta(false)}>Cancelar</button>
              <button type="button" className={BTN_VERDE} disabled={pendiente} onClick={guardar}>{pendiente ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </Ventana>
      )}
    </>
  );
}
