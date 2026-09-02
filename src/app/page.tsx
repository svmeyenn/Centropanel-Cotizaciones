import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import { requerirVendedor } from "@/lib/sesion";

interface Opcion {
  texto: string;
  href: string;
  soloAdmin?: boolean;
}

// Menu principal. Eran doce botones en una lista plana, en el orden en que
// fueron apareciendo; ahora van por concepto, siguiendo el recorrido real de
// una venta: se cotiza, se produce, se cobra, y aparte estan las maestras y la
// configuracion. Las de administracion solo se le muestran al Administrador,
// igual que MenuAbrirAdmin en Access.
const GRUPOS: { titulo: string; nota: string; opciones: Opcion[] }[] = [
  {
    titulo: "Vender",
    nota: "Del presupuesto al cierre con el cliente",
    opciones: [
      { texto: "Detalle de cotizacion", href: "/cotizaciones/nueva" },
      { texto: "Cotizaciones", href: "/cotizaciones" },
      { texto: "Clientes", href: "/clientes" },
    ],
  },
  {
    titulo: "Producir",
    nota: "Lo comprometido y lo que hay que comprar",
    opciones: [
      { texto: "Pedidos", href: "/pedidos" },
      { texto: "Proveedores", href: "/proveedores", soloAdmin: true },
    ],
  },
  {
    titulo: "Cobrar",
    nota: "Estado de la cuenta de cada pedido",
    opciones: [
      { texto: "Estado de pago", href: "/cobranza" },
      { texto: "Facturas emitidas", href: "/facturas" },
    ],
  },
  {
    titulo: "Catalogo",
    nota: "Que vendemos y con que esta hecho",
    opciones: [
      { texto: "Configurar panel SIP", href: "/configurador" },
      { texto: "Catalogo de productos", href: "/productos" },
      { texto: "Materias primas", href: "/materias-primas", soloAdmin: true },
    ],
  },
  {
    titulo: "Configuracion",
    nota: "Reglas del sistema y quien entra",
    opciones: [
      { texto: "Formas de pago", href: "/formas-pago" },
      { texto: "Vendedores y accesos", href: "/vendedores", soloAdmin: true },
      { texto: "Parametros", href: "/parametros", soloAdmin: true },
    ],
  },
];

export default async function Home() {
  const v = await requerirVendedor();
  const esAdmin = v.rol === "Administrador";

  const grupos = GRUPOS.map((g) => ({
    ...g,
    opciones: g.opciones.filter((o) => !o.soloAdmin || esAdmin),
  })).filter((g) => g.opciones.length > 0);

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="COTIZADOR SIP"
        subtitulo="Costeo y cotizacion de paneles estructurales"
      />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-600">
            Sesion: <span className="font-semibold">{v.nombre}</span> ({v.rol})
          </p>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded"
            >
              Cerrar sesion
            </button>
          </form>
        </div>

        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.titulo}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-semibold text-verde">{g.titulo}</h2>
                <span className="text-xs text-gray-500">{g.nota}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {g.opciones.map((o) => (
                  <Link
                    key={o.href}
                    href={o.href}
                    className="bg-white border border-gray-200 rounded px-4 py-3 text-sm font-semibold text-verde hover:border-verde transition-colors"
                  >
                    {o.texto}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
