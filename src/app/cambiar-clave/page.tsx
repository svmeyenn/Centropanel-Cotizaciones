"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Cabecera from "@/components/CabeceraBase";

// Cambio de clave. Llega aqui quien entro con una clave temporal --creada o
// blanqueada por el administrador-- y quien abrio el enlace de "olvide mi
// contrasena". Tambien se puede abrir a voluntad.
export default function CambiarClave() {
  const router = useRouter();
  const supabase = createClient();
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");

    if (clave.length < 8) {
      setMensaje("La clave debe tener al menos 8 caracteres.");
      return;
    }
    if (clave !== repetida) {
      setMensaje("Las dos claves no coinciden.");
      return;
    }

    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) {
      setCargando(false);
      setMensaje(
        error.message.toLowerCase().includes("session")
          ? "La sesion vencio. Vuelva a entrar o pida un enlace nuevo."
          : error.message.toLowerCase().includes("different")
            ? "La clave nueva debe ser distinta de la anterior."
            : error.message
      );
      return;
    }

    // Apaga la obligacion de cambiarla; sin esto el sistema la volveria a pedir.
    await supabase.rpc("marcar_clave_cambiada");
    setCargando(false);
    router.push("/");
    router.refresh();
  }

  const input =
    "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde";

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm overflow-hidden">
        <Cabecera
          titulo="Elija su clave"
          subtitulo="Reemplaza la clave temporal o la que olvido"
          enlazarLogo={false}
        />
        <form onSubmit={guardar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-dorado-osc mb-1">
              Clave nueva
            </label>
            <input
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className={input}
            />
            <span className="block text-[11px] text-gray-500 mt-1">
              Al menos 8 caracteres.
            </span>
          </div>
          <div>
            <label className="block text-sm font-semibold text-dorado-osc mb-1">
              Repita la clave
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              className={input}
            />
          </div>
          {mensaje && (
            <p className="text-sm text-red-600" role="alert">
              {mensaje}
            </p>
          )}
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-verde text-white font-semibold rounded py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
          >
            {cargando ? "Guardando..." : "Guardar clave"}
          </button>
          <p className="text-center text-xs">
            <Link href="/login" className="text-verde underline">
              Volver al ingreso
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
