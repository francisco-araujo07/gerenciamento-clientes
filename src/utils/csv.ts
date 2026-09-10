export const MAX_CSV_BYTES = 2 * 1024 * 1024
export const MAX_CSV_ROWS = 500

export function parseCsv(text: string) {
  if (text.length > MAX_CSV_BYTES) throw new Error('CSV excede o limite de 2 MB.')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closedQuote = false
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (closedQuote && char !== ',' && char !== '\n') throw new Error('CSV inválido após fechamento de aspas.')
    if (char === '"') {
      if (!quoted && cell.length) throw new Error('Aspas em posição inválida no CSV.')
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1 }
      else { quoted = !quoted; closedQuote = !quoted }
    } else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; closedQuote = false }
    else if (char === '\n' && !quoted) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; closedQuote = false }
    else cell += char
    if (cell.length > 10000 || row.length > 50 || rows.length > MAX_CSV_ROWS + 1) throw new Error('CSV excede os limites de tamanho, colunas ou 500 linhas.')
  }
  if (quoted) throw new Error('CSV contém aspas não fechadas.')
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  if (rows.length > MAX_CSV_ROWS + 1) throw new Error('Importe no máximo 500 linhas por arquivo.')
  return rows
}
