import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { assertBuildPublicConfig } from './src/utils/public-config.ts'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build') assertBuildPublicConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  return { plugins: [react()] }
})
