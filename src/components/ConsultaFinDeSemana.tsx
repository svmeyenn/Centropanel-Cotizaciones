"use client";

import { useRef, useState } from "react";
import { diaCorto, diaSemana, sumarDias } from "@/components/inicio/tipos";

// No se hacen gestiones los sabados ni los domingos. Al programar una para esos dias se
// pregunta si de verdad se quiere, y en la misma vista se ofrece pasarla al viernes
// anterior o al lunes siguiente. Es una consulta, no una prohibicion: se puede dejar igual.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function esFinDeSemana(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

// El viernes anterior y el lunes siguiente a un sabado o domingo.
export function alrededorDeFinDeSemana(iso: string): { viernes: string; lunes: string } {
  const sabado = new Date(`${iso}T12:00:00Z`).getUTCDay() === 6;
  return { viernes: sumarDias(iso, sabado ? -1 : -2), lunes: sumarDias(iso, sabado ? 2 : 1) };
}

const BOTON = "border border-gray-300 text-gray-800 text-[11px] font-semibold px-2.5 py-0.5 rounded bg-white disabled:opacity-50";
const BOTON_VERDE = "bg-verde text-white text-[11px] font-semibold px-2.5 py-0.5 rounded disabled:opacity-50";

export function PanelFinDeSemana({
  fecha,
  hoy,
  onElegir,
  onVolver,
  className = "",
}: {
  // El sabado o domingo elegido.
  fecha: string;
  hoy: string;
  // La fecha con la que se sigue: el viernes, el lunes, o el mismo dia del fin de semana.
  onElegir: (fecha: string) => void;
  onVolver: () => void;
  className?: string;
}) {
  const { viernes, lunes } = alrededorDeFinDeSemana(fecha);
  const dia = `${diaSemana(fecha).toLowerCase()} ${diaCorto(fecha)}`;
  return (
    <div className={`bg-amber-50 border border-amber-400 text-amber-900 rounded px-3 py-2 text-[11px] space-y-1.5 ${className}`} role="alertdialog" aria-label="Gestion en fin de semana">
      <p>
        <strong>No se realizan gestiones los sabados ni los domingos.</strong> ¿Quiere agendarla igual para el {dia}?
      </p>
      <p>Tambien puede programarla para:</p>
      <div className="flex flex-wrap gap-2">
        {viernes >= hoy && (
          <button type="button" className={BOTON_VERDE} onClick={() => onElegir(viernes)}>
            El viernes {diaCorto(viernes)}
          </button>
        )}
        <button type="button" className={BOTON_VERDE} onClick={() => onElegir(lunes)}>
          El lunes {diaCorto(lunes)}
        </button>
        <button type="button" className={BOTON} onClick={() => onElegir(fecha)}>
          Si, agendarla el {dia}
        </button>
        <button type="button" className={BOTON} onClick={onVolver}>
          Volver
        </button>
      </div>
    </div>
  );
}

// Para un formulario que se envia como accion: al enviar mira el campo de la fecha y, si cae
// en fin de semana, detiene el envio y levanta la consulta. Al elegir, cambia la fecha del
// campo y envia el formulario.
export function useFinDeSemana(campo = "proxima_fecha") {
  const [consulta, setConsulta] = useState<{ fecha: string; form: HTMLFormElement } | null>(null);
  const omitir = useRef(false);

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    if (omitir.current) {
      omitir.current = false;
      return;
    }
    const input = e.currentTarget.elements.namedItem(campo) as HTMLInputElement | null;
    if (input && input.value && esFinDeSemana(input.value)) {
      e.preventDefault();
      setConsulta({ fecha: input.value, form: e.currentTarget });
    }
  }

  function elegir(fecha: string) {
    if (!consulta) return;
    const { form } = consulta;
    const input = form.elements.namedItem(campo) as HTMLInputElement | null;
    if (input) input.value = fecha;
    setConsulta(null);
    omitir.current = true;
    form.requestSubmit();
  }

  return { consulta, alEnviar, elegir, volver: () => setConsulta(null) };
}
