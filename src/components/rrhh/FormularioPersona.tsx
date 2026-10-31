"use client";

import { rut as fmtRut } from "@/lib/formato";
import { CLASES, ESTADOS_PERSONAL, RELACIONES, TIPOS_CUENTA } from "@/lib/rrhh";
import type { DatosPersona } from "@/app/rrhh/acciones";
import type { Pais } from "@/types/database";

export const personaVacia = (idPais: number | null): DatosPersona => ({
  razon_social: "",
  rut: "",
  email: "",
  telefono: "",
  direccion: "",
  id_pais: idPais,
  relacion: "Contrato",
  clase: "Administrativo",
  cargo: "",
  oficio: "",
  fecha_ingreso: "",
  fecha_termino: "",
  estado: "Activo",
  fecha_nacimiento: "",
  nacionalidad: "",
  cargas_familiares: 0,
  contacto_emergencia: "",
  telefono_emergencia: "",
  banco: "",
  tipo_cuenta: "",
  numero_cuenta: "",
  notas: "",
});

export const estiloCampo = "border border-gray-300 rounded px-2 py-1 text-sm w-full";

export function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  id,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  id?: string;
}) {
  return (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{label}</span>
      <input id={id} type={type} className={estiloCampo} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Selector({
  label,
  value,
  onChange,
  opciones,
  vacia,
  deshabilitado,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  opciones: readonly (string | { v: string | number; t: string })[];
  vacia?: string;
  deshabilitado?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="block text-dorado-osc font-semibold mb-1">{label}</span>
      <select className={estiloCampo} value={value} disabled={deshabilitado} onChange={(e) => onChange(e.target.value)}>
        {vacia != null && <option value="">{vacia}</option>}
        {opciones.map((o) => {
          const v = typeof o === "string" ? o : o.v;
          const t = typeof o === "string" ? o : o.t;
          return (
            <option key={v} value={v}>
              {t}
            </option>
          );
        })}
      </select>
    </label>
  );
}

// Datos de la persona: identificacion, relacion con la empresa, y como se le paga.
// Sirve para dar de alta y para corregir la ficha.
export default function FormularioPersona({
  form,
  setForm,
  paises,
  esAdminGeneral,
  edicion,
}: {
  form: DatosPersona;
  setForm: (f: DatosPersona) => void;
  paises: Pais[];
  esAdminGeneral: boolean;
  edicion: boolean;
}) {
  const pais = paises.find((p) => p.id === form.id_pais) ?? paises[0];
  const set = <K extends keyof DatosPersona>(k: K, v: DatosPersona[K]) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <Campo label="Nombre completo *" value={form.razon_social} onChange={(v) => set("razon_social", v)} />
        <label className="text-sm">
          <span className="block text-dorado-osc font-semibold mb-1">{pais?.etiqueta_id ?? "RUT"} *</span>
          <input className={estiloCampo} value={form.rut} onChange={(e) => set("rut", e.target.value)} onBlur={(e) => set("rut", fmtRut(e.target.value))} />
        </label>
        <Selector
          label="Mercado *"
          value={form.id_pais ?? ""}
          onChange={(v) => set("id_pais", Number(v) || null)}
          vacia={esAdminGeneral && !edicion ? "-- elija --" : undefined}
          deshabilitado={edicion || !esAdminGeneral}
          opciones={paises.map((p) => ({ v: p.id, t: p.nombre }))}
        />
        <Selector label="Se le paga por *" value={form.relacion} onChange={(v) => set("relacion", v)} opciones={RELACIONES.map((r) => ({ v: r, t: r === "Contrato" ? "Contrato de trabajo" : "Honorarios" }))} />
        <Selector label="Tipo de personal *" value={form.clase} onChange={(v) => set("clase", v)} opciones={CLASES.map((c) => ({ v: c, t: c === "Obra" ? "Trabajador de obra" : "Administrativo" }))} />
        <Selector label="Estado" value={form.estado} onChange={(v) => set("estado", v)} opciones={ESTADOS_PERSONAL} />
        <Campo label="Cargo" value={form.cargo} onChange={(v) => set("cargo", v)} />
        <Campo label="Oficio (obra)" value={form.oficio} onChange={(v) => set("oficio", v)} placeholder="Ej: carpintero, maestro instalador" />
        <Campo label="Fecha de ingreso" type="date" value={form.fecha_ingreso} onChange={(v) => set("fecha_ingreso", v)} />
        <Campo label="Fecha de termino" type="date" value={form.fecha_termino} onChange={(v) => set("fecha_termino", v)} />
        <Campo label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={(v) => set("fecha_nacimiento", v)} />
        <Campo label="Nacionalidad" value={form.nacionalidad} onChange={(v) => set("nacionalidad", v)} />
        <Campo label="Cargas familiares" type="number" value={form.cargas_familiares} onChange={(v) => set("cargas_familiares", Math.max(0, Math.trunc(Number(v) || 0)))} />
        <Campo label="Correo" value={form.email} onChange={(v) => set("email", v)} />
        <Campo label="Telefono" value={form.telefono} onChange={(v) => set("telefono", v)} />
        <div className="md:col-span-3">
          <Campo label="Direccion" value={form.direccion} onChange={(v) => set("direccion", v)} />
        </div>
      </div>
      <fieldset className="grid md:grid-cols-3 gap-3 border-t border-gray-200 pt-3">
        <legend className="text-xs font-semibold text-gray-600 pr-2">Cuenta para el pago</legend>
        <Campo label="Banco" value={form.banco} onChange={(v) => set("banco", v)} />
        <Selector label="Tipo de cuenta" value={form.tipo_cuenta} onChange={(v) => set("tipo_cuenta", v)} vacia="-- sin definir --" opciones={TIPOS_CUENTA} />
        <Campo label="Numero de cuenta" value={form.numero_cuenta} onChange={(v) => set("numero_cuenta", v)} />
      </fieldset>
      <fieldset className="grid md:grid-cols-3 gap-3 border-t border-gray-200 pt-3">
        <legend className="text-xs font-semibold text-gray-600 pr-2">Contacto de emergencia</legend>
        <Campo label="Nombre" value={form.contacto_emergencia} onChange={(v) => set("contacto_emergencia", v)} />
        <Campo label="Telefono" value={form.telefono_emergencia} onChange={(v) => set("telefono_emergencia", v)} />
      </fieldset>
      <label className="text-sm block">
        <span className="block text-dorado-osc font-semibold mb-1">Notas</span>
        <textarea className={estiloCampo} rows={2} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
      </label>
    </div>
  );
}
