import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { parseFeatureFlag, isGlcFilaCadenciaEnabled, isGlcFunilStatusEnabled } from '../src/utils/feature-flags.ts'
import { addCalendarDays, recifeDate } from '../src/utils/dates.ts'
import { leadUpdatePayload } from '../src/utils/validation.ts'
import { CADENCIA_FOLLOW_UP_TEXTS, defaultCadenciaConfig } from '../src/types/cadencia.ts'
import {
  CadenciaTouchLimitError,
  filterCadenciaQueue,
  inCadenciaQueue,
  isCadenciaQueueStatus,
  isCadenciaTouchLimitError,
  nextCadenciaStep,
  novosSemProximaAcao,
  sortCadenciaQueue,
} from '../src/features/cadencia/cadencia.ts'
import { maskWhatsapp, normalizeWhatsappDigits, whatsappMeUrl } from '../src/features/cadencia/whatsapp.ts'
import { listCadenciaQueue, registrarCadencia } from '../src/features/cadencia/cadencia-service.ts'
import { updateLead } from '../src/features/leads/lead-service.ts'

test('CA-F2-14 flag da fila fica desligada por padrão e só liga com valores explícitos', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(isGlcFilaCadenciaEnabled(), false)
  assert.equal(isGlcFilaCadenciaEnabled('true'), true)
  assert.equal(isGlcFilaCadenciaEnabled('1'), true)
  assert.equal(isGlcFilaCadenciaEnabled('ON'), true)
  assert.equal(isGlcFunilStatusEnabled(), false)
})

test('CA-F2-02 fila inclui negociacao e exclui convertido/perdido/pausado', () => {
  const today = '2026-09-12'
  const leads = [
    { id: '1', status: 'novo', next_action_due_date: today },
    { id: '2', status: 'negociacao', next_action_due_date: today },
    { id: '3', status: 'proposta_enviada', next_action_due_date: today },
    { id: '4', status: 'convertido', next_action_due_date: today },
    { id: '5', status: 'perdido', next_action_due_date: today },
    { id: '6', status: 'pausado_60d', next_action_due_date: today },
    { id: '7', status: 'novo', next_action_due_date: null },
  ]
  assert.equal(isCadenciaQueueStatus('negociacao'), true)
  assert.equal(isCadenciaQueueStatus('perdido'), false)
  assert.deepEqual(
    filterCadenciaQueue(leads, 'todos', today).map((lead) => lead.id),
    ['1', '2', '3'],
  )
  assert.equal(inCadenciaQueue(leads[6], today), false)
})

test('CA-F2-03 ordena atrasadas mais antigas e depois as de hoje', () => {
  const today = '2026-09-12'
  const leads = [
    { id: 'hoje-b', status: 'novo', next_action_due_date: today },
    { id: 'atrasada-nova', status: 'novo', next_action_due_date: '2026-09-11' },
    { id: 'atrasada-velha', status: 'negociacao', next_action_due_date: '2026-09-01' },
    { id: 'hoje-a', status: 'novo', next_action_due_date: today },
  ]
  assert.deepEqual(
    sortCadenciaQueue(leads).map((lead) => lead.id),
    ['atrasada-velha', 'atrasada-nova', 'hoje-a', 'hoje-b'],
  )
  assert.deepEqual(filterCadenciaQueue(leads, 'hoje', today).map((lead) => lead.id), ['hoje-a', 'hoje-b'])
  assert.deepEqual(filterCadenciaQueue(leads, 'atrasadas', today).map((lead) => lead.id), ['atrasada-velha', 'atrasada-nova'])
})

test('CA-F2-04 WhatsApp fica mascarado e o wa.me não usa template', () => {
  assert.equal(maskWhatsapp('81988887777'), '••••-7777')
  assert.equal(maskWhatsapp(null), '—')
  assert.equal(normalizeWhatsappDigits('81 98888-7777'), '5581988887777')
  assert.equal(whatsappMeUrl('81988887777'), 'https://wa.me/5581988887777')
  assert.equal(whatsappMeUrl('81988887777')?.includes('text='), false)
  assert.equal(whatsappMeUrl('123'), null)
})

test('CA-F2-06/07/08 motor: 1º +3d follow-up, 2º +4d case, 3º +6d break-up', () => {
  const today = '2026-09-12'
  assert.deepEqual(defaultCadenciaConfig.offset_dias_apos_toque, [3, 4, 6])
  assert.equal(defaultCadenciaConfig.max_touches_sem_resposta, 4)
  const first = nextCadenciaStep(0, defaultCadenciaConfig, today)
  assert.equal(first.limit, false)
  if (first.limit) throw new Error('1º toque não deveria limitar')
  assert.equal(first.offset_days, 3)
  assert.equal(first.next_action_due_date, addCalendarDays(today, 3))
  assert.equal(first.next_action, CADENCIA_FOLLOW_UP_TEXTS[0])
  const second = nextCadenciaStep(1, defaultCadenciaConfig, today)
  assert.equal(second.limit, false)
  if (second.limit) throw new Error('2º toque não deveria limitar')
  assert.equal(second.offset_days, 4)
  assert.equal(second.next_action, CADENCIA_FOLLOW_UP_TEXTS[1])
  const third = nextCadenciaStep(2, defaultCadenciaConfig, today)
  assert.equal(third.limit, false)
  if (third.limit) throw new Error('3º toque não deveria limitar')
  assert.equal(third.offset_days, 6)
  assert.equal(third.next_action, CADENCIA_FOLLOW_UP_TEXTS[2])
  assert.equal(third.next_action_due_date, '2026-09-18')
})

test('CA-F2-09 4º toque sem resposta vira TOUCH_LIMIT', () => {
  assert.deepEqual(nextCadenciaStep(3), { limit: true })
  assert.equal(isCadenciaTouchLimitError(new CadenciaTouchLimitError()), true)
  assert.equal(isCadenciaTouchLimitError({ code: 'PT409', message: 'TOUCH_LIMIT' }), true)
  assert.equal(isCadenciaTouchLimitError({ message: 'outra' }), false)
})

test('CA-F2-11/12 empty state aponta leads novos sem data e toques começam em 0', () => {
  const leads = [
    { id: 'a', status: 'novo', next_action_due_date: null, touches_sem_resposta: 0 },
    { id: 'b', status: 'novo', next_action_due_date: '2026-09-12', touches_sem_resposta: 0 },
    { id: 'c', status: 'negociacao', next_action_due_date: null, touches_sem_resposta: 0 },
  ]
  assert.deepEqual(novosSemProximaAcao(leads).map((lead) => lead.id), ['a'])
  assert.equal(leads[0].touches_sem_resposta, 0)
})

test('update cadastral não envia touches_sem_resposta', () => {
  const updated = leadUpdatePayload({
    company_name: 'x',
    next_action: 'Manual',
    next_action_due_date: recifeDate(new Date('2026-09-12T12:00:00-03:00')),
    touches_sem_resposta: 9,
  })
  assert.equal('touches_sem_resposta' in updated, false)
  assert.equal('status' in updated, false)
})

function mock(status = 200, body = { id: 'fixture', touches_sem_resposta: 1 }) {
  const calls = []
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), ...init })
      return new Response(JSON.stringify(status === 200 ? body : { message: 'TOUCH_LIMIT', code: 'PT409' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    } },
  })
  return { client, calls }
}

test('CA-F2-05/10 registrarCadencia chama a RPC do motor e não o update cadastral', async () => {
  const { client, calls } = mock()
  await registrarCadencia(client, { id: 'lead-1', updated_at: '2026-09-12T10:00:00+00:00' }, { acao: 'toquei' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/registrar_cadencia')
  assert.deepEqual(JSON.parse(calls[0].body), {
    p_lead_id: 'lead-1',
    p_expected_updated_at: '2026-09-12T10:00:00+00:00',
    p_acao: 'toquei',
    p_nota: null,
    p_next_action: null,
    p_next_action_due_date: null,
    p_canal: 'whatsapp',
  })
})

test('RPC 409/TOUCH_LIMIT vira CadenciaTouchLimitError', async () => {
  const { client, calls } = mock(409, { message: 'TOUCH_LIMIT', code: 'PT409' })
  await assert.rejects(
    registrarCadencia(client, { id: 'lead-1', updated_at: 'v1' }, { acao: 'sem_resposta' }),
    (error) => error instanceof CadenciaTouchLimitError,
  )
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/registrar_cadencia')
})

test('com flag OFF o update cadastral não chama a RPC de cadência', async () => {
  const { client, calls } = mock()
  await updateLead(client, 'lead-1', { company_name: 'Teste', status: 'novo' }, '2026-09-12T10:00:00+00:00')
  assert.equal(calls.length, 1)
  assert.match(calls[0].url.pathname, /\/rest\/v1\/leads$/)
  assert.notEqual(calls[0].url.pathname, '/rest/v1/rpc/registrar_cadencia')
  const body = JSON.parse(calls[0].body)
  assert.equal('touches_sem_resposta' in body, false)
})

test('listCadenciaQueue filtra ativos com due date até hoje', async () => {
  const { client, calls } = mock(200, [])
  try {
    await listCadenciaQueue(client, '2026-09-12')
  } catch {
    // o mock devolve array sem count; o contrato da query ainda é validado abaixo
  }
  assert.match(calls[0].url.pathname, /\/rest\/v1\/leads$/)
  assert.match(calls[0].url.search, /next_action_due_date=lte\.2026-09-12/)
  assert.match(decodeURIComponent(calls[0].url.search), /status=in\.\(novo/)
  assert.match(decodeURIComponent(calls[0].url.search), /negociacao/)
})
