"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { BUCKET_COTIZACIONES_PROV } from "@/lib/compras";

// Todo lo que cambia una necesidad de material lo hace la base de datos en un solo paso --crear, abrir una
// solicitud, adjudicar, generar la orden--: aqui solo se piden y se devuelve el mensaje si la base lo rechaza.
// Los permisos y las reglas --un item en una sola solicitud, una orden por solicitud-- los exige la base.

export type Resultado = { ok: boolean; error?: string; id?: number };

type Cliente = Awaited<ReturnType<typeof createClient>>;

function refrescar(idNm?: number) {
  revalidatePath("/necesidades");
  if (idNm) revalidatePath(`/necesidades/${idNm}`);
}

async function llamar(f: (s: Cliente) => PromiseLike<{ data: unknown; error: { message: string } | null }>, idNm?: number): Promise<Resultado> {
  await requerirVendedor();
  const supabase = await createClient();
  const { data, error } = await f(supabase);
  if (error) return { ok: false, error: error.message };
  refrescar(idNm);
  const id = typeof data === "number" || typeof data === "string" ? Number(data) : undefined;
  return { ok: true, id: Number.isFinite(id) ? id : undefined };
}

export interface ItemNuevo {
  id_materia_prima?: number | null;
  id_producto?: number | null;
  descripcion?: string;
  unidad?: string;
  cantidad: number;
  id_partida?: number | null;
  nota?: string;
}

export async function crearNecesidad(d: { id_proyecto: number | null; id_pedido: number | null; fecha: string; notas: string; items: ItemNuevo[] }) {
  return llamar((s) =>
    s.rpc("nm_crear", { p_proyecto: d.id_proyecto, p_pedido: d.id_pedido, p_fecha: d.fecha || null, p_notas: d.notas, p_items: d.items })
  );
}

// Desde un pedido: sus insumos pasan solos, con la misma regla del pie de siempre.
export async function crearNecesidadDesdePedido(idPedido: number) {
  const r = await llamar((s) => s.rpc("nm_crear_desde_pedido", { p_pedido: idPedido }));
  if (r.ok) revalidatePath(`/pedidos/${idPedido}`);
  return r;
}

export async function agregarItems(idNm: number, items: ItemNuevo[]) {
  return llamar((s) => s.rpc("nm_agregar_items", { p_nm: idNm, p_items: items }), idNm);
}

export async function quitarItem(idNm: number, idItem: number) {
  return llamar((s) => s.rpc("nm_quitar_item", { p_item: idItem }), idNm);
}

export async function crearSolicitud(idNm: number, items: number[] | null) {
  return llamar((s) => s.rpc("sc_crear", { p_nm: idNm, p_items: items }), idNm);
}

export async function invitarProveedor(idNm: number, idProveedor: number) {
  return llamar((s) => s.rpc("nm_invitar", { p_nm: idNm, p_proveedor: idProveedor }), idNm);
}

export async function quitarProveedor(idNm: number, idParticipante: number) {
  return llamar((s) => s.rpc("nm_quitar_proveedor", { p_part: idParticipante }), idNm);
}

export async function declinarProveedor(idNm: number, idParticipante: number) {
  return llamar((s) => s.rpc("nm_declinar", { p_part: idParticipante }), idNm);
}

export interface CabeceraCotizacion {
  moneda?: string;
  plazo_dias?: string;
  condiciones_pago?: string;
  validez?: string;
  notas?: string;
  archivo_ruta?: string | null;
  archivo_nombre?: string | null;
}

export async function registrarCotizacion(idNm: number, idParticipante: number, cab: CabeceraCotizacion, precios: { id_item: number; precio: number | null }[]) {
  return llamar((s) => s.rpc("nm_registrar_cotizacion", { p_part: idParticipante, p_cab: cab, p_precios: precios }), idNm);
}

// Sube el PDF de la cotizacion del proveedor y lo deja anotado en su ficha.
export async function subirCotizacionPdf(idNm: number, idParticipante: number, datos: FormData): Promise<Resultado> {
  await requerirVendedor();
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elija el archivo." };
  if (archivo.size > 4 * 1024 * 1024) return { ok: false, error: "El archivo pesa mas de 4 MB: comprimalo antes de subirlo." };
  const limpio = archivo.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const ruta = `${idNm}/${crypto.randomUUID()}-${limpio}`;
  const supabase = await createClient();
  const { error: eSubida } = await supabase.storage.from(BUCKET_COTIZACIONES_PROV).upload(ruta, archivo, { contentType: archivo.type || undefined });
  if (eSubida) return { ok: false, error: `No se pudo subir el archivo: ${eSubida.message}` };
  const { error } = await supabase.rpc("nm_registrar_cotizacion", {
    p_part: idParticipante,
    p_cab: { archivo_ruta: ruta, archivo_nombre: archivo.name },
    p_precios: [],
  });
  if (error) {
    await supabase.storage.from(BUCKET_COTIZACIONES_PROV).remove([ruta]);
    return { ok: false, error: error.message };
  }
  refrescar(idNm);
  return { ok: true };
}

export async function enlaceCotizacionPdf(ruta: string): Promise<{ url?: string; error?: string }> {
  await requerirVendedor();
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET_COTIZACIONES_PROV).createSignedUrl(ruta, 600);
  if (error || !data) return { error: error?.message ?? "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}

export async function enviarSolicitud(idNm: number, idSc: number) {
  return llamar((s) => s.rpc("sc_enviar", { p_sc: idSc }), idNm);
}

export async function abrirSolicitud(idNm: number, idSc: number, grupos: number[][]) {
  return llamar((s) => s.rpc("sc_abrir", { p_sc: idSc, p_grupos: grupos }), idNm);
}

export async function adjudicarSolicitud(idNm: number, idSc: number, idParticipante: number) {
  return llamar((s) => s.rpc("sc_adjudicar", { p_sc: idSc, p_part: idParticipante }), idNm);
}

export async function revocarAdjudicacion(idNm: number, idSc: number) {
  return llamar((s) => s.rpc("sc_revocar_adjudicacion", { p_sc: idSc }), idNm);
}

export async function generarOC(idNm: number, idSc: number) {
  const r = await llamar((s) => s.rpc("sc_generar_oc", { p_sc: idSc }), idNm);
  if (r.ok) revalidatePath("/compras");
  return r;
}

export async function anularSolicitud(idNm: number, idSc: number) {
  return llamar((s) => s.rpc("sc_anular", { p_sc: idSc }), idNm);
}

export async function anularNecesidad(idNm: number) {
  return llamar((s) => s.rpc("nm_anular", { p_nm: idNm }), idNm);
}

export interface ItemBuscado {
  tipo: "materia_prima" | "producto";
  id: number;
  descripcion: string;
  unidad: string | null;
  sku: string | null;
}

export async function buscarItemsCompra(q: string, idPais: number): Promise<ItemBuscado[]> {
  await requerirVendedor();
  if (q.trim().length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("compras_buscar_items", { p_q: q, p_pais: idPais, p_limite: 25 });
  return ((data ?? []) as ItemBuscado[]).map((x) => ({ ...x, id: Number(x.id) }));
}
