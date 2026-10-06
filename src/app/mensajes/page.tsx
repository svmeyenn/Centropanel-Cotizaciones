import Link from "next/link";
import { redirect } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import BarraNavegacion from "@/components/BarraNavegacion";
import GestorPlantillas from "@/components/GestorPlantillas";
import { puedeVerRuta } from "@/lib/menu";
import { requerirVendedor } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { MARCADORES, type Canal, type Plantilla } from "@/lib/mensajes";
import { LINEAS } from "@/lib/leads";

export const metadata = { title: "Mensajes a leads" };
export const dynamic = "force-dynamic";

const CANALES: Record<Canal, string> = { email: "Correos", whatsapp: "WhatsApp" };

// Los correos y los WhatsApp que se ofrecen al escribirle a un lead. Quien
// escribe elige uno, lo revisa y lo envia el mismo: nada sale solo.
export default async function Pagina({ searchParams }: { searchParams: Promise<{ canal?: string; linea?: string }> }) {
  const v = await requerirVendedor();
  if (!puedeVerRuta(v, "/mensajes")) redirect("/");

  const sp = await searchParams;
  const canal: Canal = sp.canal === "whatsapp" ? "whatsapp" : "email";
  const supabase = await createClient();
  // Las lineas que hay: las del sistema y las que ya tengan mensajes.
  const { data: usadas } = await supabase.from("plantillas_mensaje").select("linea");
  const lineas = [...new Set([...Object.keys(LINEAS), ...((usadas ?? []) as { linea: string }[]).map((x) => x.linea)])];
  const linea = sp.linea && lineas.includes(sp.linea) ? sp.linea : lineas[0];
  const { data, error } = await supabase
    .from("plantillas_mensaje")
    .select("id, canal, linea, nombre, asunto, cuerpo, orden, activo")
    .eq("canal", canal)
    .eq("linea", linea)
    .order("orden")
    .order("id");

  return (
    <div className="min-h-screen">
      <Cabecera titulo="MENSAJES A LEADS" subtitulo="Correos y WhatsApp para escribirle al contacto de un lead" />
      <div className="max-w-screen-xl mx-auto p-4 space-y-3">
        <BarraNavegacion />

        <nav aria-label="Linea" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[11px] font-semibold text-dorado-osc">Linea</span>
          {lineas.map((l) => (
            <Link
              key={l}
              href={`/mensajes?linea=${l}&canal=${canal}`}
              aria-current={l === linea ? "page" : undefined}
              className={`bg-dorado-osc text-white text-xs font-semibold px-2.5 py-1 rounded ${l === linea ? "ring-2 ring-verde ring-offset-1" : "opacity-70"}`}
            >
              {LINEAS[l as keyof typeof LINEAS] ?? l}
            </Link>
          ))}
        </nav>

        <nav aria-label="Canal" className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(CANALES) as Canal[]).map((c) => (
            <Link
              key={c}
              href={`/mensajes?linea=${linea}&canal=${c}`}
              aria-current={c === canal ? "page" : undefined}
              className={`bg-verde text-white text-xs font-semibold px-2.5 py-1 rounded ${c === canal ? "ring-2 ring-dorado ring-offset-1" : "opacity-70"}`}
            >
              {CANALES[c]}
            </Link>
          ))}
        </nav>

        <div className="bg-white border border-gray-200 rounded px-3 py-2 text-[12px] text-gray-700 space-y-1">
          <p>
            Cada linea tiene su juego de mensajes: en la ficha de un lead, &quot;Escribirle al contacto&quot; ofrece los de la linea de ese lead. Se llenan con los datos del lead y de quien
            escribe, quedan a la vista para revisarlos y los envia la persona desde su correo o su telefono. Al armarlos queda anotado en
            &quot;Conversaciones y compromisos&quot; del lead, con un seguimiento a tres dias. Se adjunta el PDF de la cotizacion, nunca un
            enlace.
          </p>
          <p className="text-[11px] text-gray-600">
            Marcadores:{" "}
            {MARCADORES.map((m) => (
              <span key={m.marca} title={m.ayuda} className="inline-block mr-2">
                <code className="bg-gray-100 rounded px-1">{m.marca}</code>
              </span>
            ))}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-700">No se pudieron leer los mensajes: {error.message}</p>
        ) : (
          <GestorPlantillas key={`${linea}-${canal}`} linea={linea} canal={canal} plantillas={(data ?? []) as Plantilla[]} />
        )}
      </div>
    </div>
  );
}
