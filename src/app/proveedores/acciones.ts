"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { faltantesProveedor, nuevasFaltas } from "@/lib/validacion";
import { etiquetaIdDe } from "@/lib/paises";
import { leerListaPrecios } from "@/lib/lista-precios";

async function soloAdmin() {
  const v = await requerirVendedor();
  if (!tienePerfilAdmin(v)) return "Solo el administrador puede hacer esto.";
  return null;
}

export interface DatosProveedor {
  razon_social: string;
  rut: string;
  contacto: string;
  email: string;
  telefono: string;
  direccion: string;
  activo?: boolean;
  // Mercado del proveedor. Solo lo elige el administrador general.
  id_pais?: number | null;
}

export async function crearProveedor(d: DatosProveedor) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const faltan = faltantesProveedor(d, await etiquetaIdDe(d.id_pais));
  if (faltan.length > 0) {
    return { error: `Faltan datos del proveedor: ${faltan.join(", ")}.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entidades")
    .insert({
      razon_social: d.razon_social.trim(),
      nombre_referencia: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
    })
    .select("id_entidad, razon_social")
    .single();

  if (!error) {
    const { error: errMarca } = await supabase
      .from("entidad_tipos")
      .insert({ id_entidad: data.id_entidad, tipo: "proveedor" });
    if (errMarca) return { error: errMarca.message };
  }

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un proveedor con esa razon social."
          : error.message,
    };
  }

  revalidatePath("/proveedores");
  return { ok: true, proveedor: { id: data.id_entidad, razon_social: data.razon_social } };
}

export async function actualizarProveedor(id: number, d: DatosProveedor) {
  const err = await soloAdmin();
  if (err) return { error: err };
  // Un proveedor cargado antes de exigir un dato se puede seguir modificando: solo
  // frena lo que la modificacion deja en blanco.
  const etiqueta = await etiquetaIdDe(d.id_pais);
  const { data: actual } = await (await createClient())
    .from("entidades")
    .select("razon_social, rut, contacto, email, telefono, direccion")
    .eq("id_entidad", id)
    .single();
  const s = (x: string | null | undefined) => x ?? "";
  const faltan = nuevasFaltas(
    faltantesProveedor(d, etiqueta),
    actual
      ? faltantesProveedor(
          {
            razon_social: s(actual.razon_social),
            rut: s(actual.rut),
            contacto: s(actual.contacto),
            email: s(actual.email),
            telefono: s(actual.telefono),
            direccion: s(actual.direccion),
          },
          etiqueta
        )
      : []
  );
  if (faltan.length > 0) {
    return { error: `Faltan datos del proveedor: ${faltan.join(", ")}.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("entidades")
    .update({
      razon_social: d.razon_social.trim(),
      rut: d.rut.trim(),
      contacto: d.contacto.trim(),
      email: d.email.trim(),
      telefono: d.telefono.trim(),
      direccion: d.direccion.trim(),
      ...(d.id_pais ? { id_pais: d.id_pais } : {}),
      activo: d.activo ?? true,
    })
    .eq("id_entidad", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe otro proveedor con esa razon social."
          : error.message,
    };
  }

  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  return { ok: true };
}

export async function cambiarActivoProveedor(id: number, activo: boolean) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase
    .from("entidades")
    .update({ activo })
    .eq("id_entidad", id);
  if (error) return { error: error.message };
  revalidatePath("/proveedores");
  return { ok: true };
}

// --- maestra del proveedor: que vende y a que costo -------------------------

export interface DatosItemProveedor {
  id_materia_prima: number | null;
  id_producto: number | null;
  codigo: string;
  costo: number;
  // null = la moneda del mercado del proveedor; "USD" si cotiza en dolares.
  moneda: string | null;
}

// El proveedor cotiza en la moneda de su mercado o en dolares; ninguna otra.
function monedaValida(m: string | null) {
  return m == null || m === "" || m === "USD";
}

export async function agregarItemProveedor(
  idProveedor: number,
  d: DatosItemProveedor
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!d.id_materia_prima && !d.id_producto) {
    return { error: "Elija la materia prima o el producto." };
  }
  if (!monedaValida(d.moneda)) return { error: "La moneda del costo es la del mercado o USD." };

  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").insert({
    id_proveedor: idProveedor,
    id_materia_prima: d.id_materia_prima,
    id_producto: d.id_producto,
    codigo: d.codigo.trim() || null,
    costo: d.costo,
    moneda: d.moneda || null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ese item ya esta en la maestra de este proveedor."
          : error.message,
    };
  }

  revalidatePath(`/proveedores/${idProveedor}`);
  return { ok: true };
}

export async function actualizarItemProveedor(
  id: number,
  idProveedor: number,
  costo: number,
  codigo: string,
  activo: boolean,
  moneda: string | null
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!monedaValida(moneda)) return { error: "La moneda del costo es la del mercado o USD." };
  const supabase = await createClient();

  // Un item sin costo no se activa hasta que se le asigne uno.
  if (activo && !(costo > 0)) {
    return { error: "Asigne el costo antes de activar el item: sin costo queda inactivo." };
  }

  // Un preferente no se desactiva: el insumo se quedaria sin quien le defina el costo.
  if (!activo) {
    const { data: actual } = await supabase
      .from("proveedor_items")
      .select("es_preferente")
      .eq("id", id)
      .single();
    if (actual?.es_preferente) {
      return { error: "Este proveedor es el preferente de ese insumo. Quitele la marca antes de desactivarlo." };
    }
  }
  if (!(costo > 0)) {
    const { data: pref } = await supabase.from("proveedor_items").select("es_preferente").eq("id", id).single();
    if (pref?.es_preferente) {
      return { error: "Este proveedor es el preferente de ese insumo: no puede quedar sin costo. Quitele la marca primero." };
    }
  }

  const { error } = await supabase
    .from("proveedor_items")
    .update({ costo, codigo: codigo.trim() || null, activo, moneda: moneda || null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  return { ok: true };
}

function revalidarCostos(idProveedor: number) {
  revalidatePath(`/proveedores/${idProveedor}`);
  revalidatePath("/materias-primas");
  revalidatePath("/productos");
  revalidatePath("/configurador");
}

// Este proveedor pasa a ser el preferente DE ESE insumo o producto --no de toda su
// maestra--: el costo de los demas proveedores de lo mismo queda como referencia. El
// costo cambia al instante, y se recostean los paneles y las cotizaciones sin pedido;
// los pedidos no se tocan.
export async function marcarPreferente(idItem: number, idProveedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("item_marcar_preferente", { p_item: idItem });
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  const r = (data ?? {}) as { costo?: number; paneles?: number; cotizaciones?: number };
  return {
    ok: true,
    costo: Number(r.costo ?? 0),
    paneles: Number(r.paneles ?? 0),
    cotizaciones: Number(r.cotizaciones ?? 0),
  };
}

export async function quitarPreferente(idItem: number, idProveedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.rpc("item_quitar_preferente", { p_item: idItem });
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  return { ok: true };
}

export async function quitarItemProveedor(id: number, idProveedor: number) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/proveedores/${idProveedor}`);
  return { ok: true };
}

// Asignacion en lote: se marcan varios productos y se agregan de una vez, con
// costo en cero para completarlo despues en la propia tabla. Cargar una
// maestra de decenas de items de a uno, escribiendo el costo cada vez, es lo
// que hace que la maestra no se cargue nunca.
export async function agregarItemsProveedor(
  idProveedor: number,
  claves: string[]
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!claves.length) return { error: "No hay nada marcado." };

  const filas = claves.map((c) => {
    const [tipo, id] = c.split(":");
    return {
      id_proveedor: idProveedor,
      id_materia_prima: tipo === "mp" ? Number(id) : null,
      id_producto: tipo === "prod" ? Number(id) : null,
      costo: 0,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.from("proveedor_items").insert(filas);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Alguno de los marcados ya estaba en la maestra. Recargue la pagina."
          : error.message,
    };
  }

  revalidatePath(`/proveedores/${idProveedor}`);
  return { ok: true, agregados: filas.length };
}

// ---------------------------------------------------------------------------
// Costos del proveedor, todos juntos
// ---------------------------------------------------------------------------

export type CambioCosto = { id: number; costo: number; moneda: string | null };

// Lee una lista de precios (.xlsx o .csv) y la empareja con la maestra del proveedor por el
// SKU de Centropanel o por el codigo del proveedor. No guarda nada: devuelve lo que calzo para
// que se revise en pantalla antes de guardar.
export async function leerArchivoPrecios(idProveedor: number, d: FormData) {
  const err = await soloAdmin();
  if (err) return { error: err };
  const archivo = d.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Falta el archivo de precios." };

  const leido = await leerListaPrecios(archivo);
  if (!leido.ok) return { error: leido.mensaje };

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("proveedor_items")
    .select("id, codigo, materias_primas(sku), productos(sku)")
    .eq("id_proveedor", idProveedor);

  const porSku = new Map<string, number>();
  const porCodigo = new Map<string, number>();
  for (const it of items ?? []) {
    const mp = Array.isArray(it.materias_primas) ? it.materias_primas[0] : it.materias_primas;
    const pr = Array.isArray(it.productos) ? it.productos[0] : it.productos;
    const sku = ((mp as { sku?: string | null } | null)?.sku ?? (pr as { sku?: string | null } | null)?.sku ?? "").toString().trim().toUpperCase();
    if (sku) porSku.set(sku, Number(it.id));
    const cod = (it.codigo ?? "").toString().trim().toUpperCase();
    if (cod) porCodigo.set(cod, Number(it.id));
  }

  const coincidencias = new Map<number, number>();
  const sinCoincidencia: string[] = [];
  for (const f of leido.filas) {
    const id = (f.sku && porSku.get(f.sku)) || (f.codigo && porCodigo.get(f.codigo)) || null;
    if (id) coincidencias.set(id, f.costo);
    else sinCoincidencia.push(`${f.sku ?? f.codigo} (fila ${f.fila})`);
  }

  return {
    ok: true,
    coincidencias: Array.from(coincidencias, ([id, costo]) => ({ id, costo })),
    sinCoincidencia: sinCoincidencia.slice(0, 40),
    totalSinCoincidencia: sinCoincidencia.length,
    totalFilas: leido.filas.length,
  };
}

// Guarda de una vez todos los costos cambiados. Si uno falla no se guarda ninguno. Si entre
// ellos hay preferentes, la base recostea los paneles y las cotizaciones sin pedido una sola vez.
export async function actualizarCostosProveedor(
  idProveedor: number,
  cambios: CambioCosto[],
  vigenteDesde: string,
  origen: "Manual" | "Reajuste" | "Archivo",
  nota: string
) {
  const err = await soloAdmin();
  if (err) return { error: err };
  if (!cambios.length) return { error: "No hay cambios que guardar." };
  if (cambios.some((c) => !Number.isFinite(c.costo) || c.costo < 0)) return { error: "Hay un costo que no es valido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) return { error: "Indique desde cuando rige el costo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("proveedor_costos_actualizar", {
    p_proveedor: idProveedor,
    p_cambios: cambios,
    p_vigente_desde: vigenteDesde,
    p_origen: origen,
    p_nota: nota.trim() || null,
  });
  if (error) return { error: error.message };
  revalidarCostos(idProveedor);
  const r = (data ?? {}) as { actualizados?: number; sin_cambio?: number; preferentes?: number; paneles?: number; cotizaciones?: number };
  return {
    ok: true,
    actualizados: Number(r.actualizados ?? 0),
    preferentes: Number(r.preferentes ?? 0),
    paneles: Number(r.paneles ?? 0),
    cotizaciones: Number(r.cotizaciones ?? 0),
  };
}

export type FilaHistorial = {
  id: number;
  costo: number;
  moneda: string | null;
  vigente_desde: string | null;
  origen: string;
  nota: string | null;
  registrado_en: string;
  quien: string | null;
};

// Los costos que tuvo un item de la maestra, del mas nuevo al mas viejo.
export async function historialCostos(idItem: number): Promise<{ error: string } | { ok: true; filas: FilaHistorial[] }> {
  const err = await soloAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proveedor_costo_historial")
    .select("id, costo, moneda, vigente_desde, origen, nota, registrado_en, vendedores(nombre)")
    .eq("id_item", idItem)
    .order("id", { ascending: false });
  if (error) return { error: error.message };
  return {
    ok: true,
    filas: (data ?? []).map((h) => {
      const v = Array.isArray(h.vendedores) ? h.vendedores[0] : h.vendedores;
      return {
        id: Number(h.id),
        costo: Number(h.costo),
        moneda: (h.moneda as string | null) ?? null,
        vigente_desde: (h.vigente_desde as string | null) ?? null,
        origen: h.origen as string,
        nota: (h.nota as string | null) ?? null,
        registrado_en: h.registrado_en as string,
        quien: (v as { nombre?: string } | null)?.nombre ?? null,
      };
    }),
  };
}
