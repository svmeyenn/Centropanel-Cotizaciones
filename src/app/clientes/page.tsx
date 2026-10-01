import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorFichas from "@/components/GestorFichas";
import {
  conPais,
  contextoMercado,
  requerirVendedor,
  tienePerfilAdmin,
} from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import {
  TIPOS_FICHA,
  type CuentaBancaria,
  type Ficha,
  type TipoFicha,
} from "@/lib/fichas";

export const dynamic = "force-dynamic";

// Una sola lista de terceros. Se entra con una marca ya elegida --el menu de
// Vender trae ?tipo=cliente-- y desde ahi se cambia sin salir de la pantalla.
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo } = await searchParams;
  const v = await requerirVendedor();
  const supabase = await createClient();
  const { paises, esAdminGeneral, idPaisActivo } = await contextoMercado(v);

  const veFinanzas =
    v.fin_mantenedores ||
    v.fin_editar ||
    v.fin_ver_todo ||
    v.fin_ver_egresos ||
    v.fin_ver_ingresos ||
    v.fin_ver_cartola ||
    v.fin_ver_informes ||
    v.fin_solicitar_gastos ||
    v.fin_rendir_gastos ||
    v.fin_pagar_gastos;

  const { data: filas } = await conPais(
    supabase
      .from("entidades")
      .select(
        "id_entidad, id_pais, razon_social, nombre_referencia, rut, contacto, email, telefono, direccion, comuna, ciudad, con_transferencia, activo"
      ),
    idPaisActivo
  ).order("razon_social");

  const { data: marcas } = await supabase.from("entidad_tipos").select("id_entidad, tipo");

  const porFicha = new Map<number, TipoFicha[]>();
  for (const m of marcas ?? []) {
    const lista = porFicha.get(m.id_entidad) ?? [];
    lista.push(m.tipo as TipoFicha);
    porFicha.set(m.id_entidad, lista);
  }

  const fichas: Ficha[] = (filas ?? []).map((f) => ({
    ...f,
    tipos: porFicha.get(f.id_entidad) ?? [],
  }));

  // Los datos de pago solo viajan a la pantalla de quien los puede ver: lo que
  // no sale del servidor no se puede mirar en el navegador.
  const cuentas: Record<number, CuentaBancaria[]> = {};
  if (veFinanzas) {
    const { data: ctas } = await supabase
      .from("interlocutor_cuentas")
      .select("id_interlocutor, banco, tipo_cuenta, numero_cuenta, email")
      .order("id_int_cuenta");
    for (const c of ctas ?? []) {
      const lista = cuentas[c.id_interlocutor] ?? [];
      lista.push({
        banco: c.banco ?? "",
        tipo_cuenta: c.tipo_cuenta ?? "",
        numero_cuenta: c.numero_cuenta ?? "",
        email: c.email ?? "",
      });
      cuentas[c.id_interlocutor] = lista;
    }
  }

  const esTipo = TIPOS_FICHA.some((t) => t.tipo === tipo);
  const filtroInicial = esTipo && (veFinanzas || tipo === "cliente")
    ? (tipo as TipoFicha)
    : veFinanzas
      ? "todos"
      : "cliente";

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo={veFinanzas ? "Clientes y proveedores" : "Clientes"}
        subtitulo="Una ficha por cada persona o empresa con la que tratamos"
      />
      <div className="max-w-screen-2xl mx-auto p-6 space-y-4">
        <BarraNavegacion />
        <GestorFichas
          fichas={fichas}
          cuentas={cuentas}
          paises={paises}
          esAdminGeneral={esAdminGeneral}
          puedeEditar={
            v.puede_editar || tienePerfilAdmin(v) || v.fin_mantenedores || v.fin_editar
          }
          veFinanzas={veFinanzas}
          puedeJuntar={v.fin_mantenedores || v.puede_editar || tienePerfilAdmin(v)}
          filtroInicial={filtroInicial}
        />
      </div>
    </div>
  );
}
