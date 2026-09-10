export const PAGE_SIZE = 50
export function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return <nav className="pagination" aria-label="Paginação da tabela"><button className="button-secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>Anterior</button><span role="status">Página {page + 1} de {pages} · {total} registros</span><button className="button-secondary" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Próxima</button></nav>
}
