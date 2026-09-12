import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { parseFeatureFlag, isGlcFunilStatusEnabled } from '../src/utils/feature-flags.ts'
import { addCalendarDays, recifeDate, recifeDateTimeToIso, suggestedPauseAction } from '../src/utils/dates.ts'
import { leadPayload, leadUpdatePayload } from '../src/utils/validation.ts'
import { filterLeads, isActiveLead } from '../src/utils/leads.ts'
import {
  conversionDecision,
  evaluateLeadStatusTransition,
  isTypicalLeadStatusTransition,
  needsTransitionDialog,
  validateLeadStatusTransition,
  visibleLeadStatuses,
} from '../src/features/leads/lead-status.ts'
import { convertLeadToClient, updateLead, updateLeadStatus } from '../src/features/leads/lead-service.ts'

test('flag do funil fica desligada por padrão e só liga com valores explícitos', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(parseFeatureFlag(''), false)
  assert.equal(parseFeatureFlag('false'), false)
  assert.equal(parseFeatureFlag('off'), false)
  assert.equal(isGlcFunilStatusEnabled(), false)
  assert.equal(isGlcFunilStatusEnabled('true'), true)
  assert.equal(isGlcFunilStatusEnabled('1'), true)
  assert.equal(isGlcFunilStatusEnabled('ON'), true)
  assert.equal(isGlcFunilStatusEnabled('yes'), true)
})

test('criação não oferece negociacao e só mantém o valor legado no registro atual', () => {
  assert.equal(visibleLeadStatuses(false).includes('negociacao'), false)
  assert.equal(visibleLeadStatuses(true).includes('negociacao'), false)
  assert.equal(visibleLeadStatuses(false, 'negociacao').includes('negociacao'), true)
  assert.equal(visibleLeadStatuses(true, 'negociacao')[0], 'negociacao')
  assert.deepEqual(visibleLeadStatuses(false), ['novo'])
})

test('payload de criação rejeita negociacao e, com flag ligada, só aceita status de create', () => {
  assert.throws(() => leadPayload({ company_name: 'x', status: 'negociacao' }, true))
  assert.throws(() => leadPayload({ company_name: 'x', status: 'negociacao' }, false))
  assert.throws(() => leadPayload({ company_name: 'x', status: 'contato_porteiro' }, false))
  assert.throws(() => leadPayload({ company_name: 'x', status: 'perdido', motivo_perda: 'preco' }, true))
  const created = leadPayload({
    company_name: 'x',
    status: 'proposta_enviada',
    reuniao_link: 'https://meet.example.com/a',
  }, true)
  assert.equal(created.status, 'proposta_enviada')
  assert.equal(created.reuniao_link, 'https://meet.example.com/a')
  assert.throws(() => leadPayload({ company_name: 'x', status: 'perdido', motivo_perda: 'invalido' }, true))
})

test('update genérico não envia status nem stubs de funil', () => {
  const updated = leadUpdatePayload({
    company_name: 'x',
    status: 'perdido',
    motivo_perda: 'preco',
    reuniao_em: '2026-09-20T14:00:00-03:00',
    reuniao_link: 'https://meet.example.com/a',
  })
  assert.equal('status' in updated, false)
  assert.equal('motivo_perda' in updated, false)
  assert.equal('reuniao_em' in updated, false)
  assert.equal('reuniao_link' in updated, false)
  assert.equal(updated.company_name, 'x')
})

test('ativos com flag ligada excluem convertido, perdido e pausado_60d e incluem legado', () => {
  const leads = [
    { company_name: 'Novo', responsible_name: null, status: 'novo', next_action_due_date: null },
    { company_name: 'Porteiro', responsible_name: null, status: 'contato_porteiro', next_action_due_date: null },
    { company_name: 'Legado', responsible_name: null, status: 'negociacao', next_action_due_date: null },
    { company_name: 'Pausa', responsible_name: null, status: 'pausado_60d', next_action_due_date: null },
    { company_name: 'Perdido', responsible_name: null, status: 'perdido', next_action_due_date: null },
    { company_name: 'Cliente', responsible_name: null, status: 'convertido', next_action_due_date: null },
  ]
  assert.equal(isActiveLead(leads[0], false), true)
  assert.equal(isActiveLead(leads[1], false), false)
  assert.equal(isActiveLead(leads[2], true), true)
  assert.equal(isActiveLead(leads[3], true), false)
  assert.deepEqual(
    filterLeads(leads, { search: '', status: 'ativos', onlyOverdue: false, funilEnabled: true }).map((lead) => lead.company_name),
    ['Novo', 'Porteiro', 'Legado'],
  )
  assert.deepEqual(
    filterLeads(leads, { search: '', status: 'cadencia', onlyOverdue: false, funilEnabled: true }).map((lead) => lead.company_name),
    ['Novo', 'Porteiro'],
  )
  assert.deepEqual(
    filterLeads(leads, { search: '', status: 'pausados', onlyOverdue: false, funilEnabled: true }).map((lead) => lead.company_name),
    ['Pausa'],
  )
})

test('matriz típica e atípica do funil, inclusive a partir de negociacao', () => {
  assert.equal(isTypicalLeadStatusTransition('novo', 'contato_porteiro'), true)
  assert.equal(isTypicalLeadStatusTransition('contato_porteiro', 'encaminhado'), true)
  assert.equal(isTypicalLeadStatusTransition('novo', 'proposta_enviada'), false)
  assert.equal(isTypicalLeadStatusTransition('negociacao', 'falando_decisor'), true)
  assert.equal(isTypicalLeadStatusTransition('negociacao', 'reuniao_marcada'), true)
  assert.equal(isTypicalLeadStatusTransition('negociacao', 'novo'), false)
  assert.equal(isTypicalLeadStatusTransition('novo', 'perdido'), true)
  assert.equal(isTypicalLeadStatusTransition('proposta_enviada', 'pausado_60d'), true)
  assert.equal(isTypicalLeadStatusTransition('pausado_60d', 'falando_decisor'), true)
  assert.equal(isTypicalLeadStatusTransition('novo', 'convertido'), false)
  assert.equal(evaluateLeadStatusTransition('novo', 'convertido').allowed, false)
  assert.equal(evaluateLeadStatusTransition('novo', 'negociacao').allowed, false)
  assert.equal(evaluateLeadStatusTransition('negociacao', 'negociacao').allowed, true)
  assert.equal(needsTransitionDialog(evaluateLeadStatusTransition('novo', 'proposta_enviada')), true)
  assert.equal(needsTransitionDialog(evaluateLeadStatusTransition('novo', 'contato_porteiro')), false)
})

test('validações de perdido, reunião, encaminhado e atípico', () => {
  assert.throws(() => validateLeadStatusTransition('novo', 'perdido', {}))
  assert.throws(() => validateLeadStatusTransition('novo', 'perdido', { motivoPerda: 'outro' }))
  validateLeadStatusTransition('novo', 'perdido', { motivoPerda: 'preco' })
  validateLeadStatusTransition('novo', 'perdido', { motivoPerda: 'outro', motivoPerdaDetalhe: 'Não atendeu' })
  assert.throws(() => validateLeadStatusTransition('falando_decisor', 'reuniao_marcada', {}))
  validateLeadStatusTransition('falando_decisor', 'reuniao_marcada', { reuniaoEm: '2026-09-20T14:00:00-03:00' })
  assert.throws(() => validateLeadStatusTransition('contato_porteiro', 'encaminhado', {}))
  validateLeadStatusTransition('contato_porteiro', 'encaminhado', { note: 'Encaminhou para o sócio' })
  assert.throws(() => validateLeadStatusTransition('novo', 'proposta_enviada', {}))
  validateLeadStatusTransition('novo', 'proposta_enviada', { confirmAtypical: true })
  assert.throws(() => validateLeadStatusTransition('novo', 'negociacao', { confirmAtypical: true }))
})

test('conversão bloqueia perdido e pausado; exige confirmação em estágios iniciais', () => {
  assert.equal(conversionDecision('novo', false), 'allow')
  assert.equal(conversionDecision('perdido', false), 'block')
  assert.equal(conversionDecision('perdido', true), 'block')
  assert.equal(conversionDecision('pausado_60d', true), 'block')
  assert.equal(conversionDecision('proposta_enviada', true), 'allow')
  assert.equal(conversionDecision('reuniao_marcada', true), 'allow')
  assert.equal(conversionDecision('falando_decisor', true), 'allow')
  assert.equal(conversionDecision('novo', true), 'confirm')
  assert.equal(conversionDecision('contato_porteiro', true), 'confirm')
})

test('pausa sugere retomar cadência em 60 dias no fuso de Recife', () => {
  const suggestion = suggestedPauseAction(new Date('2026-09-12T12:00:00-03:00'))
  assert.equal(suggestion.next_action, 'Retomar cadência')
  assert.equal(suggestion.next_action_due_date, addCalendarDays(recifeDate(new Date('2026-09-12T12:00:00-03:00')), 60))
  assert.equal(suggestion.next_action_due_date, '2026-11-11')
  assert.equal(recifeDateTimeToIso('2026-09-20T14:30'), '2026-09-20T14:30:00-03:00')
})

function mock(status = 200, body = { id: 'fixture', status: 'contato_porteiro' }) {
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

test('updateLeadStatus valida no cliente e chama a RPC atômica', async () => {
  const { client, calls } = mock()
  await updateLeadStatus(client, { id: 'lead-1', status: 'novo', updated_at: '2026-09-12T10:00:00+00:00' }, 'contato_porteiro')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/update_lead_status')
  assert.deepEqual(JSON.parse(calls[0].body), {
    p_lead_id: 'lead-1',
    p_to_status: 'contato_porteiro',
    p_expected_updated_at: '2026-09-12T10:00:00+00:00',
    p_confirm_atypical: false,
    p_note: null,
    p_motivo_perda: null,
    p_motivo_perda_detalhe: null,
    p_reuniao_em: null,
    p_reuniao_link: null,
    p_next_action: null,
    p_next_action_due_date: null,
  })
})

test('updateLeadStatus não chama a rede quando a validação falha', async () => {
  const { client, calls } = mock()
  await assert.rejects(updateLeadStatus(client, { id: 'lead-1', status: 'novo', updated_at: 'v1' }, 'perdido'))
  await assert.rejects(updateLeadStatus(client, { id: 'lead-1', status: 'novo', updated_at: 'v1' }, 'negociacao'))
  assert.equal(calls.length, 0)
})

test('com flag OFF o update cadastral não chama a RPC de funil e não envia status', async () => {
  const { client, calls } = mock()
  await updateLead(client, 'lead-1', { company_name: 'Teste', status: 'perdido' }, '2026-09-12T10:00:00+00:00')
  assert.equal(calls.length, 1)
  assert.match(calls[0].url.pathname, /\/rest\/v1\/leads$/)
  assert.notEqual(calls[0].url.pathname, '/rest/v1/rpc/update_lead_status')
  const body = JSON.parse(calls[0].body)
  assert.equal('status' in body, false)
  assert.equal('motivo_perda' in body, false)
})

test('conversão continua chamando a RPC existente', async () => {
  const { client, calls } = mock()
  await convertLeadToClient(client, 'lead-123')
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/convert_lead_to_client')
})
