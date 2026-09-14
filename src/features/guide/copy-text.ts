export async function copyTextToClipboard(text: string) {
  const value = text.trim()
  if (!value) throw new Error('Não há texto para copiar.')
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  if (typeof document === 'undefined') throw new Error('Área de transferência indisponível.')
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', 'true')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  if (!ok) throw new Error('Não foi possível copiar o texto.')
}
