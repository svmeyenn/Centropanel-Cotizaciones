import type { Pais } from "@/types/database";

// Nombre del impuesto en pantalla: IVA en Chile, IGV en Peru. Con un pais
// indicado, el suyo; sin pais --vista Todos-- los de todos los mercados
// alcanzados, por ejemplo "IVA / IGV".
export function nombreImpuesto(
  paises: Pick<Pais, "id" | "codigo">[],
  idPais?: number | null
): string {
  const deCodigo = (codigo?: string) => (codigo === "PE" ? "IGV" : "IVA");
  if (idPais != null) return deCodigo(paises.find((p) => p.id === idPais)?.codigo);
  const nombres = [...new Set(paises.map((p) => deCodigo(p.codigo)))];
  return nombres.join(" / ") || "IVA";
}
