"use client";

import Link from "next/link";
import { ajusteVehiculo, resumirCarga, type LineaCarga } from "@/lib/carga";
import type { OpcionVehiculo } from "@/lib/transportes";

const f = (n: number | null, d = 0) => (n == null ? "—" : n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d }));

// La carga del viaje: peso, volumen y pieza mas larga, sumados desde los catalogos. Lo que el catalogo no
// trae se dice, y se avisa si lo elegido no entra en el vehiculo.
export default function CargaViaje({
  lineas,
  vehiculo,
  puedeCompletar,
}: {
  lineas: LineaCarga[];
  vehiculo: OpcionVehiculo | null;
  puedeCompletar: boolean;
}) {
  if (lineas.length === 0) {
    return <p className="text-xs text-gray-500">No hay items con carga para mover.</p>;
  }
  const r = resumirCarga(lineas);
  const ajuste = vehiculo ? ajusteVehiculo(r, vehiculo) : null;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Cifra t="Peso" v={`${f(r.pesoKg)} kg`} />
        <Cifra t="Volumen" v={`${f(r.volumenM3, 1)} m³`} />
        <Cifra t="Pieza mas larga" v={`${f(r.largoMaxM, 2)} m`} />
        <Cifra t="Items" v={String(r.lineas)} />
      </dl>
      {(r.sinPeso > 0 || r.sinMedidas > 0) && (
        <p role="status" className="text-xs bg-crema border border-dorado text-dorado-osc rounded px-2 py-1">
          {r.sinPeso > 0 && `${r.sinPeso} item${r.sinPeso > 1 ? "s" : ""} sin peso en el catalogo. `}
          {r.sinMedidas > 0 && `${r.sinMedidas} sin medidas. `}
          El total es lo que se pudo sumar, no la carga completa.{" "}
          {puedeCompletar && (
            <Link href="/datos-carga" className="underline font-semibold">
              Completar peso y dimensiones
            </Link>
          )}
        </p>
      )}
      {ajuste &&
        (ajuste.ok ? (
          <p role="status" className="text-xs text-green-800">Entra en {vehiculo!.etiqueta} segun lo que tiene declarado.</p>
        ) : (
          <p role="alert" className="text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2 py-1">
            No entra en {vehiculo!.etiqueta}: {ajuste.avisos.join("; ")}.
          </p>
        ))}
      <details className="text-xs">
        <summary className="cursor-pointer text-verde font-semibold">Ver el detalle por item</summary>
        <div className="overflow-x-auto mt-1 border border-gray-200 rounded">
          <table className="w-full">
            <thead className="bg-verde text-white">
              <tr>
                <th scope="col" className="text-left px-2 py-1">Item</th>
                <th scope="col" className="text-right px-2 py-1">Unid.</th>
                <th scope="col" className="text-right px-2 py-1">Medidas (mm)</th>
                <th scope="col" className="text-right px-2 py-1">Peso unit. (kg)</th>
                <th scope="col" className="text-right px-2 py-1">Peso (kg)</th>
                <th scope="col" className="text-right px-2 py-1">Volumen (m³)</th>
                <th scope="col" className="text-left px-2 py-1">Dato</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <th scope="row" className="text-left px-2 py-1 font-normal">{l.descripcion}</th>
                  <td className="px-2 py-1 text-right tabular-nums">{f(l.unidades, 0)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {l.ancho_mm == null && l.largo_mm == null && l.alto_mm == null ? "—" : `${f(l.ancho_mm)} × ${f(l.largo_mm)} × ${f(l.alto_mm, 1)}`}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{f(l.peso_unit, 1)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{f(l.peso_total, 1)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{f(l.volumen_m3, 2)}</td>
                  <td className="px-2 py-1">
                    {l.origen === "falta" ? <span className="text-amber-700 font-semibold">falta</span> : l.origen === "calculado" ? "calculado" : "catalogo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Cifra({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-dorado-osc font-semibold">{t}</dt>
      <dd className="text-gray-900 font-semibold tabular-nums">{v}</dd>
    </div>
  );
}
