"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pesos, fecha as fmtFecha, hoyISO } from "@/lib/formato";
import {
  facturarPedido,
  anularFactura,
  subirArchivoFactura,
  quitarArchivoFactura,
  enlaceArchivoFactura,
} from "@/app/pedidos/acciones";

export interface FacturaVista {
  id: number;
  numero: string;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  quien: string | null;
  archivo: string | null;
  archivo_nombre: string | null;
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
  const [adjunto, setAdjunto] = useState<File | null>(null);

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
                  className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ml-auto"
                  title="Devuelve el pedido a Despachado para poder volver a facturarlo"
                >
                  anular factura
                </button>
              )}
            </div>

            <ArchivoFactura
              factura={factura}
              idPedido={idPedido}
              puedeCrear={puedeCrear}
              esAdmin={esAdmin}
              adjunto={adjunto}
              setAdjunto={setAdjunto}
              pendiente={pendiente}
              empezar={empezar}
              setError={setError}
            />
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
                  <label className="text-xs block">
                    <span className="block text-dorado-osc font-semibold mb-1">
                      Archivo de la factura (opcional)
                    </span>
                    <input
                      type="file"
                      accept={ACEPTA}
                      onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                    <span className="block text-gray-500 mt-1">
                      PDF, JPG, PNG o WEBP, hasta 10 MB. Se puede adjuntar
                      despues.
                    </span>
                  </label>
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
                          if (adjunto && r.id) {
                            const fd = new FormData();
                            fd.append("archivo", adjunto);
                            const s = await subirArchivoFactura(
                              r.id,
                              idPedido,
                              fd
                            );
                            // La factura quedo grabada igual; solo se avisa que
                            // el archivo no subio para que lo reintenten.
                            if (s?.error)
                              setError(`Factura grabada, pero el archivo no se pudo subir: ${s.error}`);
                          }
                          setAdjunto(null);
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
                      className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
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
                    setAdjunto(null);
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

const ACEPTA = ".pdf,.jpg,.jpeg,.png,.webp";

// El archivo de la factura: subirlo, verlo o reemplazarlo. Se guarda en un
// bucket privado, asi que para abrirlo se pide un enlace firmado al momento.
function ArchivoFactura({
  factura,
  idPedido,
  puedeCrear,
  esAdmin,
  adjunto,
  setAdjunto,
  pendiente,
  empezar,
  setError,
}: {
  factura: FacturaVista;
  idPedido: number;
  puedeCrear: boolean;
  esAdmin: boolean;
  adjunto: File | null;
  setAdjunto: (f: File | null) => void;
  pendiente: boolean;
  empezar: (fn: () => void) => void;
  setError: (m: string | null) => void;
}) {
  function subir() {
    if (!adjunto) return;
    empezar(async () => {
      setError(null);
      const fd = new FormData();
      fd.append("archivo", adjunto);
      const r = await subirArchivoFactura(factura.id, idPedido, fd);
      if (r?.error) setError(r.error);
      else {
        setAdjunto(null);
        location.reload();
      }
    });
  }

  function abrir() {
    empezar(async () => {
      setError(null);
      const r = await enlaceArchivoFactura(factura.id);
      if (r?.error) setError(r.error);
      else if (r.url) window.open(r.url, "_blank", "noopener");
    });
  }

  return (
    <div className="border-t border-gray-200 pt-3 space-y-2">
      <div className="text-xs font-semibold text-gray-700">
        Archivo de la factura
      </div>

      {factura.archivo ? (
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-xs text-gray-700">
            {factura.archivo_nombre ?? "documento"}
          </span>
          <button
            onClick={abrir}
            disabled={pendiente}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
          >
            Ver factura
          </button>
          {esAdmin && (
            <button
              onClick={() =>
                empezar(async () => {
                  setError(null);
                  const r = await quitarArchivoFactura(factura.id, idPedido);
                  if (r?.error) setError(r.error);
                  else location.reload();
                })
              }
              disabled={pendiente}
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              quitar archivo
            </button>
          )}
        </div>
      ) : puedeCrear ? (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="file"
            accept={ACEPTA}
            onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <button
            onClick={subir}
            disabled={pendiente || !adjunto}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-40"
          >
            {pendiente ? "Subiendo..." : "Subir factura"}
          </button>
          <span className="text-xs text-gray-500">
            PDF, JPG, PNG o WEBP, hasta 10 MB.
          </span>
        </div>
      ) : (
        <span className="text-xs text-gray-500">Sin archivo adjunto.</span>
      )}
    </div>
  );
}
