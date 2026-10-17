// Se muestra mientras una pantalla carga sus datos: la navegacion responde al
// instante en vez de quedarse congelada en la pantalla anterior.
export default function Cargando() {
  return (
    <div className="min-h-[50vh] p-6 animate-pulse" role="status" aria-label="Cargando">
      <div className="h-8 w-64 bg-gray-200 rounded mb-6" />
      <div className="space-y-3 max-w-screen-xl">
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
