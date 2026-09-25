"use client";

import { useActionState, useEffect, useState } from "react";
import {
  guardarInterlocutor,
  type ResultadoInterlocutor,
} from "@/app/mantenedores/acciones";
import type { CuentaInterlocutor, Interlocutor } from "@/lib/finanzas/tipos";

const TIPOS_CUENTA = [
  "Cuenta Corriente",
  "Cuenta Vista",
  "Cuenta de Ahorro",
  "Cuenta RUT",
] as const;

type FilaCuenta = {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  email: string;
};

const CUENTA_VACIA: FilaCuenta = {
  banco: "",
  tipo_cuenta: "",
  numero_cuenta: "",
  email: "",
};

const CAMPO = "border border-gray-300 rounded px-2 py-1 text-xs w-full bg-white";
const ROTULO = "block text-xs font-semibold text-dorado-osc mb-0.5";

// Ficha de la persona u organizacion que nos deposita o a la que pagamos. Se
// usa tal cual en el panel de listas y dentro del alta de un ingreso o un
// egreso: el mismo formulario y las mismas reglas en los dos sitios, para que
// no puedan separarse.
export default function FormularioInterlocutor({
  interlocutor,
  cuentas,
  nombreSugerido,
  alGuardar,
  alCancelar,
}: {
  interlocutor: Interlocutor | null;
  cuentas: CuentaInterlocutor[];
  nombreSugerido?: string;
  alGuardar: (id: number, nombre: string, mensaje?: string) => void;
  alCancelar?: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<
    ResultadoInterlocutor | null,
    FormData
  >(guardarInterlocutor, null);

  const [conTransferencia, setConTransferencia] = useState(
    interlocutor?.con_transferencia ?? false
  );
  const [filas, setFilas] = useState<FilaCuenta[]>(
    cuentas.length > 0
      ? cuentas.map((c) => ({
          banco: c.banco,
          tipo_cuenta: c.tipo_cuenta,
          numero_cuenta: c.numero_cuenta,
          email: c.email,
        }))
      : [{ ...CUENTA_VACIA }]
  );

  useEffect(() => {
    if (estado?.ok && estado.id_interlocutor)
      alGuardar(
        estado.id_interlocutor,
        estado.nombre_referencia ?? "",
        estado.mensaje
      );
  }, [estado, alGuardar]);

  const cambiar = (i: number, campo: keyof FilaCuenta, valor: string) =>
    setFilas((f) => f.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-2">
      {interlocutor && (
        <input
          type="hidden"
          name="id_interlocutor"
          value={interlocutor.id_interlocutor}
        />
      )}

      <div>
        <label className={ROTULO}>Razon social *</label>
        <input
          name="razon_social"
          className={CAMPO}
          defaultValue={interlocutor?.razon_social ?? nombreSugerido ?? ""}
          maxLength={160}
          required
          autoFocus={!interlocutor}
        />
      </div>

      <div>
        <label className={ROTULO}>Nombre de referencia *</label>
        <input
          name="nombre_referencia"
          className={CAMPO}
          defaultValue={interlocutor?.nombre_referencia ?? nombreSugerido ?? ""}
          maxLength={120}
          required
        />
      </div>

      <div>
        <label className={ROTULO}>RUT</label>
        <input
          name="rut"
          className={CAMPO}
          defaultValue={interlocutor?.rut ?? ""}
          maxLength={20}
        />
      </div>

      <label className="sm:col-span-2 flex items-start gap-2 text-xs bg-crema border border-gray-200 rounded px-3 py-2">
        <input
          type="checkbox"
          name="con_transferencia"
          className="mt-0.5"
          checked={conTransferencia}
          onChange={(e) => setConTransferencia(e.target.checked)}
        />
        <span>
          Registrar datos de transferencia
          <span className="block text-[11px] text-gray-600">
            Si se activa, el RUT y los datos de cada cuenta pasan a ser
            obligatorios: media ficha bancaria no sirve para pagar.
          </span>
        </span>
      </label>

      {conTransferencia && (
        <div className="sm:col-span-2 space-y-2">
          {filas.map((c, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-4 items-end border border-gray-200 rounded p-2"
            >
              <div>
                <label className={ROTULO}>Banco</label>
                <input
                  name="cta_banco"
                  className={CAMPO}
                  value={c.banco}
                  onChange={(e) => cambiar(i, "banco", e.target.value)}
                />
              </div>
              <div>
                <label className={ROTULO}>Tipo</label>
                <select
                  name="cta_tipo"
                  className={CAMPO}
                  value={c.tipo_cuenta}
                  onChange={(e) => cambiar(i, "tipo_cuenta", e.target.value)}
                >
                  <option value="">Elija</option>
                  {TIPOS_CUENTA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ROTULO}>Numero</label>
                <input
                  name="cta_numero"
                  className={CAMPO}
                  value={c.numero_cuenta}
                  onChange={(e) => cambiar(i, "numero_cuenta", e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={ROTULO}>Correo</label>
                  <input
                    name="cta_email"
                    type="email"
                    className={CAMPO}
                    value={c.email}
                    onChange={(e) => cambiar(i, "email", e.target.value)}
                  />
                </div>
                {filas.length > 1 && (
                  <button
                    type="button"
                    className="border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded bg-white"
                    onClick={() => setFilas((f) => f.filter((_, j) => j !== i))}
                    title="Quitar esta cuenta"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
            onClick={() => setFilas((f) => [...f, { ...CUENTA_VACIA }])}
          >
            Agregar otra cuenta
          </button>
        </div>
      )}

      {estado && !estado.ok && (
        <p className="sm:col-span-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
          {estado.mensaje}
        </p>
      )}

      <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
        {alCancelar && (
          <button
            type="button"
            className="border border-gray-300 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded bg-white"
            onClick={alCancelar}
            disabled={pendiente}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-50"
          disabled={pendiente}
        >
          {pendiente ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
