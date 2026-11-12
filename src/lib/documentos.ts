import { ES_SANDBOX } from "@/lib/supabase/esquema";

// Deposito de la biblioteca de documentos para clientes (fichas tecnicas, catalogos,
// certificados): uno por copia de datos, igual que los archivos de los leads.
export const BUCKET_DOCUMENTOS = ES_SANDBOX ? "documentos-sandbox" : "documentos";

// Un documento de la biblioteca, tal como se ofrece al escribirle a un lead.
export type DocumentoAdjuntable = { id: number; nombre: string; nota: string; tamano: number };
