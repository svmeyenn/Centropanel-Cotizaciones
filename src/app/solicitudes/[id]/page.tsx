import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pTxt } from "@/lib/parametros";
import { fecha as fmtFecha, pesos, unidades as fmtUnid } from "@/lib/formato";
import { LOGO_PDF } from "@/lib/logo";
import BotonImprimir from "@/app/cotizaciones/[id]/pdf/BotonImprimir";

export const dynamic = "force-dynamic";

// Se lee una sola vez por peticion: la usan el titulo del documento y la
// pagina, y sin cache() serian dos consultas iguales.
const leerSolicitud = cache(async (id: number) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("solicitudes")
    .select(
      "*, proveedores(razon_social, rut, contacto, email, telefono, direccion), pedidos(num_pedido, tiempo_entrega)"
    )
    .eq("id", id)
    .single();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) return { title: "Solicitud" };
  const s = await leerSolicitud(id);
  // El navegador propone el titulo como nombre del archivo al guardar en PDF.
  return { title: { absolute: (s?.num_solicitud as string) ?? "Solicitud" } };
}

export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirVendedor();
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  if (!Number.isFinite(id)) notFound();

  const sol = await leerSolicitud(id);
  if (!sol) notFound();

  const supabase = await createClient();
  const [{ data: lineas }, parametros] = await Promise.all([
    supabase
      .from("solicitud_detalle")
      .select("*")
      .eq("id_solicitud", id)
      .order("orden"),
    leerParametros(),
  ]);

  const uno = <T,>(x: unknown): T | null =>
    Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);

  const prov = uno<{
    razon_social: string;
    rut: string | null;
    contacto: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
  }>(sol.proveedores);
  const ped = uno<{ num_pedido: string; tiempo_entrega: string | null }>(
    sol.pedidos
  );

  const referencia = (lineas ?? []).reduce(
    (s, l) => s + Number(l.unidades) * Number(l.costo_referencia ?? 0),
    0
  );

  return (
    <div className="bg-white text-[#1A1A1A]">
      <BotonImprimir />
      <div className="mx-auto max-w-[820px] p-6 print:p-[14mm]">
        {/* cabecera */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-[#1D4E4A] pb-3">
          <img
            src={LOGO_PDF}
            alt="Centro Panel"
            className="h-[92px] w-auto shrink-0"
          />
          <div className="text-right text-[10px] leading-snug">
            <div className="font-bold text-[#1D4E4A] text-sm">
              {pTxt(parametros, "EmpresaMarca", "CENTRO PANEL")}
            </div>
            <div>{pTxt(parametros, "EmpresaRUT", "")}</div>
            <div>{pTxt(parametros, "EmpresaDireccion", "")}</div>
            <div>{pTxt(parametros, "EmpresaFono", "")}</div>
          </div>
        </div>

        <div className="bg-[#1D4E4A] text-white px-3 py-1.5 mt-3 flex justify-between text-[11px] font-bold">
          <span>SOLICITUD DE COTIZACION {sol.num_solicitud}</span>
          <span>{fmtFecha(sol.fecha as string)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-3">
          <div>
            <div className="text-[10px] font-bold text-[#7A5C10] mb-1">
              PROVEEDOR
            </div>
            <Campo rotulo="Razon social" valor={prov?.razon_social} />
            <Campo rotulo="RUT" valor={prov?.rut} />
            <Campo rotulo="Contacto" valor={prov?.contacto} />
            <Campo rotulo="Correo" valor={prov?.email} />
            <Campo rotulo="Telefono" valor={prov?.telefono} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#7A5C10] mb-1">
              REFERENCIA
            </div>
            <Campo rotulo="Pedido" valor={ped?.num_pedido} />
            <Campo rotulo="Plazo requerido" valor={ped?.tiempo_entrega} />
            <Campo
              rotulo="Contacto Centro Panel"
              valor={pTxt(parametros, "EmpresaFono", "")}
            />
          </div>
        </div>

        <p className="text-[10px] text-gray-600 mt-3">
          Solicitamos cotizacion por los siguientes productos. Indique precio
          unitario neto, plazo de entrega y validez de la oferta.
        </p>

        {/* items */}
        <table className="w-full text-[10px] mt-2 border-collapse">
          <thead>
            <tr className="bg-[#1D4E4A] text-white">
              <th className="text-left px-2 py-1 w-8">N</th>
              <th className="text-left px-2 py-1 w-20">SKU</th>
              <th className="text-left px-2 py-1">Producto</th>
              <th className="text-right px-2 py-1 w-20">Cantidad</th>
              <th className="text-right px-2 py-1 w-28">Precio unitario</th>
            </tr>
          </thead>
          <tbody>
            {(lineas ?? []).map((l, i) => (
              <tr key={l.id as number} className="border-b border-gray-200">
                <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                <td className="px-2 py-1 text-gray-500">
                  {(l.sku as string | null) ?? ""}
                </td>
                <td className="px-2 py-1">{l.descripcion}</td>
                <td className="px-2 py-1 text-right font-semibold">
                  {fmtUnid(Number(l.unidades))}
                </td>
                {/* En blanco a proposito: lo llena el proveedor. */}
                <td className="px-2 py-1 text-right text-gray-300">
                  ______________
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 text-[9px] text-gray-500 print:hidden">
          Referencia interna segun la maestra de este proveedor:{" "}
          {pesos(referencia)} netos. No se imprime en el documento.
        </div>

        {sol.notas != null && String(sol.notas).trim() !== "" && (
          <div className="mt-3 text-[10px]">
            <div className="font-bold text-[#7A5C10]">OBSERVACIONES</div>
            <div className="whitespace-pre-wrap">{String(sol.notas)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor?: string | null;
}) {
  if (!valor) return null;
  return (
    <div className="text-[10px] leading-snug">
      <span className="text-gray-500">{rotulo}:</span>{" "}
      <span className="text-[#1A1A1A]">{valor}</span>
    </div>
  );
}
