"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirVendedor } from "@/lib/sesion";
import { revalidatePath } from "next/cache";

export interface Combinacion {
  id_eps: number | null;
  id_placa_a: number | null;
  id_placa_b: number | null;
}

export interface LineaCosteo {
  concepto: string;
  detalle: string;
  monto: number;
}

export interface ResultadoPanel {
  descripcion: string | null;
  espesor_total: number | string | null;
  costo: number | null; // null si el perfil no puede ver costos
  precio: number;
  margen: number | null;
  existe_id: number | null;
  misma_config: boolean;
  descripcion_existente: string | null;
  // Desglose de como se llego al costo, equivalente a CfgDesglose en Access.
  // Solo se arma para el administrador: detalla el costo de cada insumo.
  costeo: LineaCosteo[] | null;
}

// Devuelve un producto listo para agregarlo a una cotizacion. Lee
// v_catalogo_venta, asi que no expone costos y sirve tambien a perfil Vendedor.
// Lo usa el panel emergente del cotizador para incorporar al tiro el panel
// recien creado sin recargar la pagina (y perder la cotizacion en curso).
export async function productoParaCotizar(id: number): Promise<{
  id: number;
  descripcion: string;
  tipo: string;
  precio_venta: number;
} | null> {
  await requerirVendedor();
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_catalogo_venta")
    .select("id, descripcion, tipo, precio_venta")
    .eq("id", id)
    .single();
  if (!data) return null;
  return {
    id: Number(data.id),
    descripcion: data.descripcion as string,
    tipo: data.tipo as string,
    precio_venta: Number(data.precio_venta),
  };
}

// Calcula el panel a partir de la combinacion elegida. Todo el costeo se
// resuelve en Postgres (costo_panel, precio_desde_costo, descripcion_panel):
// no se reimplementa aqui para que la regla valga igual desde cualquier cliente.
export async function calcularPanel(
  c: Combinacion,
  margenPersonalizado?: number | null
): Promise<ResultadoPanel | { error: string }> {
  await requerirVendedor();
  if (!c.id_eps || !c.id_placa_a) {
    return { error: "Elija al menos la plancha EPS y la placa de la cara A." };
  }

  const supabase = await createClient();
  const b = c.id_placa_b ?? null;

  const [rDesc, rEspesor, rCosto, rExiste] = await Promise.all([
    supabase.rpc("descripcion_panel", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
    supabase.rpc("espesor_total_panel", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
    supabase.rpc("costo_panel", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
    supabase.rpc("panel_existente", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
  ]);

  if (rCosto.error) return { error: rCosto.error.message };

  const costo = Number(rCosto.data ?? 0);
  const margen =
    margenPersonalizado != null && margenPersonalizado > 0
      ? margenPersonalizado / 100
      : null;

  const rPrecio = await supabase.rpc("precio_desde_costo", {
    p_costo: costo,
    p_margen: margen,
  });
  if (rPrecio.error) return { error: rPrecio.error.message };
  const precio = Number(rPrecio.data ?? 0);

  const existeId = rExiste.data ? Number(rExiste.data) : null;
  let mismaConfig = false;
  let descExistente: string | null = null;

  if (existeId) {
    const [rMisma, rProd] = await Promise.all([
      supabase.rpc("panel_misma_config", {
        p_id: existeId,
        p_eps: c.id_eps,
        p_placa_a: c.id_placa_a,
        p_placa_b: b,
      }),
      supabase
        .from("v_catalogo_venta")
        .select("descripcion")
        .eq("id", existeId)
        .single(),
    ]);
    mismaConfig = Boolean(rMisma.data);
    descExistente = rProd.data?.descripcion ?? null;
  }

  // Desglose: EPS + cara A + cara B + adhesivo prorrateado. El balde rinde 30
  // paneles de dos caras o 60 de una, segun los parametros del sistema.
  //
  // Se pide a desglose_costo_panel (SECURITY DEFINER) y no leyendo
  // materias_primas y parametros: esas tablas las reserva el RLS al
  // administrador, y Stephan pidio que el desglose lo vea cualquier perfil.
  const { data: desgloseRaw } = await supabase.rpc("desglose_costo_panel", {
    p_eps: c.id_eps,
    p_placa_a: c.id_placa_a,
    p_placa_b: b,
  });

  const costeo: LineaCosteo[] | null = Array.isArray(desgloseRaw)
    ? (desgloseRaw as Record<string, unknown>[]).map((l) => ({
        concepto: String(l.concepto ?? ""),
        detalle: String(l.detalle ?? ""),
        monto: Number(l.monto ?? 0),
      }))
    : null;

  return {
    descripcion: rDesc.data ?? null,
    espesor_total: rEspesor.data ? Number(rEspesor.data) : null,
    // El costo y el margen van a todos los perfiles: el desglose ya los muestra,
    // ocultarlos aqui seria solo aparentar que no se ven.
    costo,
    precio,
    margen: precio > 0 ? (precio - costo) / precio : null,
    existe_id: existeId,
    misma_config: mismaConfig,
    descripcion_existente: descExistente,
    costeo,
  };
}

// Guarda el panel en el catalogo. Igual que CfgGuardar en Access: si la
// descripcion ya esta tomada NO se guarda nada y se avisa, porque guardar
// reescribiria el producto existente y le cambiaria el costo sin que se note.
export async function guardarPanel(
  c: Combinacion,
  precioManual?: number | null
): Promise<{ ok?: true; id?: number; error?: string; aviso?: string }> {
  const v = await requerirVendedor();
  if (!v.puede_crear && v.rol !== "Administrador") {
    return { error: "Su perfil no permite crear productos." };
  }
  if (!c.id_eps || !c.id_placa_a) {
    return { error: "Elija al menos la plancha EPS y la placa de la cara A." };
  }

  const supabase = await createClient();
  const b = c.id_placa_b ?? null;

  const { data: existeId } = await supabase.rpc("panel_existente", {
    p_eps: c.id_eps,
    p_placa_a: c.id_placa_a,
    p_placa_b: b,
  });

  if (existeId) {
    const [{ data: misma }, { data: prod }] = await Promise.all([
      supabase.rpc("panel_misma_config", {
        p_id: existeId,
        p_eps: c.id_eps,
        p_placa_a: c.id_placa_a,
        p_placa_b: b,
      }),
      supabase
        .from("v_catalogo_venta")
        .select("descripcion")
        .eq("id", existeId)
        .single(),
    ]);
    const descExistente = prod?.descripcion ?? null;
    // "misma" contempla las caras invertidas: un panel APA/EPS/Smart es el
    // mismo producto que Smart/EPS/APA, solo cambia cual se llamo cara A.
    return {
      aviso: misma
        ? `Este panel ya esta en el catalogo${
            descExistente ? ` como "${descExistente}"` : ""
          }. Si lo armo con las caras al reves, es el mismo producto: no hay nada que agregar.`
        : "Ya existe un panel con este mismo nombre pero hecho con otras materias primas. No se guardo nada: para cambiarlo use Catalogo de productos.",
      id: Number(existeId),
    };
  }

  const [rDesc, rCosto, rEspesor] = await Promise.all([
    supabase.rpc("descripcion_panel", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
    supabase.rpc("costo_panel", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
    supabase.rpc("espesor_total_panel", {
      p_eps: c.id_eps,
      p_placa_a: c.id_placa_a,
      p_placa_b: b,
    }),
  ]);

  const costo = Number(rCosto.data ?? 0);
  let precio: number;

  if (precioManual && precioManual > 0) {
    precio = precioManual;
  } else {
    const { data } = await supabase.rpc("precio_desde_costo", {
      p_costo: costo,
      p_margen: null,
    });
    precio = Number(data ?? 0);
  }

  const { data: nuevo, error } = await supabase
    .from("productos")
    .insert({
      descripcion: rDesc.data,
      tipo: "Panel SIP",
      id_eps: c.id_eps,
      id_placa_a: c.id_placa_a,
      id_placa_b: b,
      espesor_total: rEspesor.data,
      costo_unitario: costo,
      precio_venta: precio,
      margen_aplicado: precio > 0 ? (precio - costo) / precio : 0,
      precio_manual: Boolean(precioManual && precioManual > 0),
      activo: true,
    })
    .select("id")
    .single();

  if (error) {
    // Carrera entre la comprobacion de arriba y el insert (dos pestanas, dos
    // usuarios). El indice unico de la base es la ultima linea de defensa.
    if (error.code === "23505") {
      return {
        aviso:
          "Ese panel acaba de quedar en el catalogo (quiza desde otra pantalla). No se creo un duplicado.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/productos");
  revalidatePath("/configurador");
  return { ok: true, id: Number(nuevo.id) };
}
