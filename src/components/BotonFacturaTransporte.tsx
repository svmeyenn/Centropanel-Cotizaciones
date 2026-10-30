"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FormularioEgreso from "@/components/finanzas/FormularioEgreso";
import type { Categoria, Cuenta, Interlocutor, Proyecto } from "@/lib/finanzas/tipos";

// Carga la factura del transportista de un pedido: es un egreso del proyecto del pedido, en la categoria de fletes. Queda
// pendiente de aprobacion y, una vez aprobado, baja el margen real del pedido.
export default function BotonFacturaTransporte({
  numPedido,
  idProyecto,
  idCategoria,
  cuentas,
  proyectos,
  categorias,
  interlocutores,
}: {
  numPedido: string;
  idProyecto: number;
  idCategoria: number | null;
  cuentas: Cuenta[];
  proyectos: Proyecto[];
  categorias: Categoria[];
  interlocutores: Interlocutor[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="pt-1 flex flex-wrap items-center gap-2">
      <button type="button" className="border border-gray-300 bg-white text-gray-800 text-[11px] font-semibold px-2 py-0.5 rounded" onClick={() => { setAviso(null); setAbierto(true); }}>
        Cargar factura de transporte
      </button>
      {aviso && <span className="text-[11px] text-green-800">{aviso}</span>}
      {abierto && (
        <FormularioEgreso
          movimiento={null}
          inicial={{ id_proyecto: idProyecto, id_categoria: idCategoria, comentario: `Factura de transporte del pedido ${numPedido}` }}
          cuentas={cuentas}
          proyectos={proyectos}
          categorias={categorias}
          interlocutores={interlocutores}
          puedePagar={false}
          alCerrar={(mensaje) => {
            setAbierto(false);
            if (mensaje) {
              setAviso("Factura cargada: entra al margen real cuando se apruebe.");
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
