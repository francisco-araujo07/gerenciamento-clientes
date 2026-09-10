export type ReadPage<T> = { data: T[] | null; error: unknown; count: number | null }
export type ReadPageFetcher<T> = (from: number, to: number) => PromiseLike<ReadPage<T>>
export type PageResult<T> = { data: T[]; count: number }

export const READ_ALL_PAGE_SIZE = 500
export const MAX_READ_ALL_ROWS = 20000

// Leitura limitada para os filtros locais do MVP. Nunca devolver total parcial como completo.
export async function readAll<T>(fetchPage: ReadPageFetcher<T>, limit = MAX_READ_ALL_ROWS) {
  const result: T[] = []
  let expected: number | undefined
  for (;;) {
    const { data, error, count } = await fetchPage(result.length, result.length + READ_ALL_PAGE_SIZE - 1)
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
