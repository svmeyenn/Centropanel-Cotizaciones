"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dinero } from "@/lib/formato";
import { guardarProyectoCasa } from "@/app/leads/edicion-lead";
import ArchivosLead, { type ArchivoLead } from "@/components/ArchivosLead";

export type { ArchivoLead };

export interface DatosCasaGuardados {
  metros2: number | null;
  valor_uf: number | null;
  valor_clp: number | null;
  valor_usd: number | null;
  valor_pen: number | null;
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

  return (
    <>
      <section className="bg-white border border-gray-200 rounded overflow-hidden">
        <h2 className={TITULO}>
          <span>PROYECTO</span>
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
