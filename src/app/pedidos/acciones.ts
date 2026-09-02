"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";
import { ESQUEMA } from "@/lib/supabase/esquema";

// Convierte una cotizacion en pedido. Todo el trabajo lo hace generar_pedido()
// en la base, en una sola transaccion: copia cabecera y lineas y deja la
// cotizacion Aceptada. Si se hiciera por pasos desde aqui, un fallo a mitad
// dejaria una cotizacion aceptada sin pedido.
export async function generarPedido(idCotizacion: number) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite generar pedidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_pedido", {
    p_cotizacion: idCotizacion,
  });

  if (error) return { error: error.message };

  revalidatePath("/pedidos");
  revalidatePath(`/cotizaciones/${idCotizacion}`);
  revalidatePath("/cotizaciones");
  return { ok: true, id: Number(data) };
}

export interface DatosPedido {
  fecha: string;
  estado: string;
  direccion_despacho: string;
  tiempo_entrega: string;
  notas: string;
}

export async function actualizarPedido(id: number, d: DatosPedido) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar pedidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({
      fecha: d.fecha,
      estado: d.estado,
      direccion_despacho: d.direccion_despacho.trim() || null,
      tiempo_entrega: d.tiempo_entrega.trim() || null,
      notas: d.notas.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

export interface LineaPedido {
  id: number;
  unidades: number;
  valor_unitario: number;
}

// Las lineas del pedido si se editan: el pedido es el documento vivo, a
// diferencia de la cotizacion, que queda congelada al generarlo.
export async function actualizarLineasPedido(
  idPedido: number,
  lineas: LineaPedido[]
) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar pedidos." };
  }
  const supabase = await createClient();
  for (const l of lineas) {
    const { error } = await supabase
      .from("pedido_detalle")
      .update({ unidades: l.unidades, valor_unitario: l.valor_unitario })
      .eq("id", l.id);
    if (error) return { error: error.message };
  }
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

export async function quitarLineaPedido(id: number, idPedido: number) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar pedidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("pedido_detalle").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

// Reparte las necesidades del pedido entre los proveedores que las tienen en
// su maestra y crea un documento por cada uno. Devuelve tambien lo que quedo
// sin proveedor, que es lo que hay que salir a buscar a mano.
export async function generarSolicitudes(idPedido: number) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite generar solicitudes." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_solicitudes", {
    p_pedido: idPedido,
  });
  if (error) return { error: error.message };

  const r = (data ?? {}) as {
    solicitudes?: number;
    existentes?: number;
    sin_proveedor?: string[];
  };
  revalidatePath(`/pedidos/${idPedido}`);
  return {
    ok: true,
    solicitudes: Number(r.solicitudes ?? 0),
    existentes: Number(r.existentes ?? 0),
    sinProveedor: r.sin_proveedor ?? [],
  };
}

export async function cambiarEstadoSolicitud(
  id: number,
  idPedido: number,
  estado: string
) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite modificar solicitudes." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  revalidatePath(`/solicitudes/${id}`);
  return { ok: true };
}

// --- cuenta corriente del pedido -------------------------------------------

export interface DatosPago {
  fecha: string;
  monto: number;
  medio: string;
  referencia: string;
  notas: string;
}

export async function registrarPago(idPedido: number, d: DatosPago) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite registrar pagos." };
  }
  if (!d.monto) return { error: "Indique el monto." };

  const supabase = await createClient();
  const { error } = await supabase.from("pagos_pedido").insert({
    id_pedido: idPedido,
    fecha: d.fecha,
    monto: d.monto,
    medio: d.medio.trim() || null,
    referencia: d.referencia.trim() || null,
    notas: d.notas.trim() || null,
    id_vendedor: v.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/pedidos/${idPedido}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

// Un pago mal cargado se anula borrandolo: solo el administrador, porque la
// cuenta corriente es el respaldo de lo que se cobro.
export async function anularPago(id: number, idPedido: number) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede anular un pago." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("pagos_pedido").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

// Borrar la solicitud es la unica forma de volver a pedirle a ese proveedor:
// generar de nuevo respeta las que ya existen.
export async function eliminarSolicitud(id: number, idPedido: number) {
  const v = await requerirVendedor();
  if (!v.puede_editar && v.rol !== "Administrador") {
    return { error: "Su perfil no permite eliminar solicitudes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("solicitudes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

// --- facturacion ------------------------------------------------------------

// Registrar la factura cierra el pedido. No emite el documento tributario:
// eso lo hace el sistema de facturacion electronica, y aqui se guarda su
// numero para amarrar pedido y factura.
export async function facturarPedido(
  idPedido: number,
  numero: string,
  fecha: string
) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite facturar." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("facturar_pedido", {
    p_pedido: idPedido,
    p_numero: numero,
    p_fecha: fecha,
    p_vendedor: v.id,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe una factura con ese numero."
          : error.message,
    };
  }

  revalidatePath(`/pedidos/${idPedido}`);
  revalidatePath("/pedidos");
  revalidatePath("/cobranza");
  return { ok: true, id: Number(data) };
}

// Anular la factura devuelve el pedido a Despachado: es la unica forma de
// volver a facturarlo, y solo el administrador puede hacerlo.
export async function anularFactura(id: number, idPedido: number) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede anular una factura." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("facturas").delete().eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("pedidos").update({ estado: "Despachado" }).eq("id", idPedido);

  revalidatePath(`/pedidos/${idPedido}`);
  revalidatePath("/pedidos");
  revalidatePath("/cobranza");
  return { ok: true };
}

// --- Archivo de la factura ------------------------------------------------
// El documento tributario lo emite el sistema de facturacion electronica; aqui
// se guarda una copia (PDF o foto) para tenerla junto al pedido. El archivo va
// a Storage y en la tabla queda solo la ruta.

const TIPOS_FACTURA = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const MAX_FACTURA = 10 * 1024 * 1024;

export async function subirArchivoFactura(
  idFactura: number,
  idPedido: number,
  datos: FormData
) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite adjuntar la factura." };
  }

  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Seleccione un archivo." };
  }
  if (!TIPOS_FACTURA.includes(archivo.type)) {
    return { error: "Solo se aceptan archivos PDF, JPG, PNG o WEBP." };
  }
  if (archivo.size > MAX_FACTURA) {
    return { error: "El archivo no puede pesar mas de 10 MB." };
  }

  const supabase = await createClient();

  // La ruta lleva el ambiente adelante para que pruebas y produccion no se
  // pisen, y un sufijo de tiempo para no chocar al reemplazar el archivo.
  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const ruta = `${ESQUEMA}/${idPedido}/${idFactura}-${Date.now()}.${ext}`;

  const { error: errSubida } = await supabase.storage
    .from("facturas")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (errSubida) return { error: errSubida.message };

  // Si ya habia un archivo, se borra recien ahora: si la subida falla, el
  // anterior sigue disponible.
  const { data: previo } = await supabase
    .from("facturas")
    .select("archivo")
    .eq("id", idFactura)
    .single();

  const { error } = await supabase
    .from("facturas")
    .update({
      archivo: ruta,
      archivo_nombre: archivo.name,
      archivo_subido: new Date().toISOString(),
    })
    .eq("id", idFactura);

  if (error) {
    await supabase.storage.from("facturas").remove([ruta]);
    return { error: error.message };
  }

  if (previo?.archivo && previo.archivo !== ruta) {
    await supabase.storage.from("facturas").remove([previo.archivo]);
  }

  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

export async function quitarArchivoFactura(idFactura: number, idPedido: number) {
  const v = await requerirVendedor();
  if (v.rol !== "Administrador") {
    return { error: "Solo el administrador puede quitar la factura adjunta." };
  }

  const supabase = await createClient();
  const { data: previo } = await supabase
    .from("facturas")
    .select("archivo")
    .eq("id", idFactura)
    .single();

  const { error } = await supabase
    .from("facturas")
    .update({ archivo: null, archivo_nombre: null, archivo_subido: null })
    .eq("id", idFactura);
  if (error) return { error: error.message };

  if (previo?.archivo) {
    await supabase.storage.from("facturas").remove([previo.archivo]);
  }

  revalidatePath(`/pedidos/${idPedido}`);
  return { ok: true };
}

// El bucket es privado: para ver el archivo se pide un enlace firmado, valido
// por unos minutos.
export async function enlaceArchivoFactura(idFactura: number) {
  await requerirVendedor();
  const supabase = await createClient();

  const { data: f } = await supabase
    .from("facturas")
    .select("archivo")
    .eq("id", idFactura)
    .single();
  if (!f?.archivo) return { error: "Esta factura no tiene archivo adjunto." };

  const { data, error } = await supabase.storage
    .from("facturas")
    .createSignedUrl(f.archivo, 300);
  if (error) return { error: error.message };

  return { ok: true, url: data.signedUrl };
}

// Duplicar un pedido es duplicar la venta entera: cada pedido cuelga de su
// propia cotizacion, asi que la base copia la cotizacion con precios frescos y
// de ahi genera el pedido nuevo, listo para producir.
export async function duplicarPedido(id: number) {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite crear pedidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicar_pedido", {
    p_pedido: id,
  });
  if (error) return { error: error.message };

  revalidatePath("/pedidos");
  revalidatePath("/cotizaciones");
  return { ok: true, id: Number(data) };
}
