import { requerirVendedor } from "@/lib/sesion";
import { leerBoleta } from "@/lib/finanzas/lectura-boleta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tope de la foto que se manda a leer. Las de la camara llegan comprimidas a
// unos 200 kB; esto es el cinturon de seguridad.
const MAXIMO = 6 * 1024 * 1024;

export async function POST(pedido: Request) {
  const v = await requerirVendedor();
  if (!v.fin_rendir_gastos && !v.fin_pagar_gastos)
    return Response.json({ ok: false, mensaje: "Sin permiso." }, { status: 403 });

  const datos = await pedido.formData();
  const foto = datos.get("foto");

  if (!(foto instanceof File) || foto.size === 0)
    return Response.json({ ok: false, mensaje: "Falta la foto." }, { status: 400 });

  if (foto.size > MAXIMO)
    return Response.json(
      { ok: false, mensaje: "La foto pesa demasiado." },
      { status: 400 }
    );

  const base64 = Buffer.from(await foto.arrayBuffer()).toString("base64");
  const leida = await leerBoleta(base64, foto.type);

  return Response.json(leida, { status: leida.ok ? 200 : 422 });
}
