"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dinero } from "@/lib/formato";
import { guardarProyectoValorizado } from "@/app/leads/edicion-lead";
import ArchivosLead, { type ArchivoLead } from "@/components/ArchivosLead";

export type { ArchivoLead };

export interface DatosCasaGuardados {
  metros2: number | null;
}

// Una valorizacion del proyecto: que es --la casa, una ampliacion, el radier...-- y lo que vale.
export interface Valorizacion {
  descripcion: string;
  valor_uf: number | null;
  valor_clp: number | null;
  valor_usd: number | null;
  valor_pen: number | null;
}

type Fila = { clave: number; descripcion: string; uf: string; clp: string; usd: string; pen: string };

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";
const TITULO = "bg-verde text-white text-[10px] font-semibold px-3 py-0.5 flex justify-between";

const texto = (n: number | null | undefined) => (n == null ? "" : String(n));

const aFilas = (v: Valorizacion[]): Fila[] =>
  v.map((x, i) => ({
    clave: i,
    descripcion: x.descripcion,
    uf: texto(x.valor_uf),
    clp: texto(x.valor_clp),
    usd: texto(x.valor_usd),
    pen: texto(x.valor_pen),
  }));

const suma = (filas: Fila[], k: "uf" | "clp" | "usd" | "pen") => filas.reduce((t, f) => t + (Number(f[k]) || 0), 0);

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
  oculto = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  paso: string;
  sufijo?: string;
  deshabilitado: boolean;
  // Con el rotulo solo para lectores de pantalla: en las valorizaciones el rotulo va en la cabecera.
  oculto?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={oculto ? "sr-only" : ROTULO}>
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
  valorizaciones,
  archivos,
  puedeEditar,
  esAdmin,
  yo,
}: {
  idLead: number;
  codigoPais: "CL" | "PE";
  casa: DatosCasaGuardados | null;
  valorizaciones: Valorizacion[];
  archivos: ArchivoLead[];
  puedeEditar: boolean;
  esAdmin: boolean;
  yo: number;
}) {
  const router = useRouter();
  const esPeru = codigoPais === "PE";

  // --- datos del proyecto
  const [m2, setM2] = useState(texto(casa?.metros2));
  const [filas, setFilas] = useState<Fila[]>(() => aFilas(valorizaciones));
  const [siguiente, setSiguiente] = useState(valorizaciones.length);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, guardar] = useTransition();

  const sucio =
    m2 !== texto(casa?.metros2) ||
    JSON.stringify(filas.map(({ clave: _c, ...x }) => x)) !== JSON.stringify(aFilas(valorizaciones).map(({ clave: _c, ...x }) => x));

  const cambiar = (clave: number, k: keyof Omit<Fila, "clave">, v: string) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [k]: v } : f)));
  const quitar = (clave: number) => setFilas((fs) => fs.filter((f) => f.clave !== clave));
  function agregar() {
    setFilas((fs) => [...fs, { clave: siguiente, descripcion: "", uf: "", clp: "", usd: "", pen: "" }]);
    setSiguiente((n) => n + 1);
  }

  // Valor por metro cuadrado, en la moneda principal de cada mercado, sobre la suma de las valorizaciones.
  const metros = Number(m2);
  const principal = esPeru ? suma(filas, "usd") : suma(filas, "uf");
  const porM2 = metros > 0 && principal > 0 ? principal / metros : null;

  function enviarDatos(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    guardar(async () => {
      const r = await guardarProyectoValorizado(
        idLead,
        m2,
        filas.map(({ clave: _c, ...x }) => x)
      );
      setMensaje({ ok: r.ok, texto: r.mensaje ?? (r.ok ? "Guardado." : "No se pudo guardar.") });
      if (r.ok) router.refresh();
    });
  }

  // Las columnas de monto de cada mercado.
  const columnas = esPeru
    ? ([
        { k: "usd", rotulo: "Valor en dolares", paso: "0.01", sufijo: "US$" },
        { k: "pen", rotulo: "Valor en soles", paso: "0.01", sufijo: "S/" },
      ] as const)
    : ([
        { k: "uf", rotulo: "Valor en UF", paso: "0.01", sufijo: "UF" },
        { k: "clp", rotulo: "Valor en pesos", paso: "1", sufijo: "$" },
      ] as const);

  return (
    <>
      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <h2 className={TITULO}>
          <span>PROYECTO</span>
          <span className="font-normal">{esPeru ? "Peru: dolares y soles" : "Chile: UF y pesos"}</span>
        </h2>
        <form onSubmit={enviarDatos} className="p-3 space-y-3">
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <Numero id="casa-m2" rotulo="Metros cuadrados" valor={m2} onChange={setM2} paso="0.01" sufijo="m²" deshabilitado={!puedeEditar} />
            <div>
              <div className={ROTULO}>{esPeru ? "Dolares por m²" : "UF por m²"}</div>
              <div className="text-[11px] py-1">
                {porM2 != null ? dinero(porM2, esPeru ? "USD" : "UF") : <span className="text-gray-400">—</span>}
              </div>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className={ROTULO}>Valorizaciones</legend>
            {filas.length === 0 ? (
              <p className="text-[11px] text-gray-500">Todavia no hay valorizaciones.{puedeEditar ? " Agregue la primera." : ""}</p>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 text-[10px] font-semibold text-dorado-osc uppercase tracking-wide">
                  <span>Que es</span>
                  {columnas.map((c) => (
                    <span key={c.k}>{c.rotulo}</span>
                  ))}
                  <span />
                </div>
                <ul className="space-y-1.5">
                  {filas.map((f, i) => (
                    <li key={f.clave} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center">
                      <div>
                        <label htmlFor={`val-desc-${f.clave}`} className="sr-only">
                          Detalle de la valorizacion {i + 1}
                        </label>
                        <input
                          id={`val-desc-${f.clave}`}
                          className={CAMPO}
                          placeholder="Que es: casa, ampliacion, radier..."
                          maxLength={120}
                          value={f.descripcion}
                          disabled={!puedeEditar}
                          onChange={(e) => cambiar(f.clave, "descripcion", e.target.value)}
                        />
                      </div>
                      {columnas.map((c) => (
                        <Numero
                          key={c.k}
                          id={`val-${c.k}-${f.clave}`}
                          rotulo={`${c.rotulo} de la valorizacion ${i + 1}`}
                          oculto
                          valor={f[c.k]}
                          onChange={(v) => cambiar(f.clave, c.k, v)}
                          paso={c.paso}
                          sufijo={c.sufijo}
                          deshabilitado={!puedeEditar}
                        />
                      ))}
                      {puedeEditar && (
                        <button
                          type="button"
                          onClick={() => quitar(f.clave)}
                          aria-label={`Quitar la valorizacion ${i + 1}`}
                          className="text-red-700 border border-red-300 rounded bg-white text-[13px] leading-none h-6 w-6"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {filas.length > 1 && (
                  <p className="text-[11px] text-gray-700 pt-1">
                    <strong>Total:</strong>{" "}
                    {columnas.map((c, i) => (
                      <span key={c.k}>
                        {i > 0 && " · "}
                        {dinero(suma(filas, c.k), c.k === "uf" ? "UF" : c.k === "clp" ? "CLP" : c.k === "usd" ? "USD" : "PEN")}
                      </span>
                    ))}
                  </p>
                )}
              </>
            )}
            {puedeEditar && (
              <button type="button" onClick={agregar} className="text-[11px] font-semibold text-verde underline">
                + Agregar valorizacion
              </button>
            )}
          </fieldset>

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
                <span className={`text-[11px] ${mensaje.ok ? "text-green-700" : "text-red-600"}`} role={mensaje.ok ? "status" : "alert"}>
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

      <ArchivosLead
        idLead={idLead}
        archivos={archivos}
        puedeEditar={puedeEditar}
        esAdmin={esAdmin}
        yo={yo}
        titulo="ARCHIVOS DEL PROYECTO"
        vacio="Este proyecto todavia no tiene archivos."
      />
    </>
  );
}
