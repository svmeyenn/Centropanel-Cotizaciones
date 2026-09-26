"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Ventana from "@/components/Ventana";
import {
  borrarBoleta,
  guardarBoleta,
  listarRespaldosBoleta,
  quitarRespaldoBoleta,
  type Resultado,
} from "@/app/rendiciones/acciones";
import {
  PROYECTO_GENERICO,
  type BoletaRendicion,
  type Categoria,
  type Proyecto,
  type RespaldoBoleta,
} from "@/lib/finanzas/tipos";

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";
const BOTON_CLARO =
  "border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white";

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

// Una boleta de la rendicion: lo que dice el comprobante, mas el comprobante
// mismo. Sin foto o archivo no se guarda: una boleta sin respaldo no respalda
// nada.
export default function FormularioBoleta({
  idRendicion,
  periodoDesde,
  periodoHasta,
  boleta,
  categorias,
  proyectos,
  lecturaDisponible,
  alCerrar,
}: {
  idRendicion: number;
  periodoDesde: string;
  periodoHasta: string;
  boleta: BoletaRendicion | null;
  categorias: Categoria[];
  proyectos: Proyecto[];
  // Sin clave del modelo configurada el boton de leer no aparece.
  lecturaDisponible: boolean;
  alCerrar: (mensaje?: string) => void;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado | null, FormData>(
    guardarBoleta,
    null
  );
  const [enCurso, comenzar] = useTransition();
  const [aviso, setAviso] = useState("");
  const [respaldos, setRespaldos] = useState<
    (RespaldoBoleta & { url: string | null })[]
  >([]);
  const [borrando, setBorrando] = useState(false);

  // --- lectura automatica de la foto ---
  //
  // Lo que devuelve el modelo llena el formulario y nada mas: la persona
  // confirma antes de guardar.
  const formulario = useRef<HTMLFormElement>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [avisoLectura, setAvisoLectura] = useState("");

  async function leerFoto() {
    if (!foto || !formulario.current) return;
    setLeyendo(true);
    setAvisoLectura("");

    try {
      const cuerpo = new FormData();
      cuerpo.append("foto", foto);
      const respuesta = await fetch("/api/leer-boleta", {
        method: "POST",
        body: cuerpo,
      });
      const r = await respuesta.json();

      if (!r.ok) {
        setAvisoLectura(r.mensaje ?? "No se pudo leer la boleta.");
        return;
      }

      const campos = formulario.current.elements as typeof formulario.current.elements & {
        fecha: HTMLInputElement;
        monto: HTMLInputElement;
        comercio: HTMLInputElement;
        documento: HTMLInputElement;
      };

      const leidos: string[] = [];
      if (r.boleta.fecha) {
        campos.fecha.value = r.boleta.fecha;
        leidos.push("fecha");
      }
      if (r.boleta.monto !== null) {
        campos.monto.value = String(r.boleta.monto);
        leidos.push("monto");
      }
      if (r.boleta.comercio) {
        campos.comercio.value = r.boleta.comercio;
        leidos.push("comercio");
      }
      if (r.boleta.documento) {
        campos.documento.value = r.boleta.documento;
        leidos.push("numero");
      }

      setAvisoLectura(
        leidos.length
          ? `Lei ${leidos.join(", ")}. Revise antes de guardar: falta elegir categoria y proyecto.`
          : "No se distinguio ningun dato. Escribalos a mano."
      );
    } catch {
      setAvisoLectura("No se pudo leer la boleta. Escriba los datos a mano.");
    } finally {
      setLeyendo(false);
    }
  }

  useEffect(() => {
    if (estado?.ok) alCerrar(estado.mensaje);
  }, [estado, alCerrar]);

  // Los respaldos ya cargados se piden al abrir: son los que dan derecho a
  // quitar uno solo si queda otro en su lugar.
  useEffect(() => {
    if (!boleta) return;
    let vigente = true;
    listarRespaldosBoleta(boleta.id_gasto).then((r) => {
      if (vigente && r.ok) setRespaldos(r.respaldos);
    });
    return () => {
      vigente = false;
    };
  }, [boleta]);

  const disponibles = proyectos.filter(
    (p) => (p.activo && !p.borrado) || p.id_proyecto === boleta?.id_proyecto
  );
  const generico = disponibles.find((p) => p.nombre === PROYECTO_GENERICO);

  const [idProyecto, setIdProyecto] = useState<string>(
    boleta ? String(boleta.id_proyecto ?? "") : ""
  );
  const esGenerico = !!generico && idProyecto === String(generico.id_proyecto);

  const propias = categorias.filter(
    (c) =>
      c.tipo === "Egreso" && (!c.borrado || c.id_categoria === boleta?.id_categoria)
  );

  function quitarRespaldo(r: RespaldoBoleta) {
    comenzar(async () => {
      const res = await quitarRespaldoBoleta(r.id_rend_adjunto, r.ruta);
      setAviso(res.mensaje ?? "");
      if (res.ok)
        setRespaldos((prev) =>
          prev.filter((x) => x.id_rend_adjunto !== r.id_rend_adjunto)
        );
    });
  }

  function eliminar() {
    if (!boleta) return;
    comenzar(async () => {
      const r = await borrarBoleta(boleta.id_gasto);
      if (r.ok) alCerrar(r.mensaje);
      else {
        setBorrando(false);
        setAviso(r.mensaje ?? "");
      }
    });
  }

  return (
    <Ventana
      titulo={boleta ? "Editar boleta" : "Nueva boleta"}
      subtitulo={`Del periodo ${periodoDesde} al ${periodoHasta}`}
      onCerrar={() => alCerrar()}
      ancho="max-w-3xl"
    >
      <form ref={formulario} action={enviar} className="grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="id_rendicion" value={idRendicion} />
        {boleta && (
          <input type="hidden" name="id_gasto" value={boleta.id_gasto} />
        )}

        <div>
          <label className={ROTULO}>Fecha *</label>
          <input
            type="date"
            name="fecha"
            className={CAMPO}
            defaultValue={boleta?.fecha?.slice(0, 10) ?? hoy()}
            required
          />
        </div>

        <div>
          <label className={ROTULO}>Monto *</label>
          <input
            name="monto"
            className={CAMPO}
            inputMode="numeric"
            defaultValue={boleta ? String(boleta.monto) : ""}
            placeholder="12.500"
            required
          />
        </div>

        <div>
          <label className={ROTULO}>N de boleta *</label>
          <input
            name="documento"
            className={CAMPO}
            defaultValue={boleta?.documento ?? ""}
            placeholder="S/N si no tiene"
            maxLength={40}
            required
          />
        </div>

        <div className="sm:col-span-3">
          <label className={ROTULO}>Comercio *</label>
          <input
            name="comercio"
            className={CAMPO}
            defaultValue={boleta?.comercio ?? ""}
            maxLength={120}
            required
          />
        </div>

        <div>
          <label className={ROTULO}>Categoria *</label>
          <select
            name="id_categoria"
            className={CAMPO}
            defaultValue={boleta?.id_categoria ?? ""}
            required
          >
            <option value="">Elija</option>
            {propias.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={ROTULO}>Proyecto *</label>
          <select
            name="id_proyecto"
            className={CAMPO}
            value={idProyecto}
            onChange={(e) => setIdProyecto(e.target.value)}
            required
          >
            <option value="">Elija</option>
            {disponibles.map((p) => (
              <option key={p.id_proyecto} value={p.id_proyecto}>
                {p.nombre}
                {p.cliente ? ` - ${p.cliente}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label className={ROTULO}>
            Comentario {esGenerico && "*"}
          </label>
          <input
            name="comentario"
            className={CAMPO}
            defaultValue={boleta?.comentario ?? ""}
            maxLength={300}
            required={esGenerico}
          />
          {esGenerico && (
            <p className="text-[11px] text-gray-600 mt-0.5">
              Con el proyecto &laquo;{PROYECTO_GENERICO}&raquo; hay que explicar
              de que se trata el gasto.
            </p>
          )}
        </div>

        <div className="sm:col-span-3">
          <label className={ROTULO}>
            Foto o archivo de la boleta {boleta ? "" : "*"}
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="file"
              name="fotos"
              className={`${CAMPO} flex-1`}
              multiple
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) =>
                setFoto(
                  Array.from(e.target.files ?? []).find((f) =>
                    f.type.startsWith("image/")
                  ) ?? null
                )
              }
            />
            {lecturaDisponible && foto && (
              <button
                type="button"
                className={BOTON_CLARO}
                onClick={leerFoto}
                disabled={leyendo}
              >
                {leyendo ? "Leyendo..." : "Leer la foto"}
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {boleta
              ? "Lo que suba se agrega a los respaldos que ya tiene."
              : "Puede sacarle la foto ahi mismo, en terreno."}
            {lecturaDisponible &&
              " Con la foto cargada, «Leer la foto» completa fecha, monto, comercio y numero."}
          </p>
          {avisoLectura && (
            <p className="text-[11px] bg-crema border border-gray-200 rounded px-2 py-1 mt-1">
              {avisoLectura}
            </p>
          )}
        </div>

        {respaldos.length > 0 && (
          <div className="sm:col-span-3 border border-gray-200 rounded divide-y divide-gray-100">
            {respaldos.map((r) => (
              <div
                key={r.id_rend_adjunto}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
              >
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-verde font-semibold underline truncate"
                  >
                    {r.nombre}
                  </a>
                ) : (
                  <span className="truncate">{r.nombre}</span>
                )}
                <button
                  type="button"
                  className={BOTON_CLARO}
                  onClick={() => quitarRespaldo(r)}
                  disabled={enCurso}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        {(aviso || (estado && !estado.ok)) && (
          <p
            className={`sm:col-span-3 text-xs rounded px-3 py-2 border ${
              estado && !estado.ok
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-crema border-gray-200 text-gray-700"
            }`}
          >
            {estado && !estado.ok ? estado.mensaje : aviso}
          </p>
        )}

        <div className="sm:col-span-3 flex gap-2 justify-end pt-1">
          {boleta && !borrando && (
            <button
              type="button"
              className={`${BOTON_CLARO} text-red-700 mr-auto`}
              onClick={() => setBorrando(true)}
              disabled={pendiente || enCurso}
            >
              Eliminar boleta
            </button>
          )}
          {boleta && borrando && (
            <span className="mr-auto flex items-center gap-2 text-xs text-red-700">
              Se elimina con sus respaldos.
              <button
                type="button"
                className="bg-red-700 text-white text-xs font-semibold px-2.5 py-1 rounded"
                onClick={eliminar}
                disabled={enCurso}
              >
                Confirmar
              </button>
              <button
                type="button"
                className={BOTON_CLARO}
                onClick={() => setBorrando(false)}
                disabled={enCurso}
              >
                No
              </button>
            </span>
          )}

          <button
            type="button"
            className={BOTON_CLARO}
            onClick={() => alCerrar()}
            disabled={pendiente}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
            disabled={pendiente}
          >
            {pendiente ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
