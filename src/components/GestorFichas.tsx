"use client";

import { BanderaDe } from "@/components/Bandera";

import { useMemo, useState, useTransition } from "react";
import Ventana from "@/components/Ventana";
import Bitacora from "@/components/Bitacora";
import CampoTelefono from "@/components/CampoTelefono";
import BotonExportar from "@/components/BotonExportar";
import { rut as fmtRut } from "@/lib/formato";
import {
  ETIQUETA_TIPO,
  TIPOS_CUENTA,
  TIPOS_FICHA,
  faltantesFicha,
  type CuentaBancaria,
  type DatosFicha,
  type Ficha,
  type TipoFicha,
} from "@/lib/fichas";
import {
  cambiarActivoFicha,
  eliminarFicha,
  guardarFicha,
  juntarFichas,
  type ResultadoFicha,
} from "@/app/clientes/acciones-ficha";
import type { Pais } from "@/types/database";

// Una sola lista para todo tercero.
//
// Antes habia dos pantallas: "Clientes" en el cotizador y "Interlocutores" en
// finanzas. El mismo transportista aparecia en las dos, con la mitad de los
// datos en cada una. Aqui la ficha es una y lleva una marca por cada cosa que
// es; el filtro de arriba deja ver solo a los clientes, solo a los proveedores,
// o a todos.
//
// Quien no trabaja con la plata ve solo a los clientes y no ve los datos de
// pago: eso vivia detras de los permisos de finanzas y lo sigue haciendo. La
// base lo repite por su cuenta, esto es solo la pantalla.

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-sm w-full";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

const CUENTA_VACIA: CuentaBancaria = {
  banco: "",
  tipo_cuenta: "",
  numero_cuenta: "",
  email: "",
};

const vacia = (pais: number | null, tipo: TipoFicha): DatosFicha => ({
  razon_social: "",
  nombre_referencia: "",
  rut: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  comuna: "",
  ciudad: "",
  con_transferencia: false,
  tipos: [tipo],
  id_pais: pais,
});

type Filtro = TipoFicha | "todos";

export default function GestorFichas({
  fichas,
  cuentas,
  paises,
  esAdminGeneral,
  puedeEditar,
  veFinanzas,
  puedeJuntar,
  filtroInicial,
}: {
  fichas: Ficha[];
  // Las cuentas bancarias de cada ficha. Llega vacio para quien no ve finanzas.
  cuentas: Record<number, CuentaBancaria[]>;
  paises: Pais[];
  esAdminGeneral: boolean;
  puedeEditar: boolean;
  veFinanzas: boolean;
  puedeJuntar: boolean;
  filtroInicial: Filtro;
}) {
  const paisPorDefecto = paises.length === 1 ? paises[0].id : null;

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [vigencia, setVigencia] = useState<"vigentes" | "inactivas" | "todas">(
    "vigentes"
  );

  const [abierta, setAbierta] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  // La ficha se abre para mirarla o para cambiarla. Abrirla siempre editable
  // invita a tocar lo que solo se venia a consultar.
  const [modo, setModo] = useState<"ver" | "editar">("ver");
  const [borrando, setBorrando] = useState<Ficha | null>(null);
  const [form, setForm] = useState<DatosFicha>(vacia(paisPorDefecto, "cliente"));
  const [filasBanco, setFilasBanco] = useState<CuentaBancaria[]>([{ ...CUENTA_VACIA }]);
  const [resultado, setResultado] = useState<ResultadoFicha | null>(null);
  const [juntarCon, setJuntarCon] = useState<number | "">("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return fichas.filter((f) => {
      if (filtro !== "todos" && !f.tipos.includes(filtro)) return false;
      if (vigencia === "vigentes" && !f.activo) return false;
      if (vigencia === "inactivas" && f.activo) return false;
      if (!q) return true;
      return [f.razon_social, f.nombre_referencia, f.rut, f.contacto, f.telefono, f.email]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [fichas, filtro, vigencia, busca]);

  // Cuantas hay de cada marca, para que el filtro diga cuanto hay detras.
  const cuantas = useMemo(() => {
    const n: Record<string, number> = { todos: fichas.length };
    for (const t of TIPOS_FICHA) n[t.tipo] = 0;
    for (const f of fichas) for (const t of f.tipos) n[t] = (n[t] ?? 0) + 1;
    return n;
  }, [fichas]);

  const tiposVisibles = veFinanzas
    ? TIPOS_FICHA
    : TIPOS_FICHA.filter((t) => t.tipo === "cliente");

  function abrir(f: Ficha, como: "ver" | "editar" = "ver") {
    setAbierta(f.id_entidad);
    setCreando(false);
    setModo(puedeEditar ? como : "ver");
    setResultado(null);
    setJuntarCon("");
    setForm({
      razon_social: f.razon_social,
      nombre_referencia: f.nombre_referencia,
      rut: f.rut ?? "",
      contacto: f.contacto ?? "",
      email: f.email ?? "",
      telefono: f.telefono ?? "",
      direccion: f.direccion ?? "",
      comuna: f.comuna ?? "",
      ciudad: f.ciudad ?? "",
      con_transferencia: f.con_transferencia,
      tipos: [...f.tipos],
      id_pais: f.id_pais,
    });
    const suyas = cuentas[f.id_entidad] ?? [];
    setFilasBanco(suyas.length > 0 ? suyas.map((c) => ({ ...c })) : [{ ...CUENTA_VACIA }]);
  }

  function nueva() {
    setCreando(true);
    setAbierta(null);
    setModo("editar");
    setResultado(null);
    setJuntarCon("");
    setForm(vacia(paisPorDefecto, filtro === "todos" ? "cliente" : filtro));
    setFilasBanco([{ ...CUENTA_VACIA }]);
  }

  function cerrar() {
    setAbierta(null);
    setCreando(false);
    setResultado(null);
  }

  function grabar(crearIgual = false) {
    setResultado(null);
    empezar(async () => {
      const r = await guardarFicha(abierta, form, filasBanco, crearIgual);
      if (r.ok) {
        setAviso(creando ? "Ficha creada." : "Ficha grabada.");
        cerrar();
      } else setResultado(r);
    });
  }

  function marcar(tipo: TipoFicha, puesta: boolean) {
    setForm((f) => ({
      ...f,
      tipos: puesta ? [...new Set([...f.tipos, tipo])] : f.tipos.filter((t) => t !== tipo),
    }));
  }

  const paisDelForm = paises.find((x) => x.id === form.id_pais) ?? paises[0];
  const prefijo = paisDelForm?.prefijo_telefono ?? "+56";
  const etiquetaId = paisDelForm?.etiqueta_id ?? "RUT";
  const etiquetaLista =
    paises.length === 1
      ? paises[0].etiqueta_id
      : [...new Set(paises.map((x) => x.etiqueta_id))].join(" / ") || "RUT";

  const faltan = faltantesFicha(form, veFinanzas ? filasBanco : []);
  const laAbierta = fichas.find((f) => f.id_entidad === abierta) ?? null;
  // Un solo interruptor para toda la ventana: o se esta mirando, o se esta
  // cambiando.
  const bloqueado = !puedeEditar || modo === "ver";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 items-center">
        {([...tiposVisibles.map((t) => t.tipo), "todos"] as Filtro[]).map((t) => (
          <button
            key={t}
            onClick={() => setFiltro(t)}
            title={TIPOS_FICHA.find((x) => x.tipo === t)?.nota}
            className={`text-xs font-semibold px-2.5 py-1 rounded border ${
              filtro === t
                ? "bg-verde text-white border-verde"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            {t === "todos" ? "Todas" : ETIQUETA_TIPO[t as TipoFicha]}
            <span className="ml-1 opacity-70">{cuantas[t] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <input
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-80"
          placeholder={`Buscar por nombre, ${etiquetaLista}, contacto o telefono`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
          value={vigencia}
          onChange={(e) => setVigencia(e.target.value as typeof vigencia)}
        >
          <option value="vigentes">Solo vigentes</option>
          <option value="inactivas">Solo inactivas</option>
          <option value="todas">Vigentes e inactivas</option>
        </select>
        <BotonExportar
          nombre="fichas"
          columnas={[
            { titulo: "Razon social", valor: (f) => f.razon_social },
            { titulo: "Nombre corto", valor: (f) => f.nombre_referencia },
            { titulo: "Es", valor: (f) => f.tipos.map((t) => ETIQUETA_TIPO[t]).join(" + ") },
            { titulo: etiquetaLista, valor: (f) => f.rut },
            { titulo: "Contacto", valor: (f) => f.contacto },
            { titulo: "Correo", valor: (f) => f.email },
            { titulo: "Telefono", valor: (f) => f.telefono },
            { titulo: "Direccion", valor: (f) => f.direccion },
            { titulo: "Comuna", valor: (f) => f.comuna },
            { titulo: "Ciudad", valor: (f) => f.ciudad },
          ]}
          filas={filtradas}
        />
        {puedeEditar && (
          <button
            onClick={nueva}
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
          >
            Nueva ficha
          </button>
        )}
      </div>

      {aviso && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs rounded px-3 py-2 flex justify-between">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)}>cerrar</button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2 w-44">Es</th>
                <th className="text-left px-3 py-2 w-28">{etiquetaLista}</th>
                <th className="text-left px-3 py-2">Contacto</th>
                <th className="text-left px-3 py-2 w-32">Telefono</th>
                <th className="text-left px-3 py-2 w-16">Estado</th>
                <th className="w-56" />
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">
                    Sin fichas que coincidan.
                  </td>
                </tr>
              )}
              {filtradas.map((f) => (
                <tr key={f.id_entidad} className="border-t border-gray-100 hover:bg-crema">
                  <td className="px-3 py-2 font-semibold">
                    <BanderaDe idPais={f.id_pais} />
                    <button
                      onClick={() => abrir(f)}
                      className="text-verde underline text-left"
                      title="Ver la ficha completa"
                    >
                      {f.razon_social}
                    </button>
                    {f.nombre_referencia !== f.razon_social && (
                      <span className="block text-[11px] font-normal text-gray-500">
                        {f.nombre_referencia}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {f.tipos.map((t) => (
                        <span
                          key={t}
                          className="bg-crema border border-gray-300 rounded px-1.5 py-0.5 text-[10px]"
                        >
                          {ETIQUETA_TIPO[t]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2">{f.rut}</td>
                  <td className="px-3 py-2">{f.contacto}</td>
                  <td className="px-3 py-2">{f.telefono}</td>
                  <td className="px-3 py-2">
                    {f.activo ? (
                      <span className="text-green-700">Vigente</span>
                    ) : (
                      <span className="text-gray-400">Inactiva</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => abrir(f, "ver")}
                      className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-1 rounded bg-white mr-1"
                    >
                      ver
                    </button>
                    {puedeEditar && (
                      <>
                        <button
                          onClick={() => abrir(f, "editar")}
                          className="bg-verde text-white text-xs font-semibold px-2 py-1 rounded mr-1"
                        >
                          editar
                        </button>
                        <button
                          onClick={() =>
                            empezar(async () => {
                              await cambiarActivoFicha(f.id_entidad, !f.activo);
                            })
                          }
                          className="border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-1 rounded bg-white mr-1"
                          title={
                            f.activo
                              ? "La saca de los selectores sin tocar su historial"
                              : "La devuelve a los selectores"
                          }
                        >
                          {f.activo ? "desactivar" : "activar"}
                        </button>
                        <button
                          onClick={() => setBorrando(f)}
                          className="border border-gray-300 text-red-700 text-xs font-semibold px-2 py-1 rounded bg-white"
                          title="Solo si no tiene cotizaciones ni movimientos"
                        >
                          eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eliminar es lo unico que no se puede deshacer, asi que se pregunta.
          La base rechaza el borrado si la ficha tiene cotizaciones, pedidos o
          movimientos: ahi el camino es desactivarla. */}
      {borrando && (
        <Ventana
          titulo="Eliminar la ficha"
          subtitulo={borrando.razon_social}
          ancho="max-w-md"
          onCerrar={() => setBorrando(null)}
        >
          <p className="text-xs text-gray-700">
            Se elimina la ficha con sus marcas y sus datos bancarios. No se puede
            deshacer.
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Si tiene cotizaciones, pedidos o movimientos detras no se va a poder:
            el historial quedaria sin nombre. Para esas use <strong>desactivar</strong>,
            que la saca de los selectores y deja todo lo demas intacto.
          </p>
          <div className="flex gap-2 justify-end pt-3">
            <button
              className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
              onClick={() => setBorrando(null)}
              disabled={pendiente}
            >
              Cancelar
            </button>
            <button
              className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
              disabled={pendiente}
              onClick={() => {
                const f = borrando;
                setBorrando(null);
                empezar(async () => {
                  const r = await eliminarFicha(f.id_entidad);
                  if (r.error) setResultado({ error: r.error });
                  else setAviso(r.mensaje ?? "Ficha eliminada.");
                });
              }}
            >
              Eliminarla
            </button>
          </div>
        </Ventana>
      )}

      {/* Un error del borrado no tiene ventana propia: se muestra arriba, donde
          se mira la lista. */}
      {resultado?.error && abierta === null && !creando && (
        <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
          {resultado.error}
        </p>
      )}

      {(abierta !== null || creando) && (
        <Ventana
          titulo={
            creando ? "Nueva ficha" : modo === "editar" ? "Modificar ficha" : "Ficha"
          }
          subtitulo={creando ? undefined : form.razon_social}
          onCerrar={cerrar}
        >
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className={ROTULO}>Razon social *</span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.razon_social}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      razon_social: v,
                      // El nombre corto sigue a la razon social mientras nadie
                      // lo escriba distinto: casi nunca hace falta cambiarlo.
                      nombre_referencia:
                        f.nombre_referencia === f.razon_social ? v : f.nombre_referencia,
                    }));
                  }}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>Nombre corto *</span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.nombre_referencia}
                  onChange={(e) =>
                    setForm({ ...form, nombre_referencia: e.target.value })
                  }
                />
                <span className="block text-[11px] text-gray-500 mt-0.5">
                  Como se la nombra aqui dentro: &quot;El Alba&quot;, &quot;Huerta&quot;.
                </span>
              </label>
            </div>

            <fieldset className="border border-gray-200 rounded p-2">
              <legend className="text-xs font-semibold text-dorado-osc px-1">
                Que es esta ficha *
              </legend>
              <div className="grid sm:grid-cols-2 gap-1">
                {tiposVisibles.map((t) => (
                  <label key={t.tipo} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={bloqueado}
                      checked={form.tipos.includes(t.tipo)}
                      onChange={(e) => marcar(t.tipo, e.target.checked)}
                    />
                    <span>
                      {t.texto}
                      <span className="block text-[11px] text-gray-500">{t.nota}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!veFinanzas && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Las demas marcas --proveedor, empleado, socio-- las maneja quien
                  trabaja con la plata.
                </p>
              )}
            </fieldset>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className={ROTULO}>{etiquetaId}</span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.rut}
                  placeholder="12.345.678-9"
                  onChange={(e) => setForm({ ...form, rut: e.target.value })}
                  onBlur={(e) => setForm({ ...form, rut: fmtRut(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>
                  Contacto {form.tipos.includes("cliente") ? "*" : ""}
                </span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.contacto}
                  onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>Correo</span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>
                  Telefono {form.tipos.includes("cliente") ? "*" : ""}
                </span>
                <CampoTelefono
                  valor={form.telefono}
                  onChange={(v) => setForm({ ...form, telefono: v })}
                  prefijo={prefijo}
                  className={CAMPO}
                  disabled={bloqueado}
                  requerido={form.tipos.includes("cliente")}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>Direccion</span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>Comuna</span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.comuna}
                  onChange={(e) => setForm({ ...form, comuna: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className={ROTULO}>
                  Ciudad {form.tipos.includes("cliente") ? "*" : ""}
                </span>
                <input
                  className={CAMPO}
                  disabled={bloqueado}
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                />
              </label>
              {paises.length > 1 && (
                <label className="text-sm">
                  <span className={ROTULO}>Mercado</span>
                  <select
                    className={CAMPO}
                    disabled={!esAdminGeneral || bloqueado}
                    value={form.id_pais ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, id_pais: Number(e.target.value) || null })
                    }
                  >
                    {paises.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {veFinanzas && (
              <fieldset className="border border-gray-200 rounded p-2 space-y-2">
                <legend className="text-xs font-semibold text-dorado-osc px-1">
                  Como se le paga
                </legend>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={bloqueado}
                    checked={form.con_transferencia}
                    onChange={(e) =>
                      setForm({ ...form, con_transferencia: e.target.checked })
                    }
                  />
                  <span>
                    Registrar datos de transferencia
                    <span className="block text-[11px] text-gray-600">
                      Si se activa, el {etiquetaId} y los datos de cada cuenta pasan a
                      ser obligatorios: media ficha bancaria no sirve para pagar.
                    </span>
                  </span>
                </label>

                {form.con_transferencia &&
                  filasBanco.map((c, i) => (
                    <div
                      key={i}
                      className="grid gap-2 sm:grid-cols-4 items-end border border-gray-200 rounded p-2"
                    >
                      <label className="text-sm">
                        <span className={ROTULO}>Banco</span>
                        <input
                          className={CAMPO}
                          disabled={bloqueado}
                          value={c.banco}
                          onChange={(e) =>
                            setFilasBanco((fs) =>
                              fs.map((x, j) =>
                                j === i ? { ...x, banco: e.target.value } : x
                              )
                            )
                          }
                        />
                      </label>
                      <label className="text-sm">
                        <span className={ROTULO}>Tipo</span>
                        <select
                          className={CAMPO}
                          disabled={bloqueado}
                          value={c.tipo_cuenta}
                          onChange={(e) =>
                            setFilasBanco((fs) =>
                              fs.map((x, j) =>
                                j === i ? { ...x, tipo_cuenta: e.target.value } : x
                              )
                            )
                          }
                        >
                          <option value="">Elija</option>
                          {TIPOS_CUENTA.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        <span className={ROTULO}>Numero</span>
                        <input
                          className={CAMPO}
                          disabled={bloqueado}
                          value={c.numero_cuenta}
                          onChange={(e) =>
                            setFilasBanco((fs) =>
                              fs.map((x, j) =>
                                j === i ? { ...x, numero_cuenta: e.target.value } : x
                              )
                            )
                          }
                        />
                      </label>
                      <div className="flex gap-2 items-end">
                        <label className="text-sm flex-1">
                          <span className={ROTULO}>Correo</span>
                          <input
                            type="email"
                            className={CAMPO}
                            disabled={bloqueado}
                            value={c.email}
                            onChange={(e) =>
                              setFilasBanco((fs) =>
                                fs.map((x, j) =>
                                  j === i ? { ...x, email: e.target.value } : x
                                )
                              )
                            }
                          />
                        </label>
                        {filasBanco.length > 1 && !bloqueado && (
                          <button
                            type="button"
                            className="border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded bg-white"
                            onClick={() =>
                              setFilasBanco((fs) => fs.filter((_, j) => j !== i))
                            }
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                {form.con_transferencia && !bloqueado && (
                  <button
                    type="button"
                    className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
                    onClick={() => setFilasBanco((fs) => [...fs, { ...CUENTA_VACIA }])}
                  >
                    Agregar otra cuenta
                  </button>
                )}
              </fieldset>
            )}

            {resultado?.parecidas && resultado.parecidas.length > 0 ? (
              <div className="bg-amber-50 border border-amber-300 rounded px-3 py-2 space-y-1.5">
                <p className="text-xs text-amber-900 font-semibold">{resultado.error}</p>
                <ul className="text-xs text-amber-900 space-y-0.5">
                  {resultado.parecidas.map((x) => (
                    <li key={x.id}>
                      <strong>{x.nombre}</strong>
                      {x.rut ? ` · ${x.rut}` : ""} — {x.motivo}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-900">
                  Si es la misma, cancele y use la que ya existe. Si de verdad es otra
                  --dos personas pueden llamarse igual-- siga adelante.
                </p>
                <button
                  onClick={() => grabar(true)}
                  disabled={pendiente}
                  className="bg-dorado-osc text-white text-xs font-semibold px-2.5 py-1 rounded"
                >
                  Crear de todos modos
                </button>
              </div>
            ) : (
              resultado?.error && (
                <p className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
                  {resultado.error}
                </p>
              )
            )}

            {faltan.length > 0 && (
              <p className="text-xs text-gray-500">
                Falta{faltan.length > 1 ? "n" : ""}: {faltan.join(", ")}.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              {/* Mirando la ficha solo se puede pasar a modificarla; los
                  botones que cambian algo aparecen recien ahi. */}
              {bloqueado && puedeEditar && !creando && (
                <button
                  onClick={() => setModo("editar")}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded"
                >
                  Modificar
                </button>
              )}
              {!bloqueado && (
                <button
                  onClick={() => grabar(false)}
                  disabled={pendiente || faltan.length > 0}
                  className="bg-verde text-white text-xs font-semibold px-3 py-1 rounded disabled:opacity-50"
                >
                  {pendiente ? "Grabando..." : "Grabar"}
                </button>
              )}
              <button
                onClick={cerrar}
                className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
              >
                Cerrar
              </button>
            </div>

            {laAbierta && <Bitacora tabla="entidades" id={laAbierta.id_entidad} />}

            {/* Juntar dos fichas repetidas. Va al final y aparte: mueve
                cotizaciones, pedidos y movimientos de una a la otra y no se
                deshace. */}
            {laAbierta && puedeJuntar && !bloqueado && (
              <div className="border-t border-gray-200 pt-2 space-y-1.5">
                <p className="text-xs font-semibold text-dorado-osc">
                  Esta ficha esta repetida
                </p>
                <p className="text-[11px] text-gray-600">
                  Elija la otra: sus cotizaciones, pedidos y movimientos pasan a esta, y
                  esta se queda con lo que la otra tenga y a ella le falte. La otra
                  desaparece y no se puede deshacer.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white max-w-md"
                    value={juntarCon}
                    onChange={(e) =>
                      setJuntarCon(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">-- la otra ficha --</option>
                    {fichas
                      .filter(
                        (x) =>
                          x.id_entidad !== laAbierta.id_entidad &&
                          x.id_pais === laAbierta.id_pais
                      )
                      .map((x) => (
                        <option key={x.id_entidad} value={x.id_entidad}>
                          {x.razon_social}
                          {x.rut ? ` · ${x.rut}` : ""}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={juntarCon === "" || pendiente}
                    onClick={() =>
                      empezar(async () => {
                        const r = await juntarFichas(laAbierta.id_entidad, Number(juntarCon));
                        if (r.error) setResultado({ error: r.error });
                        else {
                          setAviso(r.mensaje ?? "Fichas juntadas.");
                          cerrar();
                        }
                      })
                    }
                    className="bg-dorado-osc text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
                  >
                    Juntarlas
                  </button>
                </div>
              </div>
            )}
          </div>
        </Ventana>
      )}
    </div>
  );
}
