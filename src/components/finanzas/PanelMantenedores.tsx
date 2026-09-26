"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Ventana from "@/components/Ventana";
import BotonExportarFilas from "@/components/BotonExportarFilas";
import { pesos } from "@/lib/formato";
import {
  borrarCategoria,
  borrarInterlocutor,
  borrarProyecto,
  guardarCategoria,
  guardarCuenta,
  guardarProyecto,
} from "@/app/mantenedores/acciones";
import {
  buscarInterlocutores,
  etiquetaInterlocutor,
  type Categoria,
  type Cuenta,
  type CuentaInterlocutor,
  type Interlocutor,
  type Proyecto,
} from "@/lib/finanzas/tipos";
import FormularioInterlocutor from "./FormularioInterlocutor";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON = "bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded bg-white whitespace-nowrap";

type Pestana = "Cuentas" | "Proyectos" | "Categorias" | "Interlocutores";
const PESTANAS: Pestana[] = [
  "Cuentas",
  "Proyectos",
  "Categorias",
  "Interlocutores",
];

// Las listas con que se clasifica cada movimiento. Nada se borra de verdad:
// lo eliminado desaparece de los selectores pero los movimientos que ya lo
// usaban siguen mostrando su nombre.
export default function PanelMantenedores({
  cuentas,
  proyectos,
  categorias,
  interlocutores,
  cuentasInterlocutores,
  moneda,
  mercados,
}: {
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
  cuentasInterlocutores: CuentaInterlocutor[];
  moneda: string;
  // Quien trabaja los dos paises ve las listas de ambos: sin decir de cual es
  // cada fila, las doce categorias de Chile y las doce de Peru parecen doce
  // duplicadas.
  mercados: { id: number; codigo: string }[];
}) {
  const router = useRouter();
  const variosMercados = mercados.length > 1;
  const codigoPais = (id: number) =>
    mercados.find((m) => m.id === id)?.codigo ?? "";
  const celdaMercado = (id: number) =>
    variosMercados ? (
      <td className="px-3 py-2 text-gray-500">{codigoPais(id)}</td>
    ) : null;

  const [pestana, setPestana] = useState<Pestana>("Cuentas");
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  const [editandoCuenta, setEditandoCuenta] = useState<Cuenta | null>(null);
  const [editandoProyecto, setEditandoProyecto] = useState<Proyecto | null>(null);
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [editandoInter, setEditandoInter] = useState<Interlocutor | null>(null);
  const [creando, setCreando] = useState(false);
  const [confirmando, setConfirmando] = useState<{
    texto: string;
    accion: () => Promise<{ ok: boolean; mensaje?: string }>;
  } | null>(null);

  function correr(fn: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setError("");
    empezar(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.mensaje ?? "No se pudo completar.");
        return;
      }
      if (r.mensaje) setAviso(r.mensaje);
      setConfirmando(null);
      router.refresh();
    });
  }

  const q = busca.trim().toLowerCase();
  const cuentasFiltradas = useMemo(
    () =>
      cuentas.filter(
        (c) =>
          !q ||
          `${c.banco} ${c.alias ?? ""} ${c.titular ?? ""} ${c.numero_cuenta ?? ""}`
            .toLowerCase()
            .includes(q)
      ),
    [cuentas, q]
  );
  const proyectosFiltrados = useMemo(
    () =>
      proyectos.filter(
        (p) =>
          !p.borrado &&
          (!q || `${p.nombre} ${p.cliente ?? ""}`.toLowerCase().includes(q))
      ),
    [proyectos, q]
  );
  const categoriasFiltradas = useMemo(
    () =>
      categorias.filter(
        (c) => !c.borrado && (!q || c.nombre.toLowerCase().includes(q))
      ),
    [categorias, q]
  );
  const interFiltrados = useMemo(
    () => buscarInterlocutores(interlocutores.filter((i) => !i.borrado), busca),
    [interlocutores, busca]
  );

  const cuentasDe = (id: number) =>
    cuentasInterlocutores.filter((c) => c.id_interlocutor === id);

  const filasExcel: Record<Pestana, (string | number | null)[][]> = {
    Cuentas: cuentasFiltradas.map((c) => [
      c.banco,
      c.alias ?? "",
      c.numero_cuenta ?? "",
      c.titular ?? "",
      c.moneda ?? "",
      Number(c.saldo_inicial),
      c.activa ? "Vigente" : "Inactiva",
    ]),
    Proyectos: proyectosFiltrados.map((p) => [
      p.nombre,
      p.cliente ?? "",
      p.activo ? "Vigente" : "Inactivo",
    ]),
    Categorias: categoriasFiltradas.map((c) => [c.nombre, c.tipo]),
    Interlocutores: interFiltrados.map((i) => [
      i.razon_social,
      i.nombre_referencia,
      i.rut ?? "",
      i.con_transferencia ? "Si" : "No",
      cuentasDe(i.id_interlocutor).length,
    ]),
  };

  const titulosExcel: Record<Pestana, string[]> = {
    Cuentas: ["Banco", "Alias", "Numero", "Titular", "Moneda", "Saldo inicial", "Estado"],
    Proyectos: ["Proyecto", "Cliente", "Estado"],
    Categorias: ["Categoria", "Tipo"],
    Interlocutores: ["Razon social", "Nombre de referencia", "RUT", "Transferencia", "Cuentas"],
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {PESTANAS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPestana(p);
                setBusca("");
              }}
              className={`text-xs font-semibold px-3 py-1 rounded ${
                pestana === p
                  ? "bg-verde text-white"
                  : "border border-gray-300 text-gray-700 bg-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <input
          className={`${CAMPO} max-w-xs`}
          placeholder="Buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <div className="ml-auto flex gap-2">
          <BotonExportarFilas
            nombre={pestana.toLowerCase()}
            titulos={titulosExcel[pestana]}
            filas={filasExcel[pestana]}
          />
          <button className={BOTON} onClick={() => setCreando(true)}>
            Nueva {pestana.slice(0, -2).toLowerCase()}
            {pestana === "Cuentas" || pestana === "Categorias" ? "a" : ""}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2">
          {error}
        </div>
      )}
      {aviso && (
        <div className="bg-white border border-gray-200 text-gray-700 text-xs rounded p-2">
          {aviso}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-verde text-white">
              <tr>
                {pestana === "Cuentas" && (
                  <>
                    {variosMercados && (
                      <th className="text-left px-3 py-2 w-20">Mercado</th>
                    )}
                    <th className="text-left px-3 py-2">Banco</th>
                    <th className="text-left px-3 py-2">Alias</th>
                    <th className="text-left px-3 py-2">Numero</th>
                    <th className="text-left px-3 py-2">Titular</th>
                    <th className="text-left px-3 py-2 w-24">Moneda</th>
                    <th className="text-right px-3 py-2 w-36">Saldo inicial</th>
                    <th className="text-left px-3 py-2 w-24">Estado</th>
                  </>
                )}
                {pestana === "Proyectos" && (
                  <>
                    {variosMercados && (
                      <th className="text-left px-3 py-2 w-20">Mercado</th>
                    )}
                    <th className="text-left px-3 py-2">Proyecto</th>
                    <th className="text-left px-3 py-2">Cliente</th>
                    <th className="text-left px-3 py-2 w-24">Estado</th>
                  </>
                )}
                {pestana === "Categorias" && (
                  <>
                    {variosMercados && (
                      <th className="text-left px-3 py-2 w-20">Mercado</th>
                    )}
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-left px-3 py-2 w-32">Tipo</th>
                  </>
                )}
                {pestana === "Interlocutores" && (
                  <>
                    {variosMercados && (
                      <th className="text-left px-3 py-2 w-20">Mercado</th>
                    )}
                    <th className="text-left px-3 py-2">Razon social</th>
                    <th className="text-left px-3 py-2">Nombre de referencia</th>
                    <th className="text-left px-3 py-2 w-32">RUT</th>
                    <th className="text-left px-3 py-2 w-28">Cuentas</th>
                  </>
                )}
                <th className="px-3 py-2 w-32" />
              </tr>
            </thead>
            <tbody>
              {pestana === "Cuentas" &&
                cuentasFiltradas.map((c) => (
                  <tr key={c.id_cuenta} className="border-t border-gray-100 hover:bg-crema">
                    {celdaMercado(c.id_pais)}
                    <td className="px-3 py-2">{c.banco}</td>
                    <td className="px-3 py-2">{c.alias}</td>
                    <td className="px-3 py-2 text-gray-600">{c.numero_cuenta}</td>
                    <td className="px-3 py-2 text-gray-600">{c.titular}</td>
                    <td className="px-3 py-2 text-gray-600">{c.moneda}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pesos(c.saldo_inicial)}
                    </td>
                    <td className="px-3 py-2">
                      {c.activa ? (
                        <span className="text-verde font-semibold">Vigente</span>
                      ) : (
                        <span className="text-gray-500">Inactiva</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className={BOTON_CLARO} onClick={() => setEditandoCuenta(c)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}

              {pestana === "Proyectos" &&
                proyectosFiltrados.map((p) => (
                  <tr key={p.id_proyecto} className="border-t border-gray-100 hover:bg-crema">
                    {celdaMercado(p.id_pais)}
                    <td className="px-3 py-2">{p.nombre}</td>
                    <td className="px-3 py-2 text-gray-600">{p.cliente}</td>
                    <td className="px-3 py-2">
                      {p.activo ? (
                        <span className="text-verde font-semibold">Vigente</span>
                      ) : (
                        <span className="text-gray-500">Inactivo</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 justify-end">
                        <button className={BOTON_CLARO} onClick={() => setEditandoProyecto(p)}>
                          Editar
                        </button>
                        <button
                          className={BOTON_CLARO}
                          onClick={() =>
                            setConfirmando({
                              texto: `Se elimina el proyecto "${p.nombre}". Los movimientos que lo usaban lo conservan.`,
                              accion: () => borrarProyecto(p.id_proyecto),
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {pestana === "Categorias" &&
                categoriasFiltradas.map((c) => (
                  <tr key={c.id_categoria} className="border-t border-gray-100 hover:bg-crema">
                    {celdaMercado(c.id_pais)}
                    <td className="px-3 py-2">{c.nombre}</td>
                    <td className="px-3 py-2 text-gray-600">{c.tipo}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 justify-end">
                        <button className={BOTON_CLARO} onClick={() => setEditandoCategoria(c)}>
                          Editar
                        </button>
                        <button
                          className={BOTON_CLARO}
                          onClick={() =>
                            setConfirmando({
                              texto: `Se elimina la categoria "${c.nombre}". Los movimientos que la usaban la conservan.`,
                              accion: () => borrarCategoria(c.id_categoria),
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {pestana === "Interlocutores" &&
                interFiltrados.map((i) => (
                  <tr
                    key={i.id_interlocutor}
                    className="border-t border-gray-100 hover:bg-crema"
                  >
                    {celdaMercado(i.id_pais)}
                    <td className="px-3 py-2">{i.razon_social}</td>
                    <td className="px-3 py-2">{i.nombre_referencia}</td>
                    <td className="px-3 py-2 text-gray-600">{i.rut}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {i.con_transferencia
                        ? `${cuentasDe(i.id_interlocutor).length} cuenta(s)`
                        : "sin transferencia"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 justify-end">
                        <button className={BOTON_CLARO} onClick={() => setEditandoInter(i)}>
                          Editar
                        </button>
                        <button
                          className={BOTON_CLARO}
                          onClick={() =>
                            setConfirmando({
                              texto: `Se elimina a "${etiquetaInterlocutor(i.razon_social, i.nombre_referencia)}". Los movimientos que lo usaban lo conservan.`,
                              accion: () => borrarInterlocutor(i.id_interlocutor),
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {((pestana === "Cuentas" && cuentasFiltradas.length === 0) ||
                (pestana === "Proyectos" && proyectosFiltrados.length === 0) ||
                (pestana === "Categorias" && categoriasFiltradas.length === 0) ||
                (pestana === "Interlocutores" && interFiltrados.length === 0)) && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8">
                    {busca
                      ? "Nada coincide con la busqueda."
                      : "Todavia no hay nada en esta lista."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(creando || editandoCuenta) && pestana === "Cuentas" && (
        <FichaSimple
          titulo={editandoCuenta ? "Editar cuenta" : "Nueva cuenta"}
          onCerrar={() => {
            setCreando(false);
            setEditandoCuenta(null);
          }}
          accion={guardarCuenta}
          alGuardar={(m) => {
            setAviso(m);
            setCreando(false);
            setEditandoCuenta(null);
            router.refresh();
          }}
        >
          {editandoCuenta && (
            <input type="hidden" name="id_cuenta" value={editandoCuenta.id_cuenta} />
          )}
          <div>
            <label className={ROTULO}>Banco *</label>
            <input name="banco" className={CAMPO} defaultValue={editandoCuenta?.banco ?? ""} required />
          </div>
          <div>
            <label className={ROTULO}>Alias</label>
            <input name="alias" className={CAMPO} defaultValue={editandoCuenta?.alias ?? ""} />
          </div>
          <div>
            <label className={ROTULO}>Numero de cuenta</label>
            <input
              name="numero_cuenta"
              className={CAMPO}
              defaultValue={editandoCuenta?.numero_cuenta ?? ""}
            />
          </div>
          <div>
            <label className={ROTULO}>Titular</label>
            <input name="titular" className={CAMPO} defaultValue={editandoCuenta?.titular ?? ""} />
          </div>
          <div>
            <label className={ROTULO}>Moneda</label>
            <input
              name="moneda"
              className={CAMPO}
              defaultValue={editandoCuenta?.moneda ?? moneda}
            />
          </div>
          <div>
            <label className={ROTULO}>Saldo inicial</label>
            <input
              name="saldo_inicial"
              inputMode="decimal"
              className={CAMPO}
              defaultValue={String(editandoCuenta?.saldo_inicial ?? 0)}
            />
            <p className="text-[11px] text-gray-600 mt-0.5">
              Lo que habia en la cuenta antes del primer movimiento cargado. Sin
              esto, la cartola arrastra un saldo que no es el del banco.
            </p>
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="activa"
              defaultChecked={editandoCuenta?.activa ?? true}
            />
            Vigente: se ofrece al cargar movimientos
          </label>
        </FichaSimple>
      )}

      {(creando || editandoProyecto) && pestana === "Proyectos" && (
        <FichaSimple
          titulo={editandoProyecto ? "Editar proyecto" : "Nuevo proyecto"}
          onCerrar={() => {
            setCreando(false);
            setEditandoProyecto(null);
          }}
          accion={guardarProyecto}
          alGuardar={(m) => {
            setAviso(m);
            setCreando(false);
            setEditandoProyecto(null);
            router.refresh();
          }}
        >
          {editandoProyecto && (
            <input type="hidden" name="id_proyecto" value={editandoProyecto.id_proyecto} />
          )}
          <div>
            <label className={ROTULO}>Nombre *</label>
            <input
              name="nombre"
              className={CAMPO}
              defaultValue={editandoProyecto?.nombre ?? ""}
              required
            />
          </div>
          <div>
            <label className={ROTULO}>Cliente</label>
            <input
              name="cliente"
              className={CAMPO}
              defaultValue={editandoProyecto?.cliente ?? ""}
            />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={editandoProyecto?.activo ?? true}
            />
            Vigente: se ofrece al clasificar movimientos
          </label>
        </FichaSimple>
      )}

      {(creando || editandoCategoria) && pestana === "Categorias" && (
        <FichaSimple
          titulo={editandoCategoria ? "Editar categoria" : "Nueva categoria"}
          onCerrar={() => {
            setCreando(false);
            setEditandoCategoria(null);
          }}
          accion={guardarCategoria}
          alGuardar={(m) => {
            setAviso(m);
            setCreando(false);
            setEditandoCategoria(null);
            router.refresh();
          }}
        >
          {editandoCategoria && (
            <input type="hidden" name="id_categoria" value={editandoCategoria.id_categoria} />
          )}
          <div>
            <label className={ROTULO}>Nombre *</label>
            <input
              name="nombre"
              className={CAMPO}
              defaultValue={editandoCategoria?.nombre ?? ""}
              required
            />
          </div>
          <div>
            <label className={ROTULO}>Tipo</label>
            <select
              name="tipo"
              className={CAMPO}
              defaultValue={editandoCategoria?.tipo ?? "Egreso"}
            >
              <option value="Egreso">Egreso</option>
              <option value="Ingreso">Ingreso</option>
            </select>
          </div>
        </FichaSimple>
      )}

      {(creando || editandoInter) && pestana === "Interlocutores" && (
        <Ventana
          titulo={editandoInter ? "Editar interlocutor" : "Nuevo interlocutor"}
          subtitulo="A quien le pagamos o quien nos deposita"
          onCerrar={() => {
            setCreando(false);
            setEditandoInter(null);
          }}
          ancho="max-w-3xl"
        >
          <FormularioInterlocutor
            interlocutor={editandoInter}
            cuentas={editandoInter ? cuentasDe(editandoInter.id_interlocutor) : []}
            alCancelar={() => {
              setCreando(false);
              setEditandoInter(null);
            }}
            alGuardar={(_id, _nombre, mensaje) => {
              setCreando(false);
              setEditandoInter(null);
              if (mensaje) setAviso(mensaje);
              router.refresh();
            }}
          />
        </Ventana>
      )}

      {confirmando && (
        <Ventana
          titulo="Confirmar"
          onCerrar={() => setConfirmando(null)}
          ancho="max-w-sm"
        >
          <p className="text-xs text-gray-700 mb-4">{confirmando.texto}</p>
          <div className="flex gap-2 justify-end">
            <button
              className={BOTON_CLARO}
              onClick={() => setConfirmando(null)}
              disabled={pendiente}
            >
              Cancelar
            </button>
            <button
              className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
              onClick={() => correr(confirmando.accion)}
              disabled={pendiente}
            >
              {pendiente ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </Ventana>
      )}
    </div>
  );
}

// Ficha de las listas cortas --cuenta, proyecto, categoria--: todas son el
// mismo formulario con distintos campos, asi que comparten el envoltorio.
function FichaSimple({
  titulo,
  onCerrar,
  accion,
  alGuardar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  accion: (
    previo: { ok: boolean; mensaje?: string } | null,
    datos: FormData
  ) => Promise<{ ok: boolean; mensaje?: string }>;
  alGuardar: (mensaje: string) => void;
  children: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();

  return (
    <Ventana titulo={titulo} onCerrar={onCerrar} ancho="max-w-xl">
      <form
        action={(datos: FormData) => {
          setError("");
          empezar(async () => {
            const r = await accion(null, datos);
            if (!r.ok) {
              setError(r.mensaje ?? "No se pudo guardar.");
              return;
            }
            alGuardar(r.mensaje ?? "Guardado.");
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        {children}

        {error && (
          <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
          <button
            type="button"
            className={BOTON_CLARO}
            onClick={onCerrar}
            disabled={pendiente}
          >
            Cancelar
          </button>
          <button type="submit" className={BOTON} disabled={pendiente}>
            {pendiente ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
