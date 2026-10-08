"use client";

import { useEffect, useId, useState } from "react";
import { motivosDe } from "@/app/estados/motivos";
import { COMENTARIO_MAX, type ExtraEstado, type MotivoOpcion } from "@/lib/motivosEstado";

// El motivo (lista del mantenedor "Motivos de estado") y el comentario libre que
// acompanan un cambio de estado. Si el estado no tiene motivos, solo ofrece el comentario.
export default function MotivoYComentario({
  tipo,
  estado,
  onChange,
  deshabilitado = false,
}: {
  tipo: "lead" | "cotizacion";
  // El estado al que se va a pasar.
  estado: string;
  // Avisa lo elegido y si falta un motivo que el estado exige.
  onChange: (extra: ExtraEstado, falta: boolean) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const [motivos, setMotivos] = useState<MotivoOpcion[]>([]);
  const [obligatorio, setObligatorio] = useState(false);
  const [motivo, setMotivo] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    let vigente = true;
    setMotivo(null);
    setComentario("");
    setMotivos([]);
    setObligatorio(false);
    onChange({ motivo: null, comentario: "" }, false);
    motivosDe(tipo, estado).then((r) => {
      if (!vigente) return;
      setMotivos(r.motivos);
      setObligatorio(r.obligatorio);
      onChange({ motivo: null, comentario: "" }, r.obligatorio);
    });
    return () => {
      vigente = false;
    };
    // onChange viene del padre y cambia en cada vuelta: solo importa el estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, estado]);

  const avisar = (m: number | null, c: string) => onChange({ motivo: m, comentario: c }, obligatorio && m == null);

  return (
    <div className="space-y-1">
      {motivos.length > 0 && (
        <div>
          <label htmlFor={`${id}-motivo`} className="block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide">
            Motivo{obligatorio ? " (obligatorio)" : ""}
          </label>
          <select
            id={`${id}-motivo`}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] w-full bg-white"
            value={motivo ?? ""}
            disabled={deshabilitado}
            onChange={(e) => {
              const m = e.target.value ? Number(e.target.value) : null;
              setMotivo(m);
              avisar(m, comentario);
            }}
          >
            <option value="">{obligatorio ? "Elegir..." : "Sin motivo"}</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${id}-comentario`} className="block text-[10px] font-semibold text-dorado-osc uppercase tracking-wide">
          Comentario (opcional)
        </label>
        <textarea
          id={`${id}-comentario`}
          rows={2}
          maxLength={COMENTARIO_MAX}
          className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] w-full bg-white"
          value={comentario}
          disabled={deshabilitado}
          onChange={(e) => {
            setComentario(e.target.value);
            avisar(motivo, e.target.value);
          }}
        />
      </div>
    </div>
  );
}
