import Cabecera from "@/components/Cabecera";
import Configurador from "@/components/Configurador";
import { conPais, contextoMercado, requerirVendedor, tienePerfilAdmin } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerIvaPorPais } from "@/lib/parametros";

export default async function Pagina() {
  const v = await requerirVendedor();
  const esAdmin = tienePerfilAdmin(v);
  const supabase = await createClient();

  // v_materias_primas_venta y no la tabla: no expone el costo de cada insumo,
  // asi el configurador funciona tambien con perfil Vendedor.
  const { paises, idPaisActivo } = await contextoMercado(v);
  const { data: materias } = await conPais(
    supabase
      .from("v_materias_primas_venta")
      .select("id, nombre, tipo, etiqueta, espesor_nominal")
      .eq("activo", true),
    idPaisActivo
  ).order("nombre");

  // MargenObjetivo queda deliberadamente fuera de v_parametros_publicos: revela
  // la estructura de costos. Solo el administrador lo lee, y solo a el se le
  // muestra el campo de margen en pantalla. Cada mercado tiene el suyo.
  let margenPorPais: Record<number, number> = {};
  if (esAdmin) {
    const { data } = await supabase
      .from("parametros")
      .select("id_pais, valor_num")
      .eq("clave", "MargenObjetivo");
    margenPorPais = Object.fromEntries(
      (data ?? []).map((m) => [Number(m.id_pais), Number(m.valor_num ?? 0.3)])
    );
  }

  return (
    <div className="min-h-screen">
      <Cabecera
        titulo="Configurador de paneles SIP"
        subtitulo="Elija la plancha EPS y las placas: el costo y el precio se calculan solos"
      />
      <Configurador
        materias={materias ?? []}
        esAdmin={esAdmin}
        puedeCrear={v.puede_crear || esAdmin}
        margenPorPais={margenPorPais}
        ivaPorPais={await leerIvaPorPais()}
        paises={paises}
      />
    </div>
  );
}
