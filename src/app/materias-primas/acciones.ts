"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return "Solo el administrador puede hacer esto.";
  return null;
}

export interface DatosMateria {
  nombre: string;
  tipo: string;
  familia: string;
  etiqueta: string;
  ancho_mm: number | null;
  largo_mm: number | null;
  espesor_mm: number | null;
  espesor_nominal: number | null;
  costo: number;
  unidad: string;
  activo?: boolean;
  // Mercado del insumo. Solo lo elige el administrador general.
  id_pais?: number | null;
}

// Alta de insumos. El nombre no se puede repetir: la carga masiva de costos
// empareja por nombre y con dos iguales no sabria cual actualizar. La base
// tiene ademas un indice unico detras.
export async function crearMateria(d: DatosMateria) {
  const err = await soloAdmin();
  if (err) return { error: err };

  const nombre = d.nombre.trim();
  if (!nombre) return { error: "Indique el nombre." };
  if (!d.tipo.trim()) return { error: "Elija el tipo." };

  const supabaseTipos = await createClient();
  const { data: tipos } = await supabaseTipos
    .from("tipos_materia")
    .select("nombre")
    .eq("activo", true);
  if (!(tipos ?? []).some((t) => t.nombre === d.tipo)) {
    return { error: `El tipo "${d.tipo}" no esta en la lista de tipos.` };
  }
  if (d.costo < 0) return { error: "El costo no puede ser negativo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materias_primas")
    .insert({
      nombre,
      tipo: d.tipo,
      familia: d.familia.trim() || null,
      etiqueta: d.etiqueta.trim() || null,
      ancho_mm: d.ancho_mm,
      largo_mm: d.largo_mm,
      espesor_mm: d.espesor_mm,
      espesor_nominal: d.espesor_nominal,
      costo: d.costo,
      unidad: d.unidad.trim() || null,
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
      activo: d.activo ?? true,
    })
    .select("id, nombre, sku")
    .single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una materia prima con ese nombre."
          : error.message,
    };
  }

  revalidatePath("/materias-primas");
  revalidatePath("/configurador");
  return { ok: true, materia: data };
}

export async function actualizarMateria(id: number, d: DatosMateria) {
  const err = await soloAdmin();
  if (err) return { error: err };

  const supabase = await createClient();

  // El costo es movil, pero con proveedor preferente es UNA sola cifra: cambiarlo aqui
  // cambia el costo del item de ese proveedor --y de ahi vuelve al insumo--. Sin
  // preferente es un costo manual. Lo resuelve la base (costos_fijar).
  const { data: actual } = await supabase
    .from("materias_primas")
    .select("costo")
    .eq("id", id)
    .single();
  if (actual && Number(actual.costo) !== Number(d.costo)) {
    const { error: eCosto } = await supabase.rpc("costos_fijar", {
      p_filas: [{ mp: id, costo: d.costo }],
      p_recostear: false,
    });
    if (eCosto) return { error: eCosto.message };
  }

  const { error } = await supabase
    .from("materias_primas")
    .update({
      nombre: d.nombre.trim(),
      tipo: d.tipo,
      familia: d.familia.trim() || null,
      etiqueta: d.etiqueta.trim() || null,
      ancho_mm: d.ancho_mm,
      largo_mm: d.largo_mm,
      espesor_mm: d.espesor_mm,
      espesor_nominal: d.espesor_nominal,
      unidad: d.unidad.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/materias-primas");
  revalidatePath("/productos");
  return { ok: true };
}

export async function cambiarActivoMateria(id: number, activo: boolean) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase
    .from("materias_primas")
    .update({ activo })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/materias-primas");
  return { ok: true };
}

export interface FilaCarga {
  nombre: string;
  costo: number;
}

// Carga masiva de costos. Equivale al boton de Access que sube la plantilla y
// recalcula el catalogo: actualiza el costo de cada insumo por nombre y despues
// vuelve a costear todos los paneles.
//
// Importante: NUNCA borra. Un nombre que no exista se informa y se omite, para
// que un archivo mal armado no vacie la tabla de materias primas.
export async function cargarCostos(filas: FilaCarga[]) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!filas.length) return { error: "El archivo no trae filas utiles." };

  const supabase = await createClient();

  const { data: existentes, error: eLeer } = await supabase
    .from("materias_primas")
    .select("id, nombre, costo");
  if (eLeer) return { error: eLeer.message };

  const porNombre = new Map<string, { id: number; costo: number }>();
  for (const m of existentes ?? []) {
    porNombre.set(String(m.nombre).trim().toLowerCase(), {
      id: Number(m.id),
      costo: Number(m.costo),
    });
  }

  const noEncontrados: string[] = [];
  const cambios: { id: number; nombre: string; antes: number; ahora: number }[] = [];

  for (const f of filas) {
    const clave = f.nombre.trim().toLowerCase();
    const actual = porNombre.get(clave);
    if (!actual) {
      noEncontrados.push(f.nombre);
      continue;
    }
    if (Number.isFinite(f.costo) && f.costo >= 0 && f.costo !== actual.costo) {
      cambios.push({
        id: actual.id,
        nombre: f.nombre,
        antes: actual.costo,
        ahora: f.costo,
      });
    }
  }

  // Todo en una sola transaccion. Con proveedor preferente el costo nuevo pasa al item
  // de ese proveedor (una sola cifra); sin preferente es el costo del insumo. Despues se
  // recostean los paneles --los de precio manual conservan su precio de venta-- y las
  // cotizaciones sin pedido; los pedidos no se tocan.
  const { data: rpc, error: eFijar } = await supabase.rpc("costos_fijar", {
    p_filas: cambios.map((c) => ({ mp: c.id, costo: c.ahora })),
    p_recostear: true,
  });
  if (eFijar) return { error: eFijar.message };
  const hecho = (rpc ?? {}) as { paneles?: number; cotizaciones?: number };
  const recalculados = {
    paneles: Number(hecho.paneles ?? 0),
    cotizaciones: Number(hecho.cotizaciones ?? 0),
  };

  revalidatePath("/materias-primas");
  revalidatePath("/productos");

  return {
    ok: true,
    actualizados: cambios.length,
    sinCambio: filas.length - cambios.length - noEncontrados.length,
    noEncontrados,
    recalculados: recalculados.paneles,
    cotizaciones: recalculados.cotizaciones,
    detalle: cambios.slice(0, 20),
  };
}

// Recostea los paneles del catalogo con los costos vigentes y las cotizaciones que
// todavia no tienen pedido. Las que ya tienen pedido --y sobre todo las facturadas--
// quedan como estaban: un pedido se recostea solo, uno por uno, desde su pantalla.
// Lo hace la base en una sola transaccion (catalogo_recalcular).
export async function recalcularCatalogo(): Promise<{ paneles: number; cotizaciones: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogo_recalcular");
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { paneles?: number; cotizaciones?: number };
  return { paneles: Number(r.paneles ?? 0), cotizaciones: Number(r.cotizaciones ?? 0) };
}

// Eliminar de verdad, no desactivar: para lo que se cargo por error. La base
// se niega si el insumo compone un panel o ya figura en una solicitud, porque
// borrarlo dejaria un documento hablando de algo que no existe.
export async function eliminarMateria(id: number) {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) {
    return { error: "Solo el administrador puede eliminar materias primas." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("eliminar_materia", { p_id: id });
  if (error) return { error: error.message };

  const r = data as {
    ok?: boolean;
    en_uso?: boolean;
    paneles?: number;
    solicitudes?: number;
    proveedores_limpiados?: number;
  };

  if (r?.en_uso) {
    const partes: string[] = [];
    if (r.paneles) partes.push(`${r.paneles} panel(es) la usan`);
    if (r.solicitudes) partes.push(`figura en ${r.solicitudes} solicitud(es)`);
    return {
      error: `No se puede eliminar: ${partes.join(" y ")}. Desactivela en vez de borrarla.`,
    };
  }

  revalidatePath("/materias-primas");
  revalidatePath("/configurador");
  return { ok: true, proveedoresLimpiados: r?.proveedores_limpiados ?? 0 };
}
