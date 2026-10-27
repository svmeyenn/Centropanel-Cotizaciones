import type { ReactElement } from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { pTxt, type Parametros } from "@/lib/parametros";
import { dinero, fecha as fmtFecha, unidades as fmtUnid } from "@/lib/formato";
import { LOGO_PDF } from "@/lib/logo";

// Los dos documentos que salen hacia el proveedor: la solicitud de cotizacion y la orden de compra.
// Mismo estilo que la cotizacion al cliente (CotizacionPdf). La solicitud no lleva precios --los pone el
// proveedor--; la orden si.

const VERDE = "#1D4E4A";
const DORADO = "#C9A84C";
const DORADO_OSC = "#7A5C10";
const CREMA = "#F8F6F0";
const TEXTO = "#1A1A1A";
const GRIS = "#6B7280";

const s = StyleSheet.create({
  pagina: { padding: 40, fontFamily: "Helvetica", fontSize: 8, color: TEXTO },
  fila: { flexDirection: "row" },
  cabecera: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  logo: { height: 66, marginRight: 9 },
  marca: { fontSize: 14, fontFamily: "Helvetica-Bold", color: VERDE },
  chico: { fontSize: 7, color: GRIS },
  folio: { backgroundColor: VERDE, color: "white", padding: 8, minWidth: 190, alignItems: "flex-end", alignSelf: "flex-start" },
  folioNum: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  bloques: { flexDirection: "row", marginBottom: 14 },
  bloque: { flex: 1, marginRight: 12 },
  rotuloBloque: { backgroundColor: CREMA, color: DORADO_OSC, fontSize: 7, fontFamily: "Helvetica-Bold", paddingVertical: 3, paddingHorizontal: 5, marginBottom: 3 },
  campo: { fontSize: 7.5, marginBottom: 1.5 },
  destacado: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tablaCab: { flexDirection: "row", backgroundColor: VERDE, color: "white", fontSize: 7, fontFamily: "Helvetica-Bold" },
  fila_: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#D1D5DB" },
  celda: { paddingVertical: 3, paddingHorizontal: 5 },
  cNum: { width: 22 },
  cDesc: { flex: 1 },
  cUnid: { width: 44 },
  cCant: { width: 56, textAlign: "right" },
  cPrecio: { width: 82, textAlign: "right" },
  cTotal: { width: 82, textAlign: "right" },
  total: { alignSelf: "flex-end", width: 250, marginTop: 10, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5, fontSize: 9, fontFamily: "Helvetica-Bold" },
  nota: { marginTop: 14, fontSize: 7.5, lineHeight: 1.45 },
  aviso: { marginBottom: 10, borderWidth: 1, borderColor: DORADO, color: DORADO_OSC, padding: 5, fontSize: 8, textAlign: "center", fontFamily: "Helvetica-Bold" },
});

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <Text style={s.campo}>
      <Text style={{ color: GRIS }}>{rotulo}: </Text>
      {valor}
    </Text>
  );
}

export interface ProveedorDoc {
  nombre: string;
  rut?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

export interface EmisorDoc {
  nombre: string;
  cargo?: string | null;
  email?: string | null;
  telefono?: string | null;
}

export interface SolicitudDoc {
  folio: string;
  folioNecesidad: string;
  fecha: string;
  proveedor: ProveedorDoc;
  obra: string | null;
  // Fecha de entrega en destino y direccion de destino.
  fechaEntrega: string | null;
  direccionDestino: string | null;
  notas: string | null;
  items: { descripcion: string; unidad: string | null; cantidad: number; nota: string | null }[];
  emisor: EmisorDoc;
}

export interface OrdenDoc {
  numero: string;
  fecha: string;
  estado: string;
  aprobada: boolean;
  moneda: string;
  proveedor: ProveedorDoc;
  obra: string | null;
  fechaEntrega: string | null;
  direccionDestino: string | null;
  condicionesPago: string | null;
  notas: string | null;
  total: number;
  lineas: { descripcion: string; unidades: number; costo: number }[];
  emisor: EmisorDoc;
}

function Cabecera({ p, titulo, numero, fecha }: { p: Parametros; titulo: string; numero: string; fecha: string }) {
  return (
    <View style={s.cabecera}>
      <View style={s.fila}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={LOGO_PDF} style={s.logo} />
        <View>
          <Text style={s.marca}>{pTxt(p, "EmpresaMarca")}</Text>
          <Text style={s.chico}>{pTxt(p, "EmpresaGiro")}</Text>
          <Text style={s.chico}>{pTxt(p, "EmpresaDireccion")}</Text>
        </View>
      </View>
      <View style={s.folio}>
        <Text style={{ fontSize: 7, color: DORADO, fontFamily: "Helvetica-Bold" }}>{titulo}</Text>
        <Text style={s.folioNum}>{numero}</Text>
        <Text style={{ fontSize: 7, color: DORADO }}>{pTxt(p, "EmpresaNombre")}   {pTxt(p, "EtiquetaIdTributario", "RUT")} {pTxt(p, "EmpresaRUT")}</Text>
        <Text style={{ fontSize: 7 }}>Fecha {fmtFecha(fecha)}</Text>
      </View>
    </View>
  );
}

function BloqueProveedor({ pr }: { pr: ProveedorDoc }) {
  return (
    <View style={s.bloque}>
      <Text style={s.rotuloBloque}>PROVEEDOR</Text>
      <Text style={s.destacado}>{pr.nombre}</Text>
      <Campo rotulo="RUT" valor={pr.rut} />
      <Campo rotulo="Contacto" valor={pr.contacto} />
      <Campo rotulo="Correo" valor={pr.email} />
      <Campo rotulo="Telefono" valor={pr.telefono} />
      <Campo rotulo="Direccion" valor={pr.direccion} />
    </View>
  );
}

function BloqueEntrega({ obra, fechaEntrega, direccion, etiquetaFecha }: { obra: string | null; fechaEntrega: string | null; direccion: string | null; etiquetaFecha: string }) {
  return (
    <View style={s.bloque}>
      <Text style={s.rotuloBloque}>ENTREGA EN DESTINO</Text>
      <Text style={s.destacado}>{fechaEntrega ? fmtFecha(fechaEntrega) : "Por coordinar"}</Text>
      <Text style={s.chico}>{etiquetaFecha}</Text>
      <Text style={[s.campo, { marginTop: 4 }]}>
        <Text style={{ color: GRIS }}>Direccion de destino: </Text>
        {direccion || "Por informar"}
      </Text>
      <Campo rotulo="Obra" valor={obra} />
    </View>
  );
}

function BloqueEmisor({ e, p }: { e: EmisorDoc; p: Parametros }) {
  return (
    <View style={s.bloque}>
      <Text style={s.rotuloBloque}>CONTACTO EN {pTxt(p, "EmpresaMarca", "CENTRO PANEL").toUpperCase()}</Text>
      <Text style={s.destacado}>{e.nombre}</Text>
      <Campo rotulo="Cargo" valor={e.cargo} />
      <Campo rotulo="Correo" valor={e.email} />
      <Campo rotulo="Telefono" valor={e.telefono} />
    </View>
  );
}

export function SolicitudPdf({ d, p }: { d: SolicitudDoc; p: Parametros }) {
  return (
    <Document title={`${d.folio} - ${d.proveedor.nombre}`} author={pTxt(p, "EmpresaNombre")}>
      <Page size="A4" style={s.pagina}>
        <Cabecera p={p} titulo="SOLICITUD DE COTIZACION" numero={d.folio} fecha={d.fecha} />
        <View style={s.bloques}>
          <BloqueProveedor pr={d.proveedor} />
          <BloqueEntrega obra={d.obra} fechaEntrega={d.fechaEntrega} direccion={d.direccionDestino} etiquetaFecha="Fecha de entrega requerida en destino" />
          <BloqueEmisor e={d.emisor} p={p} />
        </View>

        <View style={s.tablaCab} fixed>
          <Text style={[s.celda, s.cNum]}>#</Text>
          <Text style={[s.celda, s.cDesc]}>Descripcion</Text>
          <Text style={[s.celda, s.cUnid]}>Unidad</Text>
          <Text style={[s.celda, s.cCant]}>Cantidad</Text>
          <Text style={[s.celda, s.cPrecio]}>Precio unitario</Text>
        </View>
        {d.items.map((it, i) => (
          <View key={i} style={s.fila_} wrap={false}>
            <Text style={[s.celda, s.cNum]}>{i + 1}</Text>
            <View style={[s.celda, s.cDesc]}>
              <Text>{it.descripcion}</Text>
              {it.nota ? <Text style={s.chico}>{it.nota}</Text> : null}
            </View>
            <Text style={[s.celda, s.cUnid]}>{it.unidad ?? ""}</Text>
            <Text style={[s.celda, s.cCant]}>{fmtUnid(it.cantidad)}</Text>
            <Text style={[s.celda, s.cPrecio]} />
          </View>
        ))}

        <Text style={s.nota}>
          Le pedimos cotizar los items indicados, con entrega en la direccion y la fecha de destino senaladas. Indique en su respuesta el precio unitario de cada
          item, la moneda, el plazo de entrega, las condiciones de pago y la validez de la oferta. Los precios deben incluir el despacho al destino, salvo que
          indique lo contrario.
        </Text>
        {d.notas ? <Text style={s.nota}>Notas: {d.notas}</Text> : null}
      </Page>
    </Document>
  );
}

export function OrdenCompraPdf({ d, p }: { d: OrdenDoc; p: Parametros }) {
  return (
    <Document title={`${d.numero} - ${d.proveedor.nombre}`} author={pTxt(p, "EmpresaNombre")}>
      <Page size="A4" style={s.pagina}>
        <Cabecera p={p} titulo="ORDEN DE COMPRA" numero={d.numero} fecha={d.fecha} />
        {!d.aprobada ? <Text style={s.aviso}>DOCUMENTO NO VALIDO: la orden aun no esta aprobada ({d.estado}).</Text> : null}
        <View style={s.bloques}>
          <BloqueProveedor pr={d.proveedor} />
          <BloqueEntrega obra={d.obra} fechaEntrega={d.fechaEntrega} direccion={d.direccionDestino} etiquetaFecha="Fecha de entrega comprometida en destino" />
          <BloqueEmisor e={d.emisor} p={p} />
        </View>
        {d.condicionesPago ? <Text style={[s.campo, { marginBottom: 8 }]}><Text style={{ color: GRIS }}>Condiciones de pago: </Text>{d.condicionesPago}</Text> : null}

        <View style={s.tablaCab} fixed>
          <Text style={[s.celda, s.cNum]}>#</Text>
          <Text style={[s.celda, s.cDesc]}>Descripcion</Text>
          <Text style={[s.celda, s.cCant]}>Cantidad</Text>
          <Text style={[s.celda, s.cPrecio]}>Precio unitario</Text>
          <Text style={[s.celda, s.cTotal]}>Total</Text>
        </View>
        {d.lineas.map((l, i) => (
          <View key={i} style={s.fila_} wrap={false}>
            <Text style={[s.celda, s.cNum]}>{i + 1}</Text>
            <Text style={[s.celda, s.cDesc]}>{l.descripcion}</Text>
            <Text style={[s.celda, s.cCant]}>{fmtUnid(l.unidades)}</Text>
            <Text style={[s.celda, s.cPrecio]}>{dinero(l.costo, d.moneda)}</Text>
            <Text style={[s.celda, s.cTotal]}>{dinero(l.unidades * l.costo, d.moneda)}</Text>
          </View>
        ))}
        <View style={s.total}>
          <Text>Total (neto)</Text>
          <Text>{dinero(d.total, d.moneda)}</Text>
        </View>
        {d.notas ? <Text style={s.nota}>Notas: {d.notas}</Text> : null}
        <Text style={s.nota}>Confirme la recepcion de esta orden y la fecha de entrega respondiendo al contacto indicado. Indique el numero de la orden en su factura.</Text>
      </Page>
    </Document>
  );
}

export function archivoSolicitudPdf(d: SolicitudDoc, p: Parametros): Promise<Buffer> {
  return renderToBuffer(<SolicitudPdf d={d} p={p} /> as unknown as ReactElement<DocumentProps>);
}

export function archivoOrdenCompraPdf(d: OrdenDoc, p: Parametros): Promise<Buffer> {
  return renderToBuffer(<OrdenCompraPdf d={d} p={p} /> as unknown as ReactElement<DocumentProps>);
}
