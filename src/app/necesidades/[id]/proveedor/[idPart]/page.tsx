import VistaProveedorNm from "@/components/VistaProveedorNm";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ id: string; idPart: string }> }) {
  const { id, idPart } = await params;
  return <VistaProveedorNm idNm={Number(id)} idPart={Number(idPart)} modo="detalle" />;
}
