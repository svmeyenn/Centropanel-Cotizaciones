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
  tipo: string;
  numero: string;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  quien: string | null;
  archivo: string | null;
  archivo_nombre: string | null;
}

const ACEPTA = ".pdf,.jpg,.jpeg,.png,.webp";
const NOTA = "Nota de credito";

// Facturacion del pedido. No emite el documento tributario --eso sale del
// sistema de facturacion electronica-- sino que registra el que ya se emitio,
// para dejar amarrados pedido y documento.
//
// Se factura contra los depositos del cliente, asi que un pedido lleva varios:
// el anticipo, el saldo antes del despacho, y a veces una nota de credito. El
// pedido queda Facturado cuando los documentos cubren el total.
export default function FacturaPedido({
  idPedido,
  facturas,
  total,
  saldo,
  abonado,
  facturado,
  porFacturar,
  pieMonto,
  tasaIva,
  entregaEfectiva,
  puedeCrear,
  esAdmin,
}: {
  idPedido: number;
  facturas: FacturaVista[];
  total: number;
  saldo: number;
  abonado: number;
  facturado: number;
  porFacturar: number;
  pieMonto: number;
  tasaIva: number;
  // Fecha real de entrega del pedido, si ya esta anotada. Si falta se pide
  // aqui: facturar es el ultimo momento en que alguien mira este pedido.
  entregaEfectiva: string | null;
  puedeCrear: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"Factura" | typeof NOTA>("Factura");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [entrega, setEntrega] = useState("");

  const input = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
  const esNota = tipo === NOTA;

  // Lo que se factura contra lo que el cliente ya deposito: es el caso
  // corriente, y tenerlo calculado evita sacarlo a mano de dos pantallas.
  const depositadoSinFacturar = Math.max(abonado - facturado, 0);

  // Atajos que llenan el campo; el monto siempre se puede escribir a mano.
  const atajos = esNota
    ? [{ rotulo: "Todo lo facturado", valor: facturado }]
    : [
        { rotulo: "Depositado sin facturar", valor: depositadoSinFacturar },
        { rotulo: "Todo lo que falta", valor: porFacturar },
        { rotulo: "Pie del pedido", valor: pieMonto },
      ];

  const montoNum = Number(monto.replace(/\./g, "").replace(",", "."));
  const montoEfectivo =
    monto.trim() === "" ? (esNota ? 0 : porFacturar) : montoNum;
  // El monto se escribe en bruto --es lo que dice el deposito-- y la base lo
  // desglosa con la misma cuenta que se muestra aqui.
  const netoPrevio = Math.round(montoEfectivo / (1 + tasaIva));
  const ivaPrevio = montoEfectivo - netoPrevio;

  function registrar() {
    empezar(async () => {
      setError(null);
      const r = await facturarPedido(
        idPedido,
        numero,
        fecha,
        monto.trim() === "" ? null : montoNum,
        esNota ? NOTA : "Factura",
        entrega
      );
      if (r?.error) {
        setError(r.error);
        return;
      }
      if (adjunto && r.id) {
        const fd = new FormData();
        fd.append("archivo", adjunto);
        const s = await subirArchivoFactura(r.id, idPedido, fd);
        // El documento quedo grabado igual; solo se avisa que el archivo no
        // subio, para que lo reintenten desde la lista.
        if (s?.error)
          setError(`Documento grabado, pero el archivo no se pudo subir: ${s.error}`);
      }
      setAdjunto(null);
      setNumero("");
      setMonto("");
      setAbierto(false);
      router.refresh();
    });
  }

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Dato titulo="Total del pedido" valor={pesos(total)} />
          <Dato titulo="Facturado" valor={pesos(facturado)} destacado />
          <Dato titulo="Por facturar" valor={pesos(porFacturar)} />
          <Dato titulo="Depositado" valor={pesos(abonado)} />
        </div>

        {facturas.length > 0 ? (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-2 py-1.5 w-28">Documento</th>
                  <th className="text-left px-2 py-1.5 w-24">Numero</th>
                  <th className="text-left px-2 py-1.5 w-24">Fecha</th>
                  <th className="text-right px-2 py-1.5 w-28">Neto</th>
                  <th className="text-right px-2 py-1.5 w-28">Total</th>
                  <th className="text-left px-2 py-1.5">Archivo</th>
                  {esAdmin && <th className="w-20" />}
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-2 py-1.5">
                      {f.tipo === NOTA ? (
                        <span className="text-red-700 font-semibold">
                          Nota de credito
                        </span>
                      ) : (
                        <span className="text-verde font-semibold">Factura</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{f.numero}</td>
                    <td className="px-2 py-1.5 text-gray-600">
                      {fmtFecha(f.fecha)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {pesos(f.neto)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                      {pesos(f.total)}
                    </td>
                    <td className="px-2 py-1.5">
                      <ArchivoFactura
                        factura={f}
                        idPedido={idPedido}
                        puedeCrear={puedeCrear}
                        esAdmin={esAdmin}
                        pendiente={pendiente}
                        empezar={empezar}
                        setError={setError}
                      />
                    </td>
                    {esAdmin && (
                      <td className="px-2 py-1.5 text-right">
                        <button
                          onClick={() =>
                            empezar(async () => {
                              setError(null);
                              const r = await anularFactura(f.id, idPedido);
                              if (r?.error) setError(r.error);
                              else router.refresh();
                            })
                          }
                          disabled={pendiente}
                          className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded disabled:opacity-40"
                          title="Borra el documento y deja el pedido con lo que quede facturado"
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
        ) : (
          <p className="text-xs text-gray-600">
            Todavia no hay documentos. Se registra el numero del que ya se emitio
            en el sistema de facturacion electronica; aqui no se emite el
            documento tributario.
          </p>
        )}

        {porFacturar > 0 && saldo > 0 && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded p-3">
            Quedan <strong>{pesos(porFacturar)}</strong> por facturar y{" "}
            <strong>{pesos(saldo)}</strong> por cobrar.
            {depositadoSinFacturar > 0 && (
              <>
                {" "}
                El cliente ya deposito{" "}
                <strong>{pesos(depositadoSinFacturar)}</strong> sin documento.
              </>
            )}
          </div>
        )}

        {puedeCrear &&
          (abierto ? (
            <div className="bg-crema border border-dorado rounded p-3 space-y-2">
              <div className="grid md:grid-cols-4 gap-2">
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Documento
                  </span>
                  <select
                    className={input}
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value as "Factura" | typeof NOTA);
                      setMonto("");
                    }}
                  >
                    <option value="Factura">Factura</option>
                    <option value={NOTA}>Nota de credito</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Numero
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
                <label className="text-xs">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Monto total
                  </span>
                  <input
                    className={input}
                    inputMode="decimal"
                    placeholder={esNota ? "0" : pesos(porFacturar)}
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </label>
              </div>

              {/* El monto se escribe a mano; estos botones solo lo rellenan
                  con las cifras que ya calcula el pedido, que es de donde se
                  sacaba antes a pulso. */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] text-gray-600">Usar:</span>
                {atajos
                  .filter((a) => a.valor > 0)
                  .map((a) => (
                    <button
                      key={a.rotulo}
                      type="button"
                      onClick={() => setMonto(String(Math.round(a.valor)))}
                      className="border border-gray-300 bg-white text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded"
                    >
                      {a.rotulo}: {pesos(a.valor)}
                    </button>
                  ))}
              </div>

              <p className="text-[11px] text-gray-600">
                {montoEfectivo > 0 ? (
                  <>
                    {esNota ? "Se acredita" : "Se factura"}{" "}
                    <strong>{pesos(montoEfectivo)}</strong>: neto{" "}
                    {pesos(netoPrevio)} mas impuesto {pesos(ivaPrevio)}.
                    {!esNota && monto.trim() === "" && " Es todo lo que falta."}
                  </>
                ) : (
                  "Indique el monto del documento."
                )}
              </p>

              {!esNota && !entregaEfectiva && (
                <label className="text-xs block">
                  <span className="block text-dorado-osc font-semibold mb-1">
                    Fecha en que se entrego
                  </span>
                  <input
                    type="date"
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-44"
                    value={entrega}
                    onChange={(e) => setEntrega(e.target.value)}
                  />
                  <span className="block text-gray-500 mt-1">
                    El pedido todavia no la tiene anotada. Queda registrada con
                    el documento; se puede corregir en la ficha.
                  </span>
                </label>
              )}

              <label className="text-xs block">
                <span className="block text-dorado-osc font-semibold mb-1">
                  Archivo del documento (opcional)
                </span>
                <input
                  type="file"
                  accept={ACEPTA}
                  onChange={(e) => setAdjunto(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
                <span className="block text-gray-500 mt-1">
                  PDF, JPG, PNG o WEBP, hasta 10 MB. Se puede adjuntar despues.
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={registrar}
                  disabled={
                    pendiente || !numero.trim() || (esNota && montoEfectivo <= 0)
                  }
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-40"
                >
                  {pendiente ? "Registrando..." : "Registrar documento"}
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
                setTipo("Factura");
                setNumero("");
                setMonto("");
                setFecha(hoyISO());
                setAdjunto(null);
                setAbierto(true);
              }}
              className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded"
            >
              {facturas.length === 0 ? "Facturar pedido" : "Agregar documento"}
            </button>
          ))}
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

// El archivo de cada documento: subirlo, verlo o quitarlo. Vive en un bucket
// privado, asi que para abrirlo se pide un enlace firmado al momento.
function ArchivoFactura({
  factura,
  idPedido,
  puedeCrear,
  esAdmin,
  pendiente,
  empezar,
  setError,
}: {
  factura: FacturaVista;
  idPedido: number;
  puedeCrear: boolean;
  esAdmin: boolean;
  pendiente: boolean;
  empezar: (fn: () => void) => void;
  setError: (m: string | null) => void;
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);

  function subir(f: File) {
    empezar(async () => {
      setError(null);
      const fd = new FormData();
      fd.append("archivo", f);
      const r = await subirArchivoFactura(factura.id, idPedido, fd);
      if (r?.error) setError(r.error);
      else {
        setArchivo(null);
        router.refresh();
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

  if (factura.archivo) {
    return (
      <span className="flex flex-wrap gap-2 items-center">
        <button
          onClick={abrir}
          disabled={pendiente}
          className="bg-verde text-white text-xs font-semibold px-2 py-0.5 rounded disabled:opacity-40"
        >
          ver
        </button>
        <span className="text-gray-500 truncate max-w-[10rem]">
          {factura.archivo_nombre ?? "documento"}
        </span>
        {esAdmin && (
          <button
            onClick={() =>
              empezar(async () => {
                setError(null);
                const r = await quitarArchivoFactura(factura.id, idPedido);
                if (r?.error) setError(r.error);
                else router.refresh();
              })
            }
            disabled={pendiente}
            className="text-gray-600 underline"
          >
            quitar
          </button>
        )}
      </span>
    );
  }

  if (!puedeCrear) return <span className="text-gray-400">sin archivo</span>;

  return (
    <input
      type="file"
      accept={ACEPTA}
      className="text-[11px]"
      onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        setArchivo(f);
        if (f) subir(f);
      }}
      disabled={pendiente || archivo != null}
    />
  );
}
