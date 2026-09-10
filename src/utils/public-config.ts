// Validação de configuração, não validação de autenticidade de tokens.
export function publicConfig(rawUrl: unknown, rawKey: unknown, allowLocal = false) {
  if (typeof rawUrl !== 'string' || typeof rawKey !== 'string' || !rawUrl || !rawKey) throw new Error('Configure VITE_SUPABASE_URL e uma chave publicável em VITE_SUPABASE_ANON_KEY.')
  let url: URL
  try { url = new URL(rawUrl) } catch { throw new Error('URL do Supabase inválida.') }
  const local = allowLocal && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !local)) throw new Error('URL do Supabase inválida; produção exige HTTPS sem credenciais.')
  const key = rawKey.trim()
  if (key.startsWith('sb_publishable_') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return { url: url.toString(), key }
  if (key.startsWith('eyJ')) {
    try {
      const claims = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (claims.role === 'anon') return { url: url.toString(), key }
    } catch { /* mensagem abaixo não revela a chave */ }
  }
  throw new Error('Use somente chave publicável ou anon. Chaves privilegiadas são proibidas no frontend.')
}
