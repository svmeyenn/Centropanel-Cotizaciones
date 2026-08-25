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
  espesor_total: number | null;
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

// Calcula el panel a partir de la combinacion elegida. Todo el costeo se
// resuelve en Postgres (costo_panel, precio_desde_costo, descripcion_panel):
// no se reimplementa aqui para que la regla valga igual desde cualquier cliente.
export async function calcularPanel(
  c: Combinacion,
  margenPersonalizado?: number | null
): Promise<ResultadoPanel | { error: string }> {
  const v = await requerirVendedor();
  if (!c.id_eps || !c.id_placa_a) {
    return { error: "Elija al menos la plancha EPS y la placa de la cara A." };
  }

  const supabase = await createClient();
  const esAdmin = v.rol === "Administrador";
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
  let costeo: LineaCosteo[] | null = null;
  if (esAdmin) {
    const ids = [c.id_eps, c.id_placa_a, b].filter(Boolean) as number[];
    const [{ data: insumos }, { data: adhesivoRaw }, { data: paramsAdh }] =
      await Promise.all([
        supabase
          .from("materias_primas")
          .select("id, nombre, costo, espesor_nominal")
          .in("id", ids),
        supabase.rpc("costo_adhesivo", { p_dos_caras: b != null }),
        supabase
          .from("parametros")
          .select("clave, valor_num")
          .in("clave", ["AdhesivoRend1Cara", "AdhesivoRend2Caras"]),
      ]);

    const porId = new Map(
      (insumos ?? []).map((m) => [Number(m.id), m as { nombre: string; costo: number }])
    );
    const rend =
      paramsAdh?.find((x) =>
        b != null ? x.clave === "AdhesivoRend2Caras" : x.clave === "AdhesivoRend1Cara"
      )?.valor_num ?? 0;

    const linea = (rotulo: string, id: number | null): LineaCosteo | null => {
      if (!id) return null;
      const m = porId.get(id);
      if (!m) return null;
      return { concepto: rotulo, detalle: m.nombre, monto: Number(m.costo) };
    };

    costeo = [
      linea("Plancha EPS", c.id_eps),
      linea("Placa cara A", c.id_placa_a),
      b
        ? linea("Placa cara B", b)
        : { concepto: "Placa cara B", detalle: "sin placa (panel de una cara)", monto: 0 },
      {
        concepto: "Adhesivo",
        detalle: `prorrateado: el balde rinde ${rend} paneles de ${
          b != null ? "dos caras" : "una cara"
        }`,
        monto: Number(adhesivoRaw ?? 0),
      },
    ].filter(Boolean) as LineaCosteo[];
  }

  return {
    descripcion: rDesc.data ?? null,
    espesor_total: rEspesor.data ? Number(rEspesor.data) : null,
    // El costo y el margen solo se devuelven al administrador: un Vendedor
    // cotiza con el precio y no necesita conocer la estructura de costos.
    costo: esAdmin ? costo : null,
    precio,
    margen: esAdmin && precio > 0 ? (precio - costo) / precio : null,
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
