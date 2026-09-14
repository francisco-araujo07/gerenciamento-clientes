/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_FF_GLC_FUNIL_STATUS?: string
  readonly VITE_FF_GLC_FILA_CADENCIA?: string
  readonly VITE_FF_GLC_KIT_WHATSAPP?: string
  readonly VITE_FF_GLC_PORTEIRO_DECISOR?: string
  readonly VITE_FF_GLC_GUIA_CONVERSA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
