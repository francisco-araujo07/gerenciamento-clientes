import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { parseFeatureFlag, isGlcReuniaoEnabled } from '../src/utils/feature-flags.ts'
import { leadUpdatePayload } from '../src/utils/validation.ts'
import { recifeDate } from '../src/utils/dates.ts'
import { updateLeadStatus } from '../src/features/leads/lead-service.ts'
import {
  CONFIRMAR_REUNIAO_NEXT_ACTION,
  reuniaoConfirmDueDate,
  reuniaoCountdown,
  reuniaoHojeCtas,
  reuniaoJaPassou,
  validateReuniaoResultado,
} from '../src/features/reuniao/reuniao.ts'
import { marcarReuniao, registrarResultadoReuniao, shouldMarcarReuniao } from '../src/features/reuniao/reuniao-service.ts'
import { lossReasons } from '../src/types/lead.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('CA-F5-01 flag de reunião fica desligada por padrão e só liga com valores explícitos', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(isGlcReuniaoEnabled(), false)
  assert.equal(isGlcReuniaoEnabled('true'), true)
  assert.equal(isGlcReuniaoEnabled('1'), true)
  assert.equal(isGlcReuniaoEnabled('ON'), true)
  assert.equal(isGlcReuniaoEnabled('off'), false)
  assert.equal(shouldMarcarReuniao('reuniao_marcada', false), false)
  assert.equal(shouldMarcarReuniao('reuniao_marcada', true), true)
  assert.equal(shouldMarcarReuniao('perdido', true), false)
})

test('CA-F5-05 D-1 é o dia civil anterior em America/Recife, não a data UTC nem −24h como critério', () => {
  // 22:00 Recife do dia 21 = 01:00 UTC do dia 22. Civil Recife = 21; D-1 = 20.
  assert.equal(reuniaoConfirmDueDate('2026-09-22T01:00:00.000Z'), '2026-09-20')
  assert.equal(recifeDate(new Date('2026-09-22T01:00:00.000Z')), '2026-09-21')
  // 14:00 Recife do dia 22 → D-1 = 21.
  assert.equal(reuniaoConfirmDueDate('2026-09-22T14:00:00-03:00'), '2026-09-21')
  // Meia-noite e meia em Recife ainda é o dia 22; D-1 permanece 21 (não “menos 24h” como timestamp de due).
  assert.equal(reuniaoConfirmDueDate('2026-09-22T00:30:00-03:00'), '2026-09-21')
  assert.equal(CONFIRMAR_REUNIAO_NEXT_ACTION, 'Confirmar reunião no WhatsApp')
})

test('CA-F5-08 CTAs da fila: confirmar enquanto pendente no futuro; registrar depois que reuniao_em passou', () => {
  const now = new Date('2026-09-21T15:00:00-03:00')
  const base = { status: 'reuniao_marcada', reuniao_resultado: 'pendente' }
  assert.deepEqual(
    reuniaoHojeCtas({ ...base, reuniao_em: '2026-09-22T10:00:00-03:00' }, now),
    { confirmar: true, registrar: false },
  )
  assert.deepEqual(
    reuniaoHojeCtas({ ...base, reuniao_em: '2026-09-21T14:00:00-03:00' }, now),
    { confirmar: false, registrar: true },
  )
  assert.deepEqual(
    reuniaoHojeCtas({ status: 'proposta_enviada', reuniao_em: '2026-09-21T14:00:00-03:00', reuniao_resultado: 'pendente' }, now),
    { confirmar: false, registrar: false },
  )
  assert.equal(reuniaoJaPassou('2026-09-21T14:00:00-03:00', now), true)
  assert.match(reuniaoCountdown('2026-09-22T10:00:00-03:00', now).label, /Faltam/)
  assert.match(reuniaoCountdown('2026-09-21T14:00:00-03:00', now).label, /passou/)
})

test('CA-F5 fluxos de resultado recusou e reagendou validam no cliente', () => {
  assert.throws(() => validateReuniaoResultado({ resultado: 'reagendou' }, lossReasons))
  validateReuniaoResultado({ resultado: 'reagendou', reuniaoEm: '2026-09-24T10:00:00-03:00' }, lossReasons)
  assert.throws(() => validateReuniaoResultado({ resultado: 'recusou' }, lossReasons))
  assert.throws(() => validateReuniaoResultado({ resultado: 'recusou', motivoPerda: 'outro' }, lossReasons))
  validateReuniaoResultado({ resultado: 'recusou', motivoPerda: 'preco' }, lossReasons)
  validateReuniaoResultado({ resultado: 'compareceu' }, lossReasons)
})

test('CA-F5 payload cadastral nunca envia campos F5 nem proxima_acao_*', () => {
  const updated = leadUpdatePayload({
    company_name: 'x',
    reuniao_local: 'Sala 2',
    reuniao_resultado: 'compareceu',
    reuniao_notas: 'ok',
    reuniao_em: '2026-09-22T14:00:00-03:00',
    next_action: 'não deve ir',
  })
  assert.equal('reuniao_local' in updated, false)
  assert.equal('reuniao_resultado' in updated, false)
  assert.equal('reuniao_notas' in updated, false)
  assert.equal('reuniao_em' in updated, false)
  assert.equal('next_action' in updated, false)
  assert.equal('proxima_acao' in updated, false)
  assert.equal('proxima_acao_due_date' in updated, false)
})

function mock(status = 200, body = { id: 'fixture', status: 'reuniao_marcada' }) {
  const calls = []
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), ...init })
      return new Response(JSON.stringify(status === 200 ? body : { message: 'erro', code: 'P0001' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    } },
  })
  return { client, calls }
}

test('CA-F5-01 flag OFF continua chamando update_lead_status no stub F1', async () => {
  const { client, calls } = mock()
  await updateLeadStatus(
    client,
    { id: 'lead-1', status: 'falando_decisor', updated_at: '2026-09-21T10:00:00+00:00' },
    'reuniao_marcada',
    { reuniaoEm: '2026-09-22T14:00:00-03:00' },
  )
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/update_lead_status')
})

test('CA-F5 modal completo chama marcar_reuniao com local e notas', async () => {
  const { client, calls } = mock()
  await marcarReuniao(
    client,
    { id: 'lead-1', status: 'falando_decisor', updated_at: '2026-09-21T10:00:00+00:00' },
    {
      reuniaoEm: '2026-09-22T14:00:00-03:00',
      reuniaoLink: 'https://meet.example.com/a',
      reuniaoLocal: 'Google Meet',
      reuniaoNotas: 'Levar print do protótipo',
    },
  )
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/marcar_reuniao')
  assert.deepEqual(JSON.parse(calls[0].body), {
    p_lead_id: 'lead-1',
    p_expected_updated_at: '2026-09-21T10:00:00+00:00',
    p_reuniao_em: '2026-09-22T14:00:00-03:00',
    p_reuniao_link: 'https://meet.example.com/a',
    p_reuniao_local: 'Google Meet',
    p_reuniao_notas: 'Levar print do protótipo',
    p_confirm_atypical: false,
    p_note: null,
  })
})

test('CA-F5 registrar resultado chama a RPC com o fluxo pedido', async () => {
  const { client, calls } = mock()
  await registrarResultadoReuniao(
    client,
    { id: 'lead-1', updated_at: 'v1' },
    { resultado: 'pediu_proposta', notas: 'Quer o site' },
  )
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/registrar_resultado_reuniao')
  const body = JSON.parse(calls[0].body)
  assert.equal(body.p_resultado, 'pediu_proposta')
  assert.equal(body.p_notas, 'Quer o site')
})

test('CA-F5 fora de escopo: sem Google Calendar, Zoom OAuth, cron D-1 nem proxima_acao_* no código', () => {
  const files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx|sql)$/.test(entry.name)) files.push(full)
    }
  }
  walk(join(root, 'src/features/reuniao'))
  files.push(join(root, 'supabase/migrations/20260921120000_reuniao_1_clique.sql'))
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    assert.equal(src.includes('proxima_acao'), false, file)
    assert.equal(/googleapis\.com\/calendar|zoom\.us\/oauth|accounts\.google\.com\/o\/oauth/i.test(src), false, file)
  }
})
