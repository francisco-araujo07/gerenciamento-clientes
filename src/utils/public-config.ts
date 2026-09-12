function envText(value: unknown) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

// Validação de configuração, não validação de autenticidade de tokens.
export function publicConfig(rawUrl: unknown, rawKey: unknown, allowLocal = false) {
  const urlText = envText(rawUrl)
  const keyText = envText(rawKey)
  if (!urlText || !keyText) throw new Error('Configure VITE_SUPABASE_URL e uma chave publicável em VITE_SUPABASE_ANON_KEY.')
  let url: URL
  try { url = new URL(urlText) } catch { throw new Error('URL do Supabase inválida.') }
  const local = allowLocal && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !local)) throw new Error('URL do Supabase inválida; produção exige HTTPS sem credenciais.')
  const key = keyText
  if (key.startsWith('sb_publishable_') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return { url: url.toString(), key }
  if (key.startsWith('eyJ')) {
    try {
      const parts = key.split('.')
      if (parts.length !== 3) throw new Error('JWT inválido.')
      const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (claims.role === 'anon') return { url: url.toString(), key }
    } catch { /* mensagem abaixo não revela a chave */ }
  }
  throw new Error('Use somente chave publicável ou anon. Chaves privilegiadas são proibidas no frontend.')
}

/** Build: sem vars (Preview Pages) não aborta; par incompleto ou chave privilegiada continua falhando. */
export function assertBuildPublicConfig(rawUrl: unknown, rawKey: unknown) {
  if (!envText(rawUrl) && !envText(rawKey)) return null
  return publicConfig(rawUrl, rawKey)
}
