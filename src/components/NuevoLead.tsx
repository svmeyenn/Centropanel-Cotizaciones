"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LINEAS } from "@/lib/leads";
import { crearLead, type DatosNuevoLead, type ResultadoAlta } from "@/app/leads/alta";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";

// En Chile se habla de comuna y region; en Peru, de distrito, provincia y departamento.
const GEO = {
  CL: { comuna: "Comuna", ciudad: "Ciudad", region: "Region" },
  PE: { comuna: "Distrito", ciudad: "Provincia", region: "Departamento" },
} as const;

export default function NuevoLead({
  paises,
  idPaisInicial,
  propietarios,
  miEmail,
}: {
  // Los mercados en que esta persona puede crear leads.
  paises: { id: number; codigo: string; nombre: string }[];
  // El mercado en que esta trabajando; si trabaja los dos y no eligio, ninguno.
  idPaisInicial: number | null;
  propietarios: { email: string; nombre: string }[];
  // Se propone como propietario a quien lo crea, si figura en la lista.
  miEmail: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState("");
  const [duplicados, setDuplicados] = useState<ResultadoAlta["duplicados"]>([]);
  const [pendiente, comenzar] = useTransition();

  const vacio = (): DatosNuevoLead => ({
    nombre: "",
    apellido: "",
    empresa: "",
    cargo: "",
    emails: "",
    telefonos: "",
    direccion: "",
    comuna: "",
    ciudad: "",
    region: "",
    origen: "",
    campana: "",
    linea: "",
    observaciones: "",
    propietario: propietarios.some((p) => p.email.toLowerCase() === miEmail.toLowerCase())
      ? miEmail.toLowerCase()
      : "",
    id_pais: idPaisInicial ?? (paises.length === 1 ? paises[0].id : null),
  });
  const [form, setForm] = useState<DatosNuevoLead>(vacio);

  const poner =
    (k: keyof DatosNuevoLead) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDuplicados([]);
      setForm((f) => ({ ...f, [k]: k === "id_pais" ? (e.target.value ? Number(e.target.value) : null) : e.target.value }));
    };

  const codigoPais = (paises.find((p) => p.id === form.id_pais)?.codigo === "PE" ? "PE" : "CL") as "CL" | "PE";
  const geo = GEO[codigoPais];

  function abrir() {
    setError("");
    setDuplicados([]);
    setForm(vacio());
    setAbierto(true);
  }

  function guardar(forzar: boolean) {
    setError("");
    comenzar(async () => {
      const r = await crearLead(form, forzar);
      if (r.duplicados?.length) {
        setDuplicados(r.duplicados);
        return;
      }
      if (!r.ok || !r.id) {
        setError(r.mensaje ?? "No se pudo crear el lead.");
        return;
      }
      setAbierto(false);
      router.push(`/leads/${r.id}`);
    });
  }

  if (!abierto) {
    return (
      <button type="button" onClick={abrir} className="bg-verde text-white font-semibold px-3 py-1 rounded text-xs">
        Nuevo lead
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Nuevo lead">
      <form
        className="bg-white rounded border border-gray-300 shadow-lg w-full max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
      >
        <h2 className="bg-verde text-white text-sm font-semibold px-4 py-2 flex justify-between items-center rounded-t">
          <span>Nuevo lead</span>
          <button type="button" onClick={() => setAbierto(false)} className="text-white text-lg leading-none" aria-label="Cerrar">
            ×
          </button>
        </h2>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Necesita al menos un nombre o una empresa. Queda como &quot;Nuevo&quot; y marcado como creado a mano; despues se
            edita desde su ficha.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="nl-nombre" className={ROTULO}>Nombre</label>
              <input id="nl-nombre" className={CAMPO} value={form.nombre} onChange={poner("nombre")} maxLength={120} autoFocus />
            </div>
            <div>
              <label htmlFor="nl-apellido" className={ROTULO}>Apellido</label>
              <input id="nl-apellido" className={CAMPO} value={form.apellido} onChange={poner("apellido")} maxLength={120} />
            </div>
            <div>
              <label htmlFor="nl-empresa" className={ROTULO}>Empresa</label>
              <input id="nl-empresa" className={CAMPO} value={form.empresa} onChange={poner("empresa")} maxLength={200} />
            </div>
            <div>
              <label htmlFor="nl-cargo" className={ROTULO}>Cargo</label>
              <input id="nl-cargo" className={CAMPO} value={form.cargo} onChange={poner("cargo")} maxLength={200} />
            </div>
            <div>
              <label htmlFor="nl-emails" className={ROTULO}>Emails (uno por linea)</label>
              <textarea id="nl-emails" className={CAMPO} rows={2} value={form.emails} onChange={poner("emails")} />
            </div>
            <div>
              <label htmlFor="nl-tels" className={ROTULO}>Telefonos (uno por linea)</label>
              <textarea
                id="nl-tels"
                className={CAMPO}
                rows={2}
                value={form.telefonos}
                onChange={poner("telefonos")}
                placeholder="+56 9 1234 5678 / +51 987 654 321"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {paises.length > 1 ? (
              <div>
                <label htmlFor="nl-pais" className={ROTULO}>Pais</label>
                <select id="nl-pais" className={CAMPO} value={form.id_pais ?? ""} onChange={poner("id_pais")} required>
                  <option value="">Elegir...</option>
                  {paises.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label htmlFor="nl-comuna" className={ROTULO}>{geo.comuna}</label>
              <input id="nl-comuna" className={CAMPO} value={form.comuna} onChange={poner("comuna")} maxLength={200} />
            </div>
            <div>
              <label htmlFor="nl-ciudad" className={ROTULO}>{geo.ciudad}</label>
              <input id="nl-ciudad" className={CAMPO} value={form.ciudad} onChange={poner("ciudad")} maxLength={200} />
            </div>
            <div>
              <label htmlFor="nl-region" className={ROTULO}>{geo.region}</label>
              <input id="nl-region" className={CAMPO} value={form.region} onChange={poner("region")} maxLength={200} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="nl-dir" className={ROTULO}>Direccion</label>
              <input id="nl-dir" className={CAMPO} value={form.direccion} onChange={poner("direccion")} maxLength={200} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="nl-origen" className={ROTULO}>Origen</label>
              <input id="nl-origen" className={CAMPO} value={form.origen} onChange={poner("origen")} placeholder="Manual" maxLength={200} />
            </div>
            <div>
              <label htmlFor="nl-campana" className={ROTULO}>Campana</label>
              <input id="nl-campana" className={CAMPO} value={form.campana} onChange={poner("campana")} maxLength={200} />
            </div>
            <div>
              <label htmlFor="nl-linea" className={ROTULO}>Linea</label>
              <select id="nl-linea" className={CAMPO} value={form.linea} onChange={poner("linea")}>
                <option value="">Segun la campana</option>
                <option value="paneles">{LINEAS.paneles}</option>
                <option value="casas">{LINEAS.casas}</option>
              </select>
            </div>
            <div>
              <label htmlFor="nl-prop" className={ROTULO}>Propietario</label>
              <select id="nl-prop" className={CAMPO} value={form.propietario} onChange={poner("propietario")}>
                <option value="">Sin propietario</option>
                {propietarios.map((p) => (
                  <option key={p.email} value={p.email}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="nl-notas" className={ROTULO}>Notas</label>
            <textarea id="nl-notas" className={CAMPO} rows={2} value={form.observaciones} onChange={poner("observaciones")} maxLength={2000} />
          </div>

          {duplicados && duplicados.length > 0 && (
            <div className="bg-amber-50 border border-amber-400 text-amber-900 text-xs rounded p-3 space-y-2" role="alert">
              <p>
                <strong>Ya existe un lead con ese email o telefono:</strong>
              </p>
              <ul className="list-disc pl-5">
                {duplicados.map((d) => (
                  <li key={d.id}>
                    <Link href={`/leads/${d.id}`} className="text-verde underline" target="_blank">
                      {d.nombre}
                    </Link>
                    {d.propietario ? ` (${d.propietario})` : ""}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => guardar(true)}
                className="bg-white border border-amber-500 font-semibold px-3 py-1 rounded disabled:opacity-50"
              >
                Crear de todos modos
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAbierto(false)} className="border border-gray-300 px-3 py-1 rounded text-xs">
              Cancelar
            </button>
            <button disabled={pendiente} className="bg-verde text-white font-semibold px-4 py-1 rounded text-xs disabled:opacity-50">
              {pendiente ? "Creando..." : "Crear lead"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
