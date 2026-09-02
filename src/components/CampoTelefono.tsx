"use client";

import { telefono as fmtTelefono, telefonoValido } from "@/lib/formato";

// Telefono con codigo de area obligatorio, mostrado como +56 123 456 789.
//
// El codigo se propone segun el pais y no se adivina desde el numero: un
// telefono sin el no sirve para llamar desde el otro mercado, que es justo lo
// que empieza a pasar al abrir Peru.
export default function CampoTelefono({
  valor,
  onChange,
  prefijo = "+56",
  disabled,
  className,
  requerido,
}: {
  valor: string;
  onChange: (v: string) => void;
  prefijo?: string;
  disabled?: boolean;
  className?: string;
  requerido?: boolean;
}) {
  const vacio = !valor.trim();
  const malo = !vacio && !telefonoValido(valor);

  return (
    <>
      <input
        className={className}
        disabled={disabled}
        placeholder={`${prefijo} 123 456 789`}
        value={fmtTelefono(valor)}
        onChange={(e) => {
          const d = e.target.value.replace(/[^\d+]/g, "");
          // Si se escribe el numero sin codigo, se le antepone el del pais en
          // vez de rechazarlo: es lo que se hace al copiarlo de un correo.
          onChange(d.startsWith("+") ? d : d ? `${prefijo}${d}` : "");
        }}
      />
      {malo ? (
        <span className="block text-[11px] text-red-600 mt-0.5">
          Falta el codigo de area, por ejemplo {prefijo} 123 456 789.
        </span>
      ) : requerido && vacio ? (
        <span className="block text-[11px] text-gray-500 mt-0.5">
          Obligatorio, con codigo de area.
        </span>
      ) : null}
    </>
  );
}
