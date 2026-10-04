// Bandera del mercado. Va dibujada y no como emoji: Windows no muestra las
// banderas emoji, en su lugar escribe las letras del codigo ("CL", "PE").
export default function Bandera({
  codigo,
  className = "h-3.5 w-auto",
}: {
  codigo: string;
  className?: string;
}) {
  if (codigo === "CL") {
    return (
      <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] ring-1 ring-black/10`} aria-label="Chile">
        <rect width="30" height="10" fill="#FFFFFF" />
        <rect y="10" width="30" height="10" fill="#D52B1E" />
        <rect width="10" height="10" fill="#0039A6" />
        <polygon
          fill="#FFFFFF"
          points="5,2 5.68,4.07 7.85,4.07 6.09,5.36 6.76,7.43 5,6.15 3.24,7.43 3.91,5.36 2.15,4.07 4.32,4.07"
        />
      </svg>
    );
  }
  if (codigo === "PE") {
    return (
      <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] ring-1 ring-black/10`} aria-label="Peru">
        <rect width="10" height="20" fill="#D91023" />
        <rect x="10" width="10" height="20" fill="#FFFFFF" />
        <rect x="20" width="10" height="20" fill="#D91023" />
      </svg>
    );
  }
  return null;
}

// La bandera de un dato, a partir del pais que trae (1 Chile, 2 Peru). Va en cada
// fila de los listados para no confundir los datos de un mercado con los de otro.
export function BanderaDe({ idPais, className = "h-3 w-auto" }: { idPais: number | null | undefined; className?: string }) {
  const codigo = idPais === 2 ? "PE" : "CL";
  return (
    <span className="inline-flex shrink-0 align-middle mr-1.5" title={codigo === "PE" ? "Peru" : "Chile"}>
      <Bandera codigo={codigo} className={className} />
    </span>
  );
}

// Color que identifica cada mercado en la franja de la cabecera.
export function colorMercado(codigo: string | null) {
  if (codigo === "CL") return "#0039A6";
  if (codigo === "PE") return "#D91023";
  return "#C9A84C";
}
