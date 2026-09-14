"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Cabecera from "@/components/CabeceraBase";

// "Olvide mi contrasena". Manda al correo un enlace de un solo uso que lleva a
// elegir una clave nueva. Es la unica forma de recuperarla sin el
// administrador: para probar que la persona es quien dice, hace falta su
// correo.
export default function Recuperar() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const supabase = createClient();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(
    params.get("error") === "enlace"
      ? "El enlace vencio o ya se uso. Pida uno nuevo."
      : ""
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/cambiar-clave` }
    );
    setCargando(false);

    // El limite de envios si se informa: si no, la persona esperaria un correo
    // que no va a llegar.
    if (err && err.message.toLowerCase().includes("rate")) {
      setError("Se pidieron demasiados enlaces seguidos. Intente en unos minutos.");
      return;
    }
    // Cualquier otro caso muestra lo mismo, exista o no el correo: decir "ese
    // correo no esta registrado" le serviria a quien quiera adivinar cuentas.
    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm overflow-hidden">
        <Cabecera
          titulo="Recuperar clave"
          subtitulo="Le enviamos un enlace a su correo"
          enlazarLogo={false}
        />
        {enviado ? (
          <div className="p-6 space-y-4 text-sm">
            <p>
              Si <strong>{email}</strong> esta registrado, en unos minutos le
              llegara un correo con el enlace para elegir una clave nueva.
            </p>
            <p className="text-gray-600 text-xs">
              Revise tambien la carpeta de spam. El enlace sirve una sola vez y
              debe abrirse en este mismo navegador.
            </p>
            <p className="text-center text-xs">
              <Link href="/login" className="text-verde underline">
                Volver al ingreso
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={enviar} className="p-6 space-y-4">
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
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-verde text-white font-semibold rounded py-1.5 text-xs hover:opacity-90 disabled:opacity-50"
            >
              {cargando ? "Enviando..." : "Enviar enlace"}
            </button>
            <p className="text-center text-xs">
              <Link href="/login" className="text-verde underline">
                Volver al ingreso
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
