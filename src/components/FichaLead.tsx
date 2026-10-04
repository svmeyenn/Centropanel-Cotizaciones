"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CambioConfirmado from "@/components/CambioConfirmado";
import { fecha } from "@/lib/formato";
import { ESTADOS_LEAD, LINEAS, ORDEN_ESTADOS, estadoLegible, type Linea } from "@/lib/leads";
import { fijarEstadoLead, fijarLineaLead, guardarDatosLead } from "@/app/leads/edicion-lead";

export interface DatosFicha {
  id_clientify: number;
  nombre: string | null;
  apellido: string | null;
  empresa: string | null;
  cargo: string | null;
  telefonos: { phone?: string; whatsapp?: boolean }[] | null;
  emails: { email?: string }[] | null;
  direccion: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  origen: string | null;
  campana: string | null;
  propietario: string | null;
  propietario_email: string | null;
  creado_clientify: string | null;
  estado: string | null;
  estado_efectivo: string | null;
  estado_manual: string | null;
  con_cotizacion_enviada: boolean;
  linea: Linea;
  linea_manual: Linea | null;
  linea_auto: Linea;
  editado: boolean;
  id_pais: number;
  pais: string | null;
}

// Lo que cambia de nombre segun el mercado del lead: en Chile se habla de
// comuna y region; en Peru, de distrito, provincia y departamento.
const ROTULOS_GEO = {
  CL: { comuna: "Comuna", ciudad: "Ciudad", region: "Region" },
  PE: { comuna: "Distrito", ciudad: "Provincia", region: "Departamento" },
} as const;

const SUBTITULO =
  "text-[9px] font-semibold text-verde uppercase tracking-wider border-b border-gray-200 mb-1 pb-px";
const CAMPO = "border border-gray-300 rounded px-2 py-1 text-[11px] w-full bg-white";
const ROTULO = "block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide mb-0.5";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold text-dorado-osc uppercase tracking-wide">
        {etiqueta}
      </dt>
      <dd className="text-[11px] leading-tight break-words">
        {children || <span className="text-gray-400">—</span>}
      </dd>
    </div>
  );
}

export default function FichaLead({
  lead,
  codigoPais,
  paises,
  propietarios,
  puedeEditar,
  puedeCambiarPais,
}: {
  lead: DatosFicha;
  codigoPais: "CL" | "PE";
  // Los mercados entre los que quien administra puede mover un lead.
  paises: { id: number; nombre: string }[];
  // A quien se le puede asignar el lead.
  propietarios: { email: string; nombre: string }[];
  puedeEditar: boolean;
  puedeCambiarPais: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, comenzar] = useTransition();
  const geo = ROTULOS_GEO[codigoPais];

  // El propietario actual siempre se puede elegir, aunque ya no figure en la lista.
  const emailProp = (lead.propietario_email ?? "").toLowerCase();
  const opcionesPropietario =
    emailProp && !propietarios.some((p) => p.email.toLowerCase() === emailProp)
      ? [{ email: emailProp, nombre: lead.propietario ?? emailProp }, ...propietarios]
      : propietarios;

  const tels = (lead.telefonos ?? []).filter((t) => t.phone);
  const mails = (lead.emails ?? []).filter((e) => e.email);

  const [form, setForm] = useState({
    nombre: lead.nombre ?? "",
    apellido: lead.apellido ?? "",
    empresa: lead.empresa ?? "",
    cargo: lead.cargo ?? "",
    telefonos: tels.map((t) => t.phone).join("\n"),
    emails: mails.map((e) => e.email).join("\n"),
    direccion: lead.direccion ?? "",
    comuna: lead.comuna ?? "",
    ciudad: lead.ciudad ?? "",
    region: lead.region ?? "",
    origen: lead.origen ?? "",
    campana: lead.campana ?? "",
    propietario: (lead.propietario_email ?? "").toLowerCase(),
    id_pais: lead.id_pais,
  });
  const poner = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === "id_pais" ? Number(e.target.value) : e.target.value }));

  function abrir() {
    setError("");
    setForm({
      nombre: lead.nombre ?? "",
      apellido: lead.apellido ?? "",
      empresa: lead.empresa ?? "",
      cargo: lead.cargo ?? "",
      telefonos: tels.map((t) => t.phone).join("\n"),
      emails: mails.map((e) => e.email).join("\n"),
      direccion: lead.direccion ?? "",
      comuna: lead.comuna ?? "",
      ciudad: lead.ciudad ?? "",
      region: lead.region ?? "",
      origen: lead.origen ?? "",
      campana: lead.campana ?? "",
      propietario: (lead.propietario_email ?? "").toLowerCase(),
      id_pais: lead.id_pais,
    });
    setEditando(true);
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    comenzar(async () => {
      const r = await guardarDatosLead(lead.id_clientify, form);
      if (!r.ok) {
        setError(r.mensaje ?? "No se pudo guardar.");
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  const notaEstado = lead.estado_manual
    ? "Fijado a mano: no cambia con las importaciones ni con las cotizaciones."
    : lead.con_cotizacion_enviada && lead.estado !== "in-deal"
      ? "Oportunidad por tener una cotizacion enviada."
      : "Segun el archivo importado.";

  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      <h2 className="bg-verde text-white text-[10px] font-semibold px-2.5 py-px flex justify-between items-center">
        <span>
          DATOS PERSONALES
          {lead.editado && (
            <span className="ml-2 font-normal opacity-80">· con datos corregidos a mano</span>
          )}
        </span>
        {puedeEditar && !editando && (
          <button
            type="button"
            onClick={abrir}
            className="bg-white text-verde font-semibold text-[10px] px-2 py-px rounded"
          >
            Editar datos
          </button>
        )}
      </h2>

      {!editando ? (
        // Dos grupos lado a lado: quien es la persona, y en que va el lead.
        <div className="grid lg:grid-cols-[3fr_2fr]">
          <div className="px-2.5 py-1.5">
            <h3 className={SUBTITULO}>La persona</h3>
            <dl className="grid gap-x-4 gap-y-1 grid-cols-2 sm:grid-cols-3">
              <Dato etiqueta="Nombre">{lead.nombre}</Dato>
              <Dato etiqueta="Apellido">{lead.apellido}</Dato>
              <Dato etiqueta="Empresa">{lead.empresa}</Dato>
              <Dato etiqueta="Cargo">{lead.cargo}</Dato>
              <Dato etiqueta="Telefonos">
                {tels.length > 0 && (
                  <ul>
                    {tels.map((t, i) => (
                      <li key={i}>
                        {t.phone}
                        {t.whatsapp && (
                          <span className="ml-1 text-[9px] text-green-700 border border-green-300 rounded px-1">
                            WhatsApp
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Dato>
              <Dato etiqueta="Emails">
                {mails.length > 0 && (
                  <ul>
                    {mails.map((e, i) => (
                      <li key={i}>{e.email}</li>
                    ))}
                  </ul>
                )}
              </Dato>
              <Dato etiqueta="Direccion">{lead.direccion}</Dato>
              <Dato etiqueta={geo.comuna}>{lead.comuna}</Dato>
              <Dato etiqueta={geo.ciudad}>{lead.ciudad}</Dato>
              <Dato etiqueta={geo.region}>{lead.region}</Dato>
              <Dato etiqueta="Pais">{lead.pais}</Dato>
            </dl>
          </div>

          <div className="px-2.5 py-1.5 border-t lg:border-t-0 lg:border-l border-gray-200 bg-crema/40">
            <h3 className={SUBTITULO}>El lead</h3>
            <dl className="grid gap-x-4 gap-y-1 grid-cols-2">
              <CambioConfirmado
                etiqueta="Estado"
                actual={estadoLegible(lead.estado_efectivo)}
                nota={notaEstado}
                claveActual={lead.estado_manual ?? "auto"}
                puedeEditar={puedeEditar}
                resultadoAuto={estadoLegible(lead.con_cotizacion_enviada ? "in-deal" : lead.estado)}
                opciones={[
                  { valor: "auto", texto: "Automatico (segun el archivo importado y las cotizaciones)" },
                  ...ORDEN_ESTADOS.map((e) => ({ valor: e, texto: ESTADOS_LEAD[e] })),
                ]}
                aviso={(desde, hasta) =>
                  `Va a cambiar el estado de «${desde}» a «${hasta}». El cambio queda registrado en la ficha.`
                }
                accion={(v) => fijarEstadoLead(lead.id_clientify, v === "auto" ? null : v)}
              />
              <CambioConfirmado
                etiqueta="Linea"
                actual={LINEAS[lead.linea]}
                nota={lead.linea_manual ? "Fijada a mano." : "Segun la campana y el servicio."}
                claveActual={lead.linea_manual ?? "auto"}
                puedeEditar={puedeEditar}
                resultadoAuto={LINEAS[lead.linea_auto]}
                opciones={[
                  { valor: "auto", texto: "Automatica (segun la campana)" },
                  { valor: "paneles", texto: LINEAS.paneles },
                  { valor: "casas", texto: LINEAS.casas },
                ]}
                aviso={(desde, hasta) =>
                  `Va a pasar el lead de «${desde}» a «${hasta}». Cambia la pantalla: Proyecto lleva archivos y el valor del proyecto en lugar de cotizaciones de paneles.`
                }
                accion={(v) => fijarLineaLead(lead.id_clientify, v === "auto" ? null : (v as Linea))}
              />
              <Dato etiqueta="Origen">{lead.origen}</Dato>
              <Dato etiqueta="Campana">{lead.campana}</Dato>
              <Dato etiqueta="Propietario">{lead.propietario}</Dato>
              <Dato etiqueta="Creado">
                {lead.creado_clientify ? fecha(lead.creado_clientify.slice(0, 10)) : ""}
              </Dato>
            </dl>
          </div>
        </div>
      ) : (
        <form onSubmit={guardar} className="p-2.5 space-y-2">
          <h3 className={SUBTITULO}>La persona</h3>
          <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={ROTULO}>Nombre</span>
              <input className={CAMPO} value={form.nombre} onChange={poner("nombre")} maxLength={120} autoFocus />
            </label>
            <label>
              <span className={ROTULO}>Apellido</span>
              <input className={CAMPO} value={form.apellido} onChange={poner("apellido")} maxLength={120} />
            </label>
            <label>
              <span className={ROTULO}>Empresa</span>
              <input className={CAMPO} value={form.empresa} onChange={poner("empresa")} maxLength={200} />
            </label>
            <label>
              <span className={ROTULO}>Cargo</span>
              <input className={CAMPO} value={form.cargo} onChange={poner("cargo")} maxLength={200} />
            </label>
            <label className="lg:col-span-2">
              <span className={ROTULO}>Telefonos (uno por linea, con codigo de pais)</span>
              <textarea
                className={CAMPO}
                rows={2}
                value={form.telefonos}
                onChange={poner("telefonos")}
                placeholder={codigoPais === "PE" ? "+51 987 654 321" : "+56 9 1234 5678"}
              />
            </label>
            <label className="lg:col-span-2">
              <span className={ROTULO}>Emails (uno por linea)</span>
              <textarea
                className={CAMPO}
                rows={2}
                value={form.emails}
                onChange={poner("emails")}
                placeholder="nombre@correo.com"
              />
            </label>
            <label className="lg:col-span-2">
              <span className={ROTULO}>Direccion</span>
              <input className={CAMPO} value={form.direccion} onChange={poner("direccion")} maxLength={200} />
            </label>
            <label>
              <span className={ROTULO}>{geo.comuna}</span>
              <input className={CAMPO} value={form.comuna} onChange={poner("comuna")} maxLength={200} />
            </label>
            <label>
              <span className={ROTULO}>{geo.ciudad}</span>
              <input className={CAMPO} value={form.ciudad} onChange={poner("ciudad")} maxLength={200} />
            </label>
            <label>
              <span className={ROTULO}>{geo.region}</span>
              <input className={CAMPO} value={form.region} onChange={poner("region")} maxLength={200} />
            </label>
            <label>
              <span className={ROTULO}>Pais</span>
              {puedeCambiarPais && paises.length > 1 ? (
                <select className={CAMPO} value={form.id_pais} onChange={poner("id_pais")}>
                  {paises.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={`${CAMPO} bg-gray-50`} value={lead.pais ?? ""} readOnly />
              )}
            </label>
          </div>
          <h3 className={SUBTITULO}>El lead</h3>
          <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className={ROTULO}>Origen</span>
              <input className={CAMPO} value={form.origen} onChange={poner("origen")} maxLength={200} />
            </label>
            <label className="lg:col-span-2">
              <span className={ROTULO}>Campana</span>
              <input className={CAMPO} value={form.campana} onChange={poner("campana")} maxLength={200} />
            </label>
            <label>
              <span className={ROTULO}>Propietario</span>
              <select className={CAMPO} value={form.propietario} onChange={poner("propietario")}>
                <option value="">Sin propietario</option>
                {opcionesPropietario.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-gray-500">
            Lo que corrija aqui queda en este sistema y las importaciones no lo pisan; los
            campos que no toque se siguen actualizando con cada importacion. El estado y la linea se cambian aparte,
            con su confirmacion.
          </p>
          {error && (
            <p className="text-[11px] text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              disabled={pendiente}
              className="border border-gray-300 text-gray-700 text-[11px] font-semibold px-3 py-1 rounded bg-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente}
              className="bg-verde text-white text-[11px] font-semibold px-3 py-1 rounded disabled:opacity-50"
            >
              {pendiente ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
