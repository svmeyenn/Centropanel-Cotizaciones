import { createClient } from "@/lib/supabase/server";
import { etiquetaDe, type TipoEstado } from "@/lib/catalogoEstados";
import { catalogoEstados } from "@/lib/leerCatalogoEstados";

interface Registro {
  id: number;
  estado: string;
  motivo: string | null;
  comentario: string | null;
  vendedor: string | null;
  en: string;
}

// Los motivos y comentarios que se anotaron al cambiar el estado de un lead o de una
// cotizacion: que paso, por que, quien lo anoto y cuando. Sin registros, no se muestra.
export default async function RegistrosEstado({
  tipo,
  idRef,
  titulo = "MOTIVOS DE LOS CAMBIOS DE ESTADO",
}: {
  tipo: TipoEstado;
  idRef: number;
  titulo?: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("estado_historial", { p_tipo: tipo, p_ref: idRef });
  const filas = (data ?? []) as Registro[];
  if (filas.length === 0) return null;
  const cat = (await catalogoEstados())[tipo];

  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      <h2 className="bg-verde text-white text-[10px] font-semibold px-2.5 py-px flex justify-between items-center">
        <span>{titulo}</span>
        <span className="font-normal">{filas.length}</span>
      </h2>
      <ul className="divide-y divide-gray-100 text-[11px]">
        {filas.map((r) => (
          <li key={r.id} className="px-3 py-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-verde">{etiquetaDe(cat, r.estado)}</span>
              {r.motivo && <span className="bg-crema border border-dorado rounded px-1.5 py-px">{r.motivo}</span>}
              <span className="text-gray-500">
                {r.vendedor ?? "Sistema"} ·{" "}
                {new Date(r.en).toLocaleString("es-CL", {
                  timeZone: "America/Santiago",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {r.comentario && <p className="mt-0.5 whitespace-pre-wrap break-words text-gray-800">{r.comentario}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
