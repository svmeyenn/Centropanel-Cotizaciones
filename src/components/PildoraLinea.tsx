import { LINEAS, type Linea } from "@/lib/leads";

// La linea del lead a la vista: paneles en verde y proyecto en dorado, con el
// mismo tamano para que la columna no salte de una fila a otra.
export default function PildoraLinea({ linea }: { linea: Linea | string | null | undefined }) {
  const esProyecto = linea === "casas";
  return (
    <span
      className={`inline-block shrink-0 text-[9px] font-semibold leading-tight rounded px-1 border ${
        esProyecto ? "text-dorado-osc border-dorado-osc bg-crema" : "text-verde border-verde bg-white"
      }`}
      title={esProyecto ? "Lead de proyecto" : "Lead de paneles"}
    >
      {esProyecto ? LINEAS.casas : LINEAS.paneles}
    </span>
  );
}
