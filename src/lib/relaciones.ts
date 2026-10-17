// PostgREST devuelve una relacion como objeto o como lista de uno segun como
// la declare la base; aqui se lee siempre como objeto.
export const uno = <T,>(x: unknown): T | null =>
  Array.isArray(x) ? ((x[0] as T) ?? null) : ((x as T) ?? null);
