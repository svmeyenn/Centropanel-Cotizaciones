"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClienteIncompleto } from "@/lib/recordatorio";

// Recordatorio de una vez al dia: los clientes de las cotizaciones propias a
// los que les falta correo, ciudad, comuna o contacto. Aparece al entrar y se
// cierra hasta el dia siguiente, para que recuerde sin estorbar.
//
// La marca de "ya lo vi hoy" vive en el navegador: no es un dato del negocio y
// no vale la pena guardarlo en la base.
export default function RecordatorioDatos({
  clientes,
  idVendedor,
}: {
  clientes: ClienteIncompleto[];
  idVendedor: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");

  useEffect(() => {
    if (clientes.length === 0) return;
    const hoy = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD local
    const k = `recordatorio-datos:${idVendedor}:${hoy}`;
    setClave(k);
    try {
      if (!localStorage.getItem(k)) setAbierto(true);
    } catch {
      // Navegador con el almacenamiento bloqueado: se muestra igual.
      setAbierto(true);
    }
  }, [clientes.length, idVendedor]);

  if (!abierto) return null;

  function cerrar() {
    try {
      if (clave) localStorage.setItem(clave, "1");
    } catch {
      /* si no se puede marcar, volvera a aparecer: no es grave */
    }
    setAbierto(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="bg-verde text-white px-4 py-3">
          <div className="text-sm font-semibold">Datos pendientes de clientes</div>
          <div className="text-[11px] text-white/80">
            Pidalos hoy: sin correo no se puede enviar la cotizacion, y sin
            ciudad y comuna no se cotiza el despacho.
          </div>
        </div>

        <ul className="divide-y divide-gray-100">
          {clientes.map((c) => (
            <li key={c.id} className="px-4 py-2 text-xs">
              <div className="font-semibold text-verde">{c.razon_social}</div>
              <div className="text-gray-600">
                Falta: {c.falta.join(", ")}
                {c.cotizacion ? ` · ultima cotizacion ${c.cotizacion}` : ""}
              </div>
            </li>
          ))}
        </ul>

        <div className="px-4 py-3 flex flex-wrap gap-2 justify-end border-t border-gray-100">
          <Link
            href="/clientes"
            onClick={cerrar}
            className="bg-verde text-white text-xs font-semibold px-3 py-1.5 rounded"
          >
            Ir a Clientes
          </Link>
          <button
            onClick={cerrar}
            className="border border-gray-300 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded"
          >
            Recordar manana
          </button>
        </div>
      </div>
    </div>
  );
}
