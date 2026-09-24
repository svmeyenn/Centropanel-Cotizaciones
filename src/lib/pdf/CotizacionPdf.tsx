import type { ReactElement } from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { CotizacionDoc, PersonaDoc } from "@/components/DocumentoCotizacion";
import { pTxt, pNum, type Parametros } from "@/lib/parametros";
import {
  fecha as fmtFecha,
  pesos,
  porcentaje,
  sumarDias,
  unidades as fmtUnid,
} from "@/lib/formato";
import { LOGO_PDF } from "@/lib/logo";

// La cotizacion como archivo PDF, para adjuntarla al correo y compartirla por
// WhatsApp. Replica DocumentoCotizacion --la version en pantalla-- con las
// primitivas de react-pdf; si cambia una, hay que cambiar la otra.

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
  bloque: { flex: 1 },
  rotuloBloque: {
    backgroundColor: CREMA,
    color: DORADO_OSC,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 5,
    marginBottom: 3,
  },
  campo: { fontSize: 7, marginBottom: 1.5 },
  tablaCab: { flexDirection: "row", backgroundColor: VERDE, color: "white", fontSize: 7, fontFamily: "Helvetica-Bold" },
  celda: { paddingVertical: 3, paddingHorizontal: 5 },
  cSku: { width: 58 },
  cDesc: { flex: 1 },
  cUnid: { width: 42, textAlign: "right" },
  cUnit: { width: 70, textAlign: "right" },
  cSub: { width: 80, textAlign: "right" },
  totales: { alignSelf: "flex-end", width: 250, marginTop: 12, marginBottom: 14, fontSize: 8 },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5, paddingHorizontal: 5 },
  pie: { flexDirection: "row", fontSize: 7, lineHeight: 1.45 },
  tituloPie: { color: DORADO_OSC, fontFamily: "Helvetica-Bold", marginBottom: 3 },
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

function Total({
  rotulo,
  valor,
  fondo,
  negrita,
}: {
  rotulo: string;
  valor: string;
  fondo?: string;
  negrita?: boolean;
}) {
  const fuente = negrita || fondo ? "Helvetica-Bold" : "Helvetica";
  return (
    <View
      style={[
        s.total,
        fondo ? { backgroundColor: fondo, color: "white", paddingVertical: 4 } : {},
        { fontFamily: fuente },
      ]}
    >
      <Text>{rotulo}</Text>
      <Text>{valor}</Text>
    </View>
  );
}

export function CotizacionPdf({ d, p }: { d: CotizacionDoc; p: Parametros }) {
  const vence = sumarDias(d.fecha.slice(0, 10), d.validez_dias ?? 7);
  const idTrib = pTxt(p, "EtiquetaIdTributario", "RUT");
  const cli: PersonaDoc = d.cliente ?? {};
  const ven: PersonaDoc = d.vendedor ?? {};

  return (
    <Document title={d.num_cotizacion ?? "Cotizacion"} author={pTxt(p, "EmpresaNombre")}>
      <Page size="A4" style={s.pagina}>
        {/* ---- cabecera ---- */}
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
            <Text style={s.folioNum}>{d.num_cotizacion}</Text>
            <Text style={{ fontSize: 7, color: DORADO }}>
              {pTxt(p, "EmpresaNombre")}   {idTrib} {pTxt(p, "EmpresaRUT")}
            </Text>
            <Text style={{ fontSize: 7 }}>
              Emitida {fmtFecha(d.fecha)}   Vence {fmtFecha(vence)}
            </Text>
          </View>
        </View>

        {/* ---- cliente / ejecutivo ---- */}
        <View style={s.bloques}>
          <View style={[s.bloque, { marginRight: 18 }]}>
            <Text style={s.rotuloBloque}>CLIENTE</Text>
            <Campo rotulo="Razon social" valor={cli.razon_social} />
            <Campo rotulo={idTrib} valor={cli.rut} />
            <Campo rotulo="Contacto" valor={cli.contacto} />
            <Campo rotulo="Correo" valor={cli.email} />
            <Campo rotulo="Telefono" valor={cli.telefono} />
          </View>
          <View style={s.bloque}>
            <Text style={s.rotuloBloque}>EJECUTIVO</Text>
            <Campo rotulo="Nombre" valor={ven.nombre} />
            <Campo rotulo="Cargo" valor={ven.cargo} />
            <Campo rotulo="Correo" valor={ven.email} />
            <Campo rotulo="Telefono" valor={ven.telefono} />
          </View>
        </View>

        {/* ---- items: la cabecera se repite en cada pagina que ocupa la tabla ---- */}
        <View>
        <View style={s.tablaCab} fixed>
          <Text style={[s.celda, s.cSku]}>SKU</Text>
          <Text style={[s.celda, s.cDesc]}>DESCRIPCION</Text>
          <Text style={[s.celda, s.cUnid]}>UNID.</Text>
          <Text style={[s.celda, s.cUnit]}>V. UNITARIO</Text>
          <Text style={[s.celda, s.cSub]}>SUBTOTAL NETO</Text>
        </View>
        {d.items.map((it, i) => (
          <View
            key={i}
            style={[s.fila, { fontSize: 8 }, i % 2 ? { backgroundColor: "#F9FAFB" } : {}]}
            wrap={false}
          >
            <Text style={[s.celda, s.cSku, { color: GRIS }]}>{it.sku ?? ""}</Text>
            <Text style={[s.celda, s.cDesc]}>{it.descripcion}</Text>
            <Text style={[s.celda, s.cUnid]}>{fmtUnid(it.unidades)}</Text>
            <Text style={[s.celda, s.cUnit]}>{pesos(it.valor_unitario)}</Text>
            <Text style={[s.celda, s.cSub]}>
              {pesos(Number(it.unidades) * Number(it.valor_unitario))}
            </Text>
          </View>
        ))}
        </View>

        {/* ---- totales ---- */}
        <View style={s.totales} wrap={false}>
          <Total rotulo="SUBTOTAL" valor={pesos(d.subtotal)} />
          {d.descuento > 0 && (
            <Total
              rotulo={`DESCUENTO${d.descuento2 > 0 ? " 1" : ""}`}
              valor={pesos(d.descuento)}
            />
          )}
          {d.descuento2 > 0 && (
            <Total
              rotulo={`DESCUENTO${d.descuento > 0 ? " 2" : ""}`}
              valor={pesos(d.descuento2)}
            />
          )}
          <Total rotulo="TOTAL NETO" valor={pesos(d.total_neto)} negrita />
          <Total
            rotulo={`${pTxt(p, "NombreImpuesto", "IVA")} ${Math.round(pNum(p, "IVA", 0.19) * 100)}%`}
            valor={pesos(d.iva)}
          />
          <Total rotulo="TOTAL" valor={pesos(d.total)} fondo={VERDE} />
          {d.comision_pct > 0 && (
            <>
              <Total
                rotulo={`RECARGO ${d.medio_pago ?? ""} ${porcentaje(d.comision_pct)}%`}
                valor={pesos(d.total_a_pagar - d.total)}
              />
              <Total rotulo="TOTAL A PAGAR" valor={pesos(d.total_a_pagar)} fondo={DORADO_OSC} />
            </>
          )}
        </View>

        {/* ---- condiciones y datos bancarios ---- */}
        <View style={s.pie} wrap={false}>
          <View style={[s.bloque, { marginRight: 18 }]}>
            <Text style={s.tituloPie}>CONDICIONES COMERCIALES</Text>
            <Text>
              Validez de la cotizacion: {d.validez_dias} dias corridos (vence el {fmtFecha(vence)}).
            </Text>
            <Text>Medio de pago: {d.medio_pago ?? pTxt(p, "MedioPagoDefecto")}</Text>
            {d.forma_pago ? <Text>Forma de pago: {d.forma_pago}</Text> : null}
            {d.tiempo_entrega ? <Text>Tiempo de entrega: {d.tiempo_entrega}</Text> : null}
            <Text>Tarifas: {pTxt(p, "NotaTarifas")}</Text>
            <Text>{pTxt(p, "NotaBodegaje")}</Text>
            <Text>{pTxt(p, "CondDescarga")}</Text>
          </View>
          <View style={s.bloque}>
            <Text style={s.tituloPie}>DATOS PARA EL DEPOSITO</Text>
            <Text>{pTxt(p, "EmpresaNombre")}</Text>
            <Text>{idTrib}: {pTxt(p, "EmpresaRUT")}</Text>
            <Text>Banco: {pTxt(p, "Banco")}</Text>
            <Text>Tipo de cuenta: {pTxt(p, "TipoCuenta")}</Text>
            <Text>N de cuenta: {pTxt(p, "NumeroCuenta")}</Text>
            <Text>Correo: {pTxt(p, "CorreoConfirmacion")}</Text>
          </View>
        </View>

        <Text style={{ marginTop: 14, fontSize: 7 }}>
          <Text style={{ color: DORADO_OSC, fontFamily: "Helvetica-Bold" }}>DESPACHAR A: </Text>
          {d.direccion_despacho ?? ""}
        </Text>
      </Page>
    </Document>
  );
}

// El archivo listo para adjuntar o descargar.
export function archivoCotizacionPdf(d: CotizacionDoc, p: Parametros): Promise<Buffer> {
  // renderToBuffer pide un <Document> directo; CotizacionPdf lo devuelve.
  const doc = <CotizacionPdf d={d} p={p} /> as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(doc);
}
