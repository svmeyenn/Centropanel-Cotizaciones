"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dinero, fecha } from "@/lib/formato";
import { BUCKET_LEADS, EXTENSIONES_PROHIBIDAS, TOPE_ARCHIVO_LEAD } from "@/lib/leads";
import { nombreSeguro } from "@/lib/finanzas/almacen";
import {
  guardarProyectoCasa,
  quitarArchivoLead,
  registrarArchivoLead,
  urlArchivoLead,
} from "@/app/clientify/edicion-lead";

export interface DatosCasaGuardados {
  metros2: number | null;
  valor_uf: number | null;
  valor_clp: number | null;
  valor_usd: number | null;
  valor_pen: number | null;
}

export interface ArchivoLead {
  id: number;
  nombre: string;
  tamano: number | null;
  creado_en: string;
  id_vendedor: number;
  vendedor: string | null;
}

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";
const TITULO = "bg-verde text-white text-[10px] font-semibold px-3 py-0.5 flex justify-between";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white disabled:opacity-50";

const texto = (n: number | null) => (n == null ? "" : String(n));

const peso = (b: number | null) =>
  b == null
    ? ""
    : b >= 1024 * 1024
      ? `${(b / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`
      : `${Math.max(1, Math.round(b / 1024)).toLocaleString("es-CL")} KB`;

// Un campo numerico: el navegador lo escribe segun su idioma y entrega el numero
// con punto decimal, asi que no hay que adivinar si "1.500" son mil quinientos o
// uno coma cinco.
function Numero({
  id,
  rotulo,
  valor,
  onChange,
  paso,
  sufijo,
  deshabilitado,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  paso: string;
  sufijo?: string;
  deshabilitado: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        {rotulo}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          className={CAMPO}
          type="number"
          inputMode="decimal"
          min={0}
          step={paso}
          value={valor}
          disabled={deshabilitado}
          onChange={(e) => onChange(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
        />
        {sufijo && <span className="text-[10px] text-gray-500 whitespace-nowrap">{sufijo}</span>}
      </div>
    </div>
  );
}

export default function ProyectoCasa({
  idLead,
  codigoPais,
  casa,
  archivos,
  puedeEditar,
  esAdmin,
  yo,
}: {
  idLead: number;
  codigoPais: "CL" | "PE";
  casa: DatosCasaGuardados | null;
  archivos: ArchivoLead[];
  puedeEditar: boolean;
  esAdmin: boolean;
  yo: number;
}) {
  const router = useRouter();
  const esPeru = codigoPais === "PE";

  // --- datos del proyecto
  const [m2, setM2] = useState(texto(casa?.metros2 ?? null));
  const [uf, setUf] = useState(texto(casa?.valor_uf ?? null));
  const [clp, setClp] = useState(texto(casa?.valor_clp ?? null));
  const [usd, setUsd] = useState(texto(casa?.valor_usd ?? null));
  const [pen, setPen] = useState(texto(casa?.valor_pen ?? null));
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, guardar] = useTransition();

  const sucio =
    m2 !== texto(casa?.metros2 ?? null) ||
    uf !== texto(casa?.valor_uf ?? null) ||
    clp !== texto(casa?.valor_clp ?? null) ||
    usd !== texto(casa?.valor_usd ?? null) ||
    pen !== texto(casa?.valor_pen ?? null);

  // Valor por metro cuadrado, en la moneda principal de cada mercado.
  const metros = Number(m2);
  const principal = Number(esPeru ? usd : uf);
  const porM2 = metros > 0 && principal > 0 ? principal / metros : null;

  function enviarDatos(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    guardar(async () => {
      const r = await guardarProyectoCasa(idLead, { metros2: m2, uf, clp, usd, pen });
      setMensaje({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Guardado." : "No se pudo guardar.") });
      if (r.ok) router.refresh();
    });
  }

  // --- archivos
  const entrada = useRef<HTMLInputElement>(null);
  const [subidas, setSubidas] = useState<{ nombre: string; estado: "subiendo" | "listo" | "error"; detalle?: string }[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [, accionArchivo] = useTransition();

  async function subir(lista: File[]) {
    if (!puedeEditar || lista.length === 0) return;
    setErrorArchivo("");
    const supabase = createClient();
    setSubidas(lista.map((f) => ({ nombre: f.name, estado: "subiendo" as const })));

    const resultado = [...lista.map(() => ({ estado: "subiendo" as "subiendo" | "listo" | "error", detalle: "" }))];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      const falla = (detalle: string) => {
        resultado[i] = { estado: "error", detalle };
      };
      if (EXTENSIONES_PROHIBIDAS.test(f.name)) falla("Ese tipo de archivo no se puede subir.");
      else if (f.size === 0) falla("El archivo esta vacio.");
      else if (f.size > TOPE_ARCHIVO_LEAD) falla("Pesa mas de 25 MB.");
      else {
        const ruta = `${idLead}/${crypto.randomUUID()}-${nombreSeguro(f.name)}`;
        const { error } = await supabase.storage
          .from(BUCKET_LEADS)
          .upload(ruta, f, { contentType: f.type || undefined, upsert: false });
        if (error) falla(error.message);
        else {
          const r = await registrarArchivoLead(idLead, ruta, f.name, f.type, f.size);
          if (r.ok) resultado[i] = { estado: "listo", detalle: "" };
          else falla(r.mensaje ?? "No se pudo registrar.");
        }
      }
      setSubidas(lista.map((x, j) => ({ nombre: x.name, ...resultado[j] })));
    }
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  async function abrir(id: number) {
    setErrorArchivo("");
    // La pestana se abre antes de pedir el enlace: si no, el navegador la toma
    // por una ventana emergente y la bloquea.
    const ventana = window.open("", "_blank");
    const r = await urlArchivoLead(id);
    if (r.url && ventana) ventana.location.href = r.url;
    else {
      ventana?.close();
      setErrorArchivo(r.error ?? "No se pudo abrir el archivo.");
    }
  }

  function quitar(id: number) {
    setErrorArchivo("");
    accionArchivo(async () => {
      const r = await quitarArchivoLead(id, idLead);
      setConfirmando(null);
      if (!r.ok) setErrorArchivo(r.mensaje ?? "No se pudo quitar.");
      else router.refresh();
    });
  }

  return (
    <>
      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <h2 className={TITULO}>
          <span>PROYECTO DE CASA</span>
          <span className="font-normal">{esPeru ? "Peru: dolares y soles" : "Chile: UF y pesos"}</span>
        </h2>
        <form onSubmit={enviarDatos} className="p-3 space-y-3">
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              id="casa-m2"
              rotulo="Metros cuadrados"
              valor={m2}
              onChange={setM2}
              paso="0.01"
              sufijo="m²"
              deshabilitado={!puedeEditar}
            />
            {esPeru ? (
              <>
                <Numero
                  id="casa-usd"
                  rotulo="Valor cotizado en dolares"
                  valor={usd}
                  onChange={setUsd}
                  paso="0.01"
                  sufijo="US$"
                  deshabilitado={!puedeEditar}
                />
                <Numero
                  id="casa-pen"
                  rotulo="Valor cotizado en soles"
                  valor={pen}
                  onChange={setPen}
                  paso="0.01"
                  sufijo="S/"
                  deshabilitado={!puedeEditar}
                />
              </>
            ) : (
              <>
                <Numero
                  id="casa-uf"
                  rotulo="Valor cotizado en UF"
                  valor={uf}
                  onChange={setUf}
                  paso="0.01"
                  sufijo="UF"
                  deshabilitado={!puedeEditar}
                />
                <Numero
                  id="casa-clp"
                  rotulo="Valor cotizado en pesos"
                  valor={clp}
                  onChange={setClp}
                  paso="1"
                  sufijo="$"
                  deshabilitado={!puedeEditar}
                />
              </>
            )}
            <div>
              <div className={ROTULO}>{esPeru ? "Dolares por m²" : "UF por m²"}</div>
              <div className="text-[11px] py-1">
                {porM2 != null ? (
                  dinero(porM2, esPeru ? "USD" : "UF")
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            </div>
          </div>
          {puedeEditar ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!sucio || guardando}
                className="bg-verde text-white text-[11px] font-semibold px-3 py-1 rounded disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar proyecto"}
              </button>
              {mensaje && (
                <span
                  className={`text-[11px] ${mensaje.ok ? "text-green-700" : "text-red-600"}`}
                  role={mensaje.ok ? "status" : "alert"}
                >
                  {mensaje.texto}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500">Su perfil solo puede consultar el proyecto.</p>
          )}
          {!esPeru && (
            <p className="text-[10px] text-gray-500">
              Anote los dos valores: la UF cambia cada dia, y el valor en pesos es el de la fecha en que se cotizo.
            </p>
          )}
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <h2 className={TITULO}>
          <span>ARCHIVOS DEL PROYECTO</span>
          <span className="font-normal">{archivos.length}</span>
        </h2>

        {puedeEditar && (
          <div className="p-3 pb-0">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                subir(Array.from(e.dataTransfer.files));
              }}
              className={`rounded border border-dashed px-3 py-3 text-center text-[11px] ${
                arrastrando ? "border-verde bg-crema" : "border-gray-300 bg-gray-50"
              }`}
            >
              <p className="text-gray-700">Arrastre aqui planos, fotos o presupuestos, o</p>
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                className="mt-1 bg-verde text-white text-[11px] font-semibold px-3 py-1 rounded"
              >
                Elegir archivos
              </button>
              <input
                ref={entrada}
                type="file"
                multiple
                className="sr-only"
                aria-label="Elegir archivos del proyecto"
                onChange={(e) => subir(Array.from(e.target.files ?? []))}
              />
              <p className="mt-1 text-[10px] text-gray-500">Hasta 25 MB por archivo.</p>
            </div>
            {subidas.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[11px]" aria-live="polite">
                {subidas.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="truncate">{s.nombre}</span>
                    <span
                      className={
                        s.estado === "error"
                          ? "text-red-600"
                          : s.estado === "listo"
                            ? "text-green-700"
                            : "text-gray-500"
                      }
                    >
                      {s.estado === "subiendo" ? "Subiendo..." : s.estado === "listo" ? "Listo" : s.detalle}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {errorArchivo && (
          <p className="px-3 pt-2 text-[11px] text-red-600" role="alert">
            {errorArchivo}
          </p>
        )}

        {archivos.length === 0 ? (
          <p className="px-3 py-4 text-center text-[11px] text-gray-400">
            Este proyecto todavia no tiene archivos.
          </p>
        ) : (
          <div className="p-3 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-crema text-dorado-osc">
                <tr>
                  <th className="text-left px-3 py-0.5">Archivo</th>
                  <th className="text-right px-3 py-0.5 w-20">Peso</th>
                  <th className="text-left px-3 py-0.5 w-40">Subido por</th>
                  <th className="text-left px-3 py-0.5 w-24">Fecha</th>
                  <th className="px-3 py-0.5 w-32" />
                </tr>
              </thead>
              <tbody>
                {archivos.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 hover:bg-crema">
                    <td className="px-3 py-0.5">
                      <button
                        type="button"
                        onClick={() => abrir(a.id)}
                        className="text-verde underline text-left break-all"
                      >
                        {a.nombre}
                      </button>
                    </td>
                    <td className="px-3 py-0.5 text-right tabular-nums whitespace-nowrap">{peso(a.tamano)}</td>
                    <td className="px-3 py-0.5">{a.vendedor}</td>
                    <td className="px-3 py-0.5 whitespace-nowrap">{fecha(a.creado_en.slice(0, 10))}</td>
                    <td className="px-3 py-0.5 text-right whitespace-nowrap">
                      {puedeEditar && (esAdmin || a.id_vendedor === yo) &&
                        (confirmando === a.id ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-gray-700">¿Quitar?</span>
                            <button
                              type="button"
                              onClick={() => quitar(a.id)}
                              className="border border-red-300 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded bg-white"
                            >
                              Si
                            </button>
                            <button type="button" onClick={() => setConfirmando(null)} className={BOTON_CLARO}>
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmando(a.id)}
                            className="text-red-700 underline"
                          >
                            Quitar
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
