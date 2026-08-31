import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import { requerirVendedor } from "@/lib/sesion";

// Menu principal, equivalente a frmMenu.txt: mismas 11 opciones, pero las de
// administracion (materias primas, vendedores/accesos, parametros) solo se
// muestran a Administrador -- MenuAbrirAdmin en Access hacia el mismo corte.
export default async function Home() {
  const v = await requerirVendedor();
  const esAdmin = v.rol === "Administrador";

  const opciones: { texto: string; href: string; soloAdmin?: boolean }[] = [
    { texto: "Detalle de cotizacion", href: "/cotizaciones/nueva" },
    { texto: "Cotizaciones", href: "/cotizaciones" },
    { texto: "Pedidos", href: "/pedidos" },
    { texto: "Configurar panel SIP", href: "/configurador" },
    { texto: "Catalogo de productos", href: "/productos" },
    { texto: "Clientes", href: "/clientes" },
    { texto: "Materias primas", href: "/materias-primas", soloAdmin: true },
    { texto: "Proveedores", href: "/proveedores", soloAdmin: true },
    { texto: "Vendedores y accesos", href: "/vendedores", soloAdmin: true },
    { texto: "Formas de pago", href: "/formas-pago" },
    { texto: "Parametros", href: "/parametros", soloAdmin: true },
  ];

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="COTIZADOR SIP"
        subtitulo="Costeo y cotizacion de paneles estructurales"
      />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            Sesion: <span className="font-semibold">{v.nombre}</span> ({v.rol}
            )
          </p>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm text-dorado-osc underline hover:no-underline"
            >
              Cerrar sesion
            </button>
          </form>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {opciones
            .filter((o) => !o.soloAdmin || esAdmin)
            .map((o) => (
              <Link
                key={o.href}
                href={o.href}
                className="bg-white border border-gray-200 rounded px-4 py-3 text-sm font-semibold text-verde hover:border-verde transition-colors"
              >
                {o.texto}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
