import Cabecera from "@/components/Cabecera";
import Configurador from "@/components/Configurador";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { leerParametros, pNum } from "@/lib/parametros";

export default async function Pagina() {
  const v = await requerirVendedor();
  const esAdmin = v.rol === "Administrador";
  const supabase = await createClient();

  // v_materias_primas_venta y no la tabla: no expone el costo de cada insumo,
  // asi el configurador funciona tambien con perfil Vendedor.
  const { data: materias } = await supabase
    .from("v_materias_primas_venta")
    .select("id, nombre, tipo, etiqueta, espesor_nominal")
    .eq("activo", true)
    .order("nombre");

  // MargenObjetivo queda deliberadamente fuera de v_parametros_publicos: revela
  // la estructura de costos. Solo el administrador lo lee, y solo a el se le
  // muestra el campo de margen en pantalla.
  let margenObjetivo = 0.3;
  if (esAdmin) {
    const { data } = await supabase
      .from("parametros")
      .select("valor_num")
      .eq("clave", "MargenObjetivo")
      .single();
    if (data?.valor_num != null) margenObjetivo = Number(data.valor_num);
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
        margenObjetivo={margenObjetivo}
        iva={pNum(await leerParametros(), "IVA", 0.19)}
      />
    </div>
  );
}
