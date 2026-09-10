type Page<T> = { data: T[] | null; error: unknown; count: number | null }

// Leitura limitada para os filtros locais do MVP. Nunca devolver total parcial como completo.
export async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>, limit = 20000) {
  const result: T[] = []
  let expected: number | undefined
  for (;;) {
    const { data, error, count } = await fetchPage(result.length, result.length + 499)
    if (error) throw error
    if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Contagem de registros indisponível.')
    if (count > limit) throw new Error('Volume excede o limite de leitura. Refine a consulta.')
    if (expected !== undefined && count !== expected) throw new Error('Os dados mudaram durante a leitura. Atualize a página.')
    expected = count
    result.push(...(data ?? []))
    if (result.length === count) return result
    if (!data?.length || result.length > count) throw new Error('Leitura incompleta. Atualize a página.')
  }
}
