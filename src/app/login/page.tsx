"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Cabecera from "@/components/Cabecera";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: clave,
    });

    setCargando(false);
    if (error) {
      setMensaje("Correo o contrasena incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm overflow-hidden">
        <Cabecera
          titulo="COTIZADOR SIP"
          subtitulo="Ingrese con su correo y contrasena"
          enlazarLogo={false}
        />
        <form onSubmit={entrar} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-dorado-osc mb-1">
              Correo
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde"
              placeholder="nombre@centropanel.cl"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dorado-osc mb-1">
              Contrasena
            </label>
            <input
              type="password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde"
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
            {cargando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
