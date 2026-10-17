"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return "Solo el administrador puede hacer esto.";
  return null;
}

export interface DatosProyecto {
  nombre: string;
  cliente: string;
  id_cliente: number | null;
  tipo: "obra" | "centro_costo";
  estado: string;
  id_responsable: number | null;
  direccion: string;
  fecha_inicio: string;
  fecha_fin: string;
  notas: string;
}

const limpio = (d: DatosProyecto) => ({
  nombre: d.nombre.trim(),
  cliente: d.cliente.trim() || null,
  id_cliente: d.id_cliente,
  tipo: d.tipo,
  estado: d.estado,
  id_responsable: d.id_responsable,
  direccion: d.direccion.trim() || null,
  fecha_inicio: d.fecha_inicio || null,
  fecha_fin: d.fecha_fin || null,
  notas: d.notas.trim() || null,
});

export async function crearProyecto(d: DatosProyecto) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.nombre.trim()) return { error: "Indique el nombre del proyecto." };
  if (d.fecha_inicio && d.fecha_fin && d.fecha_fin < d.fecha_inicio)
    return { error: "La fecha de termino es anterior a la de inicio." };
  const v = await requerirVendedor();
  const ctx = await contextoMercado(v);
  const idPais = ctx.idPaisActivo ?? ctx.paises[0]?.id;
  if (!idPais) return { error: "Elija un mercado en la cabecera." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyectos")
    .insert({ ...limpio(d), id_pais: idPais })
    .select("id_proyecto")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/proyectos");
  return { ok: true, id: data.id_proyecto as number };
}

export async function actualizarProyecto(id: number, d: DatosProyecto) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.nombre.trim()) return { error: "Indique el nombre del proyecto." };
  if (d.fecha_inicio && d.fecha_fin && d.fecha_fin < d.fecha_inicio)
    return { error: "La fecha de termino es anterior a la de inicio." };
  const supabase = await createClient();
  const { error } = await supabase.from("proyectos").update(limpio(d)).eq("id_proyecto", id);
  if (error) return { error: error.message };
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
  return { ok: true };
}

export interface DatosPartida {
  codigo: string;
  nombre: string;
  categoria: string;
  monto_presupuestado: number;
}

export async function guardarPartida(idProyecto: number, id: number | null, d: DatosPartida) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.nombre.trim()) return { error: "Indique el nombre de la partida." };
  if (!(d.monto_presupuestado >= 0)) return { error: "El monto no puede ser negativo." };
  const supabase = await createClient();
  const fila = {
    codigo: d.codigo.trim() || null,
    nombre: d.nombre.trim(),
    categoria: d.categoria,
    monto_presupuestado: d.monto_presupuestado,
  };
  const { error } = id
    ? await supabase.from("proyecto_partidas").update(fila).eq("id", id)
    : await supabase.from("proyecto_partidas").insert({ ...fila, id_proyecto: idProyecto });
  if (error) return { error: error.message };
  revalidatePath(`/proyectos/${idProyecto}`);
  return { ok: true };
}

export async function borrarPartida(idProyecto: number, id: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { count } = await supabase
    .from("ordenes_compra")
    .select("id", { count: "exact", head: true })
    .eq("id_partida", id);
  if ((count ?? 0) > 0) return { error: "La partida tiene ordenes de compra: no se puede borrar." };
  const { error } = await supabase.from("proyecto_partidas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/proyectos/${idProyecto}`);
  return { ok: true };
}

export interface DatosTarea {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  avance: number;
  id_predecesora: number | null;
  id_partida: number | null;
  hito: boolean;
}

export async function guardarTarea(idProyecto: number, id: number | null, d: DatosTarea) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.nombre.trim()) return { error: "Indique el nombre de la tarea." };
  if (!d.fecha_inicio || !d.fecha_fin) return { error: "Indique inicio y termino." };
  const fin = d.hito ? d.fecha_inicio : d.fecha_fin;
  if (fin < d.fecha_inicio) return { error: "El termino es anterior al inicio." };
  if (id && d.id_predecesora === id) return { error: "Una tarea no puede depender de si misma." };
  const supabase = await createClient();
  const fila = {
    nombre: d.nombre.trim(),
    fecha_inicio: d.fecha_inicio,
    fecha_fin: fin,
    avance: Math.min(100, Math.max(0, Math.round(d.avance || 0))),
    id_predecesora: d.id_predecesora,
    id_partida: d.id_partida,
    hito: d.hito,
  };
  const { error } = id
    ? await supabase.from("proyecto_tareas").update(fila).eq("id", id)
    : await supabase.from("proyecto_tareas").insert({ ...fila, id_proyecto: idProyecto });
  if (error) return { error: error.message };
  revalidatePath(`/proyectos/${idProyecto}`);
  return { ok: true };
}

export async function borrarTarea(idProyecto: number, id: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("proyecto_tareas").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/proyectos/${idProyecto}`);
  return { ok: true };
}

// Un pedido emitido se convierte en proyecto, o se asocia a uno existente.
export async function asociarPedidoAProyecto(idPedido: number, idProyecto: number | null) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  let destino = idProyecto;
  if (destino == null) {
    const { data: p } = await supabase
      .from("pedidos")
      .select("num_pedido, id_pais, id_cliente, entidades:id_cliente(razon_social)")
      .eq("id", idPedido)
      .single();
    if (!p) return { error: "El pedido no existe." };
    const cli = (Array.isArray(p.entidades) ? p.entidades[0] : p.entidades) as {
      razon_social: string;
    } | null;
    // Los egresos de paneles se aprueban como un solo proyecto: el maestro "Paneles".
    const { data: maestro } = await supabase
      .from("proyectos")
      .select("id_proyecto")
      .eq("id_pais", p.id_pais)
      .eq("nombre", "Paneles")
      .is("cliente", null)
      .eq("borrado", false)
      .limit(1)
      .maybeSingle();
    const { data: nuevo, error } = await supabase
      .from("proyectos")
      .insert({
        id_pais: p.id_pais,
        nombre: `Pedido ${p.num_pedido}`,
        cliente: cli?.razon_social ?? null,
        id_cliente: p.id_cliente,
        num_pedido: p.num_pedido,
        aprobacion_en: maestro?.id_proyecto ?? null,
      })
      .select("id_proyecto")
      .single();
    if (error) return { error: error.message };
    destino = nuevo.id_proyecto as number;
  }
  const { error } = await supabase.from("pedidos").update({ id_proyecto: destino }).eq("id", idPedido);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  revalidatePath("/proyectos");
  return { ok: true, id: destino };
}

// --- quien aprueba los gastos del proyecto -----------------------------------

export async function asignarAprobador(idProyecto: number, idVendedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase
    .from("proyecto_aprobadores")
    .insert({ id_proyecto: idProyecto, id_vendedor: idVendedor });
  if (error) return { error: error.code === "23505" ? "Ya es aprobador de este proyecto." : error.message };
  revalidatePath(`/proyectos/${idProyecto}`);
  return { ok: true };
}

export async function quitarAprobador(idProyecto: number, id: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("proyecto_aprobadores").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/proyectos/${idProyecto}`);
  return { ok: true };
}

// Busca la ficha del cliente por nombre o RUT para enlazarla al proyecto.
export async function buscarClientes(texto: string) {
  await requerirVendedor();
  const q = texto.replace(/[,()%*]/g, " ").trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("entidades")
    .select("id_entidad, razon_social, rut, entidad_tipos!inner(tipo)")
    .eq("entidad_tipos.tipo", "cliente")
    .eq("activo", true)
    .or(`razon_social.ilike.%${q}%,nombre_referencia.ilike.%${q}%,rut.ilike.%${q}%`)
    .order("razon_social")
    .limit(8);
  return (data ?? []).map((e) => ({
    id: Number(e.id_entidad),
    razon_social: e.razon_social as string,
    rut: (e.rut as string | null) ?? null,
  }));
}
