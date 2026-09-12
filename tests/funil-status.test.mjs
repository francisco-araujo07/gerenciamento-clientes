import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { parseFeatureFlag, isGlcFunilStatusEnabled } from '../src/utils/feature-flags.ts'
import { addCalendarDays, recifeDate, recifeDateTimeToIso, suggestedPauseAction } from '../src/utils/dates.ts'
import { leadPayload } from '../src/utils/validation.ts'
import { filterLeads, isActiveLead } from '../src/utils/leads.ts'
import {
  conversionDecision,
  evaluateLeadStatusTransition,
  isTypicalLeadStatusTransition,
  needsTransitionDialog,
  validateLeadStatusTransition,
  visibleLeadStatuses,
} from '../src/features/leads/lead-status.ts'
import { convertLeadToClient, updateLeadStatus } from '../src/features/leads/lead-service.ts'

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

test('criação com flag ligada não oferece negociacao', () => {
  assert.equal(visibleLeadStatuses(false).includes('negociacao'), true)
  assert.equal(visibleLeadStatuses(true).includes('negociacao'), false)
  assert.equal(visibleLeadStatuses(true, 'negociacao')[0], 'negociacao')
})

test('payload legado rejeita status novo do funil e payload com flag aceita extras', () => {
  assert.throws(() => leadPayload({ company_name: 'x', status: 'contato_porteiro' }, false))
  const saved = leadPayload({
    company_name: 'x',
    status: 'perdido',
    motivo_perda: 'preco',
    reuniao_link: 'https://meet.example.com/a',
  }, true)
  assert.equal(saved.status, 'perdido')
  assert.equal(saved.motivo_perda, 'preco')
  assert.equal(saved.reuniao_link, 'https://meet.example.com/a')
  assert.throws(() => leadPayload({ company_name: 'x', status: 'perdido', motivo_perda: 'invalido' }, true))
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
  assert.equal(calls.length, 0)
})

test('conversão continua chamando a RPC existente', async () => {
  const { client, calls } = mock()
  await convertLeadToClient(client, 'lead-123')
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/convert_lead_to_client')
})
