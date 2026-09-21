import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { parseFeatureFlag, isGlcMiniKanbanEnabled } from '../src/utils/feature-flags.ts'
import { recifeDate } from '../src/utils/dates.ts'
import { filterLeads } from '../src/utils/leads.ts'
import { updateLeadStatus } from '../src/features/leads/lead-service.ts'
import {
  KANBAN_COLUMN_PAGE_SIZE,
  decideKanbanDrop,
  groupKanbanLeads,
  isKanbanOverdue,
  kanbanColumns,
  kanbanContactName,
  kanbanInitials,
  leadsWithPendingMove,
  nextKanbanColumnLimit,
  truncateNextAction,
  visibleKanbanCards,
} from '../src/features/leads/kanban.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function lead(overrides = {}) {
  return {
    id: 'lead-1',
    company_name: 'Acme',
    responsible_name: 'Ana Souza',
    whatsapp: null,
    email: null,
    instagram: null,
    address: null,
    google_maps_url: null,
    segment: 'Clínica',
    notes: null,
    source: null,
    status: 'novo',
    next_action: 'Ligar para o porteiro amanhã cedo e confirmar o melhor horário',
    next_action_due_date: '2026-09-20',
    touches_sem_resposta: 2,
    motivo_perda: null,
    motivo_perda_detalhe: null,
    reuniao_em: null,
    reuniao_link: null,
    reuniao_local: null,
    reuniao_resultado: null,
    reuniao_notas: null,
    gatilho: null,
    prototipo_url: null,
    prototipo_notas: null,
    wa_ultimo_template_id: null,
    porteiro_nome: 'Paulo Porteiro',
    porteiro_whatsapp: null,
    decisor_nome: 'Dora Decisora',
    decisor_whatsapp: null,
    decisor_cargo: null,
    contato_principal: 'geral',
    ultimo_combinado_com_porteiro: null,
    deleted_at: null,
    created_at: '2026-09-01T12:00:00+00:00',
    updated_at: '2026-09-01T12:00:00+00:00',
    ...overrides,
  }
}

test('CA-F6-01 flag do mini-kanban fica desligada por padrão e só liga com valores explícitos', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(parseFeatureFlag(''), false)
  assert.equal(isGlcMiniKanbanEnabled(), false)
  assert.equal(isGlcMiniKanbanEnabled('true'), true)
  assert.equal(isGlcMiniKanbanEnabled('1'), true)
  assert.equal(isGlcMiniKanbanEnabled('ON'), true)
  assert.equal(isGlcMiniKanbanEnabled('off'), false)
  const envExample = readFileSync(join(root, '.env.example'), 'utf8')
  assert.match(envExample, /VITE_FF_GLC_MINI_KANBAN=$/m)
  const flags = readFileSync(join(root, 'src/utils/feature-flags.ts'), 'utf8')
  assert.match(flags, /VITE_FF_GLC_MINI_KANBAN/)
  const page = readFileSync(join(root, 'src/pages/LeadsPage.tsx'), 'utf8')
  assert.match(page, /isGlcMiniKanbanEnabled/)
  assert.match(page, /Tabela/)
  assert.match(page, /Kanban/)
  assert.match(page, /showingKanban \?/)
})

test('CA-F6 colunas ativas fixas; negociacao só com count>0; sem convertido', () => {
  const withoutLegacy = [
    lead({ id: 'a', status: 'novo' }),
    lead({ id: 'b', status: 'contato_porteiro' }),
    lead({ id: 'c', status: 'convertido' }),
    lead({ id: 'd', status: 'perdido' }),
    lead({ id: 'e', status: 'pausado_60d' }),
  ]
  assert.deepEqual(kanbanColumns(withoutLegacy).map((column) => column.status), [
    'novo',
    'contato_porteiro',
    'encaminhado',
    'falando_decisor',
    'reuniao_marcada',
    'proposta_enviada',
  ])
  const withLegacy = [...withoutLegacy, lead({ id: 'f', status: 'negociacao' })]
  const columns = kanbanColumns(withLegacy)
  assert.equal(columns.at(-1)?.status, 'negociacao')
  assert.equal(columns.at(-1)?.count, 1)
  assert.equal(columns.some((column) => column.status === 'convertido'), false)
  assert.equal(columns.some((column) => column.status === 'perdido'), false)
  assert.equal(columns.some((column) => column.status === 'pausado_60d'), false)
})

test('CA-F6 card: empresa/segmento, next_action truncada, toques e inicial F4 ou responsável', () => {
  const text = 'Ligar para o porteiro amanhã cedo e confirmar o melhor horário'
  assert.equal(truncateNextAction(text, 24), 'Ligar para o porteiro a…')
  assert.equal(truncateNextAction('Curta', 80), 'Curta')
  assert.equal(truncateNextAction('  '), null)
  assert.equal(kanbanInitials('Ana Souza'), 'AS')
  assert.equal(kanbanInitials('Maria'), 'MA')
  assert.equal(kanbanInitials(null), '?')
  const geral = lead({ contato_principal: 'geral', responsible_name: 'Ana Souza' })
  assert.equal(kanbanContactName(geral, false), 'Ana Souza')
  assert.equal(kanbanContactName(geral, true), 'Ana Souza')
  assert.equal(kanbanContactName(lead({ contato_principal: 'porteiro' }), true), 'Paulo Porteiro')
  assert.equal(kanbanContactName(lead({ contato_principal: 'decisor' }), true), 'Dora Decisora')
  assert.equal(kanbanContactName(lead({ contato_principal: 'porteiro' }), false), 'Ana Souza')
})

test('CA-F6 badge atrasada usa o dia civil em America/Recife', () => {
  const recifeEvening = new Date('2026-09-22T01:00:00.000Z')
  assert.equal(recifeDate(recifeEvening), '2026-09-21')
  assert.equal(isKanbanOverdue({ next_action_due_date: '2026-09-21' }, recifeDate(recifeEvening)), false)
  assert.equal(isKanbanOverdue({ next_action_due_date: '2026-09-20' }, recifeDate(recifeEvening)), true)
  assert.equal(isKanbanOverdue({ next_action_due_date: null }, recifeDate(recifeEvening)), false)
})

test('CA-F6 filtros da lista aplicam no agrupamento do kanban', () => {
  const leads = [
    lead({ id: 'a', company_name: 'Acme Saúde', status: 'novo' }),
    lead({ id: 'b', company_name: 'Beta Clínica', status: 'proposta_enviada' }),
    lead({ id: 'c', company_name: 'Acme Perdida', status: 'perdido' }),
    lead({ id: 'd', company_name: 'Gamma', status: 'negociacao' }),
  ]
  const filtered = filterLeads(leads, {
    search: 'acme',
    status: 'ativos',
    onlyOverdue: false,
    funilEnabled: true,
  })
  assert.deepEqual(filtered.map((item) => item.id), ['a'])
  const grouped = groupKanbanLeads(filtered)
  assert.equal(grouped.novo.length, 1)
  assert.equal(grouped.proposta_enviada.length, 0)
  assert.equal(Object.hasOwn(grouped, 'negociacao'), false)
  assert.equal(Object.hasOwn(grouped, 'convertido'), false)
})

test('CA-F6 máx 30 cards por coluna e carregar mais', () => {
  const leads = Array.from({ length: 31 }, (_, index) => lead({
    id: `lead-${String(index).padStart(2, '0')}`,
    status: 'novo',
    next_action_due_date: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
  }))
  const first = visibleKanbanCards(leads)
  assert.equal(KANBAN_COLUMN_PAGE_SIZE, 30)
  assert.equal(first.items.length, 30)
  assert.equal(first.remaining, 1)
  assert.equal(first.items[0].id, 'lead-00')
  const nextLimit = nextKanbanColumnLimit(first.items.length)
  const second = visibleKanbanCards(leads, nextLimit)
  assert.equal(second.items.length, 31)
  assert.equal(second.remaining, 0)
})

test('CA-F6 DnD reusa a matriz F1/F5; cancelar pending devolve o card', () => {
  assert.equal(decideKanbanDrop('novo', 'novo').kind, 'noop')
  assert.equal(decideKanbanDrop('novo', 'contato_porteiro').kind, 'apply')
  const reuniao = decideKanbanDrop('falando_decisor', 'reuniao_marcada')
  assert.equal(reuniao.kind, 'dialog')
  if (reuniao.kind === 'dialog') assert.equal(reuniao.evaluation.requiresReuniao, true)
  const perdido = decideKanbanDrop('novo', 'perdido')
  assert.equal(perdido.kind, 'dialog')
  if (perdido.kind === 'dialog') assert.equal(perdido.evaluation.requiresMotivo, true)
  const pausado = decideKanbanDrop('novo', 'pausado_60d')
  assert.equal(pausado.kind, 'dialog')
  if (pausado.kind === 'dialog') assert.equal(pausado.evaluation.suggestsPause, true)
  const encaminhado = decideKanbanDrop('contato_porteiro', 'encaminhado')
  assert.equal(encaminhado.kind, 'dialog')
  if (encaminhado.kind === 'dialog') assert.equal(encaminhado.evaluation.requiresEncaminhadoNote, true)
  const atypical = decideKanbanDrop('novo', 'proposta_enviada')
  assert.equal(atypical.kind, 'dialog')
  assert.equal(decideKanbanDrop('novo', 'negociacao').kind, 'reject')
  assert.equal(decideKanbanDrop('novo', 'convertido').kind, 'reject')
  const original = [lead({ id: 'move', status: 'novo' }), lead({ id: 'stay', status: 'contato_porteiro' })]
  const pending = { leadId: 'move', toStatus: 'contato_porteiro' }
  const moved = groupKanbanLeads(original, pending)
  assert.equal(moved.novo.some((item) => item.id === 'move'), false)
  assert.equal(moved.contato_porteiro.some((item) => item.id === 'move'), true)
  const reverted = groupKanbanLeads(original, null)
  assert.equal(reverted.novo.some((item) => item.id === 'move'), true)
  assert.deepEqual(leadsWithPendingMove(original, null)[0].status, 'novo')
})

function mock(status = 200, body = { id: 'lead-1', status: 'contato_porteiro' }) {
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

test('CA-F6 drop típico chama a mesma RPC F1 update_lead_status', async () => {
  const { client, calls } = mock()
  await updateLeadStatus(
    client,
    { id: 'lead-1', status: 'novo', updated_at: '2026-09-21T10:00:00+00:00' },
    'contato_porteiro',
  )
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/update_lead_status')
  assert.equal(JSON.parse(calls[0].body).p_to_status, 'contato_porteiro')
})

test('CA-F6 expand-only: sem migration, DROP, CMS, WIP ou convertidos no board', () => {
  const migrations = readdirSync(join(root, 'supabase/migrations')).filter((name) => name.includes('kanban'))
  assert.deepEqual(migrations, [])
  const files = [
    join(root, 'src/features/leads/kanban.ts'),
    join(root, 'src/features/leads/LeadsKanban.tsx'),
    join(root, 'src/pages/LeadsPage.tsx'),
  ]
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    assert.equal(/\bdrop\s+(column|table)\b/i.test(src), false, file)
    assert.equal(/contentful|strapi|sanity\.io/i.test(src), false, file)
    assert.equal(/wip\s*limit/i.test(src), false, file)
    assert.equal(/swimlane/i.test(src), false, file)
  }
  assert.equal(kanbanColumns([lead({ status: 'convertido' })]).some((column) => column.status === 'convertido'), false)
})
