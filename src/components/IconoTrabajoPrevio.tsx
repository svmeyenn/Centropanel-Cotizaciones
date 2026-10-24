// La marca de "trabajo previo": el lead necesita desarrollo, investigacion o calculos mas
// sofisticados antes de responder. Escuadra con regla, dibujada en trazo para que herede el
// color del texto y se vea igual en cualquier computador.
export default function IconoTrabajoPrevio({
  className = "h-3.5 w-3.5",
  titulo = "Trabajo previo: hay que desarrollar, investigar o calcular antes de responder",
}: {
  className?: string;
  titulo?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Trabajo previo"
    >
      <title>{titulo}</title>
      {/* escuadra */}
      <path d="M3.5 20.5V4.5l16 16h-16z" />
      <path d="M7.5 16.5v-5l5 5h-5z" />
      {/* marcas de la regla */}
      <path d="M3.5 8.5h2.2M3.5 12.5h2.2M3.5 16.5h2.2M8.5 20.5v-2.2M12.5 20.5v-2.2M16.5 20.5v-2.2" />
    </svg>
  );
}
