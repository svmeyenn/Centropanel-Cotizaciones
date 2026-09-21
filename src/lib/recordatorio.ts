import { createClient } from "@/lib/supabase/server";
import type { Vendedor } from "@/types/database";

// Clientes con datos a medias en las cotizaciones de quien esta conectado.
// El correo, la ciudad, la comuna y el contacto no son burocracia: sin correo
// no se puede mandar la cotizacion, y sin ciudad y comuna no se cotiza el
// flete. Se le recuerda a quien cotizo, que es quien tiene el trato con el
// cliente y puede pedirlos.
export interface ClienteIncompleto {
  id: number;
  razon_social: string;
  falta: string[];
  cotizacion: string | null;
}

interface FilaCliente {
  id: number;
  razon_social: string | null;
  email: string | null;
  ciudad: string | null;
  comuna: string | null;
  contacto: string | null;
}

export async function clientesIncompletos(
  v: Pick<Vendedor, "id">
): Promise<ClienteIncompleto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cotizaciones")
    .select(
      "num_cotizacion, clientes(id, razon_social, email, ciudad, comuna, contacto)"
    )
    .eq("id_vendedor", v.id)
    .order("id", { ascending: false })
    .limit(300);

  const porCliente = new Map<number, ClienteIncompleto>();
  for (const c of data ?? []) {
    const cli = (Array.isArray(c.clientes) ? c.clientes[0] : c.clientes) as
      | FilaCliente
      | null;
    if (!cli || porCliente.has(Number(cli.id))) continue;

    const falta: string[] = [];
    if (!cli.email?.trim()) falta.push("Correo");
    if (!cli.ciudad?.trim()) falta.push("Ciudad");
    if (!cli.comuna?.trim()) falta.push("Comuna");
    if (!cli.contacto?.trim()) falta.push("Contacto");
    if (falta.length === 0) continue;

    porCliente.set(Number(cli.id), {
      id: Number(cli.id),
      razon_social: cli.razon_social ?? "",
      falta,
      cotizacion: (c.num_cotizacion as string) ?? null,
    });
  }

  return [...porCliente.values()];
}
