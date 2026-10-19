"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { segundosDesdeUltimoWhatsapp } from "@/app/leads/mensaje";

// Pausa minima entre un WhatsApp y el siguiente: mandar uno tras otro sin pausa es lo que lleva a
// WhatsApp a bloquear el numero.
export const PAUSA_WHATSAPP = 20;

type Aviso = { ok: boolean; texto: string } | null;

// Espera el turno de un WhatsApp: si el ultimo salio hace menos de 20 segundos --a cualquier
// lead--, avisa y espera lo que falta. `esperarTurno` devuelve false si la persona cancela.
export function useTurnoWhatsapp(avisar: (a: Aviso) => void) {
  const [espera, setEspera] = useState<number | null>(null);
  const cancelarRef = useRef<(() => void) | null>(null);

  // Si la pantalla se cierra mientras se espera, no queda un reloj corriendo.
  useEffect(() => () => cancelarRef.current?.(), []);

  const esperarTurno = useCallback(async (): Promise<boolean> => {
    const desde = await segundosDesdeUltimoWhatsapp();
    if (desde == null || desde >= PAUSA_WHATSAPP) return true;
    let falta = Math.ceil(PAUSA_WHATSAPP - desde);
    const primero = Math.round(desde);
    avisar({
      ok: false,
      texto: `Advertencia: solo pasaron ${primero} segundo${primero === 1 ? "" : "s"} desde el ultimo WhatsApp. Se espera a completar ${PAUSA_WHATSAPP} para que WhatsApp no bloquee el numero; el mensaje sale solo.`,
    });
    return new Promise<boolean>((resolver) => {
      setEspera(falta);
      const reloj = setInterval(() => {
        falta -= 1;
        if (falta <= 0) {
          clearInterval(reloj);
          cancelarRef.current = null;
          setEspera(null);
          avisar(null);
          resolver(true);
        } else setEspera(falta);
      }, 1000);
      cancelarRef.current = () => {
        clearInterval(reloj);
        cancelarRef.current = null;
        setEspera(null);
        avisar({ ok: false, texto: "Se cancelo el envio. No quedo anotado en el lead." });
        resolver(false);
      };
    });
  }, [avisar]);

  const cancelar = useCallback(() => cancelarRef.current?.(), []);

  return { espera, esperarTurno, cancelar };
}
