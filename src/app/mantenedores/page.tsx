import { redirect } from "next/navigation";

// Cada lista tiene ahora su propia direccion. Esta queda como atajo para los
// enlaces viejos y para quien escriba /mantenedores a mano.
export default function Pagina() {
  redirect("/mantenedores/cuentas");
}
