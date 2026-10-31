import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const celda = (t: unknown) => `"${String(t ?? "").replace(/"/g, '""')}"`;

// Libro diario en CSV para el contador: separador ";" y BOM para que Excel lea los tildes.
export async function GET(req: Request) {
  const v = await requerirVendedor();
  if (!(v.fin_ver_informes && v.fin_ver_todo)) return new Response("Sin permiso", { status: 403 });

  const url = new URL(req.url);
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  const pais = Number(url.searchParams.get("pais"));
  if (!ok.test(desde) || !ok.test(hasta) || !Number.isInteger(pais)) {
    return new Response("Parámetros no válidos", { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asientos")
    .select("id, fecha, glosa, origen, asiento_lineas(codigo_cuenta, debe, haber, id_centro_costo)")
    .eq("id_pais", pais)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("id")
    .limit(20000);
  if (error) return new Response(error.message, { status: 500 });

  const filas = ["Asiento;Fecha;Origen;Glosa;Cuenta;Debe;Haber;Centro de costo"];
  for (const a of (data ?? []) as unknown as {
    id: number;
    fecha: string;
    glosa: string;
    origen: string;
    asiento_lineas: { codigo_cuenta: string; debe: number; haber: number; id_centro_costo: number | null }[];
  }[]) {
    for (const l of a.asiento_lineas) {
      filas.push(
        [a.id, a.fecha, celda(a.origen), celda(a.glosa), l.codigo_cuenta, l.debe, l.haber, l.id_centro_costo ?? ""].join(";")
      );
    }
  }

  return new Response("﻿" + filas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="libro-diario-${desde}-${hasta}.csv"`,
    },
  });
}
