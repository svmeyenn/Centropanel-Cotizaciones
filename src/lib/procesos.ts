// Las lineas de proceso del sistema: la secuencia de etapas por las que pasa un documento. La cabecera de cada pantalla
// muestra la linea completa y destaca en cual de ellas esta quien mira.

export type TipoProceso = "venta" | "compras";

export interface EtapaDef {
  clave: string;
  etiqueta: string;
}

export const PROCESOS: Record<TipoProceso, { nombre: string; etapas: EtapaDef[] }> = {
  venta: {
    nombre: "Proceso de venta",
    etapas: [
      { clave: "lead", etiqueta: "Lead" },
      { clave: "cotizacion", etiqueta: "Cotizacion" },
      { clave: "pedido", etiqueta: "Pedido" },
      { clave: "factura", etiqueta: "Factura de venta" },
    ],
  },
  compras: {
    nombre: "Proceso de compra",
    etapas: [
      { clave: "necesidad", etiqueta: "Necesidad" },
      { clave: "solicitud", etiqueta: "Solicitud de cotizacion" },
      { clave: "oc", etiqueta: "Orden de compra" },
      { clave: "recepcion", etiqueta: "Recepcion y pago" },
    ],
  },
};

// Donde esta una etapa que ya existe para este documento: a donde lleva y con que numero se la reconoce.
export type EnlaceEtapa = { href?: string; ref?: string | null };

export interface UbicacionProceso {
  tipo: TipoProceso;
  etapa: string;
  enlaces?: Record<string, EnlaceEtapa | undefined>;
}
