import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFeatureFlag, isGlcPorteiroDecisorEnabled } from '../src/utils/feature-flags.ts'
import { createClient } from '@supabase/supabase-js'
import { leadPayload, leadUpdatePayload } from '../src/utils/validation.ts'
import { getLead, listLeads, listLeadsPage } from '../src/features/leads/lead-service.ts'
import { listCadenciaQueue, listNovosSemProximaAcao } from '../src/features/cadencia/cadencia-service.ts'
import { filterLeads } from '../src/utils/leads.ts'
import { buildWaTemplateContext, buildWhatsappMeUrl, interpolateWaTemplate } from '../src/features/whatsapp/templates.ts'
import {
  contactSpotlight,
  defaultWaDestinatario,
  destinatarioFromContatoPrincipal,
  principalWhatsapp,
  validWaDestinatarios,
  whatsappForDestinatario,
} from '../src/features/porteiro-decisor/contacts.ts'
import { csvLeadValues, mapCsvLeadRows, optionalCsvHeaders, requiredCsvHeaders } from '../src/features/leads/csv-import.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('CA-F4-01 flag do porteiro/decisor fica desligada por padrão', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(isGlcPorteiroDecisorEnabled(), false)
  assert.equal(isGlcPorteiroDecisorEnabled('true'), true)
  assert.equal(isGlcPorteiroDecisorEnabled('1'), true)
  assert.equal(isGlcPorteiroDecisorEnabled('ON'), true)
  assert.equal(isGlcPorteiroDecisorEnabled('off'), false)
})

const f4LeadFields = [
  'porteiro_nome',
  'porteiro_whatsapp',
  'decisor_nome',
  'decisor_whatsapp',
  'decisor_cargo',
  'contato_principal',
  'ultimo_combinado_com_porteiro',
]

test('CA-F4-03/04 payload mantém geral legado; flag OFF omite F4 e não depende de deleted_at', () => {
  const created = leadPayload({ company_name: 'Padaria', status: 'novo', porteiro_nome: 'João' })
  assert.equal(created.responsible_name, null)
  assert.equal(created.whatsapp, null)
  assert.equal(created.company_name, 'Padaria')
  for (const field of f4LeadFields) assert.equal(field in created, false)
  assert.equal('deleted_at' in created, false)
  const updated = leadUpdatePayload({
    company_name: 'Padaria',
    responsible_name: 'Ana',
    whatsapp: '81988887777',
    contato_principal: 'porteiro',
    porteiro_nome: 'João',
    porteiro_whatsapp: '81977776666',
    deleted_at: '2026-09-12T12:00:00Z',
    status: 'perdido',
  })
  assert.equal(updated.responsible_name, 'Ana')
  assert.equal(updated.whatsapp, '81988887777')
  for (const field of f4LeadFields) assert.equal(field in updated, false)
  assert.equal('deleted_at' in updated, false)
  assert.equal('status' in updated, false)
  assert.doesNotThrow(() => leadPayload({ company_name: 'x', status: 'novo', contato_principal: 'secretaria' }))
})

test('P1-001 flag ON inclui campos F4 no payload e nunca envia deleted_at', () => {
  const created = leadPayload({ company_name: 'Padaria', status: 'novo' }, false, false, true)
  assert.equal(created.contato_principal, 'geral')
  assert.equal(created.porteiro_nome, null)
  assert.equal(created.decisor_cargo, null)
  assert.equal('deleted_at' in created, false)
  const updated = leadUpdatePayload({
    company_name: 'Padaria',
    responsible_name: 'Ana',
    whatsapp: '81988887777',
    contato_principal: 'porteiro',
    porteiro_nome: 'João',
    porteiro_whatsapp: '81977776666',
    deleted_at: '2026-09-12T12:00:00Z',
    status: 'perdido',
  }, false, true)
  assert.equal(updated.contato_principal, 'porteiro')
  assert.equal(updated.porteiro_nome, 'João')
  assert.equal(updated.porteiro_whatsapp, '81977776666')
  assert.equal('deleted_at' in updated, false)
  assert.equal('status' in updated, false)
  assert.throws(() => leadPayload({ company_name: 'x', status: 'novo', contato_principal: 'secretaria' }, false, false, true))
})

test('CA-F4-07/08 seletor só lista número válido e default=contato_principal', () => {
  const lead = {
    whatsapp: '81988887777',
    porteiro_whatsapp: 'abc',
    decisor_whatsapp: '81977776666',
    contato_principal: 'porteiro',
  }
  assert.deepEqual(validWaDestinatarios(lead), ['principal', 'decisor'])
  assert.equal(defaultWaDestinatario(lead), 'principal')
  const withPorteiro = { ...lead, porteiro_whatsapp: '81966665555' }
  assert.deepEqual(validWaDestinatarios(withPorteiro), ['principal', 'porteiro', 'decisor'])
  assert.equal(defaultWaDestinatario(withPorteiro), 'porteiro')
  assert.equal(destinatarioFromContatoPrincipal('geral'), 'principal')
  assert.equal(principalWhatsapp({ ...withPorteiro, contato_principal: 'decisor' }), '81977776666')
})

test('CA-F4-09/10 wa.me usa E.164 do escolhido e variáveis vêm das colunas F4', () => {
  const lead = {
    company_name: 'Padaria Central',
    responsible_name: 'Ana',
    gatilho: 'vi o Instagram',
    segment: 'alimentação',
    address: 'Rua das Flores, 10, Boa Viagem, Recife - PE',
    prototipo_url: 'https://proto.example/padaria',
    porteiro_nome: 'João',
    decisor_nome: 'Carla',
    whatsapp: '81988887777',
    porteiro_whatsapp: '81977776666',
    decisor_whatsapp: '81966665555',
    contato_principal: 'decisor',
  }
  const context = buildWaTemplateContext(lead, 'Francisco')
  assert.equal(context.porteiro_nome, 'João')
  assert.equal(context.decisor_nome, 'Carla')
  const preview = interpolateWaTemplate('Oi {{decisor_nome}} da {{empresa}}', context)
  assert.equal(preview, 'Oi Carla da Padaria Central')
  const url = buildWhatsappMeUrl(whatsappForDestinatario(lead, defaultWaDestinatario(lead)), preview)
  assert.equal(url?.startsWith('https://wa.me/5581966665555?text='), true)
  assert.equal(url?.includes(encodeURIComponent('Carla')), true)
})

test('CA-F4-11 CSV aceita colunas opcionais porteiro_*/decisor_* e não exige no legado', () => {
  assert.equal(requiredCsvHeaders.includes('porteiro_nome'), false)
  assert.deepEqual([...optionalCsvHeaders], [
    'porteiro_nome',
    'porteiro_whatsapp',
    'decisor_nome',
    'decisor_whatsapp',
    'decisor_cargo',
    'contato_principal',
    'ultimo_combinado_com_porteiro',
  ])
  const legacy = 'company_name,responsible_name,whatsapp,email,instagram,address,google_maps_url,segment,source,notes,next_action,next_action_due_date\nPadaria,Ana,81988887777,a@b.com,@x,Rua,https://maps.google.com,food,Google,ok,ligar,2026-09-20'
  const rows = mapCsvLeadRows(legacy, [])
  assert.equal(rows[0].errors.length, 0)
  assert.equal(rows[0].values.contato_principal, 'geral')
  assert.equal(rows[0].values.porteiro_nome, '')
  const withOptional = 'company_name,responsible_name,whatsapp,email,instagram,address,google_maps_url,segment,source,notes,next_action,next_action_due_date,porteiro_nome,porteiro_whatsapp,decisor_nome,decisor_whatsapp,decisor_cargo,contato_principal\nPadaria,Ana,81988887777,a@b.com,@x,Rua,https://maps.google.com,food,Google,ok,ligar,2026-09-20,João,81977776666,Carla,81966665555,Sócia,decisor'
  const imported = mapCsvLeadRows(withOptional, [])
  assert.equal(imported[0].values.porteiro_nome, 'João')
  assert.equal(imported[0].values.decisor_nome, 'Carla')
  assert.equal(imported[0].values.contato_principal, 'decisor')
  const mapped = csvLeadValues(['company_name'], ['X'])
  assert.equal(mapped.contato_principal, 'geral')
})

test('CA-F4-12 migration é expand-only: sem DROP de whatsapp/responsible_name e sem lead_contato', () => {
  const sql = readFileSync(join(root, 'supabase/migrations/20260912180000_porteiro_decisor.sql'), 'utf8')
  const statements = sql.replace(/--[^\n]*/g, '')
  assert.match(sql, /add column if not exists porteiro_nome/)
  assert.match(sql, /add column if not exists deleted_at/)
  assert.match(sql, /contato_principal/)
  assert.equal(/\bdrop\s+(column|table)\b/i.test(statements), false)
  assert.equal(/\blead_contato\b/i.test(statements), false)
  assert.equal(/\brename\s+column\b/i.test(statements), false)
})

function mockLeadsClient(body = []) {
  const calls = []
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), ...init })
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' },
      })
    } },
  })
  return { client, calls }
}

test('P1-001 list/get/cadência com flag OFF não filtram deleted_at nem buscam porteiro/decisor', async () => {
  const { client, calls } = mockLeadsClient()
  try { await listLeads(client, false) } catch { /* mock sem count; o contrato da query vale abaixo */ }
  assert.match(calls[0].url.pathname, /\/rest\/v1\/leads$/)
  assert.equal(decodeURIComponent(calls[0].url.search).includes('deleted_at'), false)

  try { await listLeadsPage(client, { search: 'joao', porteiroEnabled: false, funilEnabled: false }) } catch { /* idem */ }
  const pageSearch = decodeURIComponent(calls[1].url.search)
  assert.equal(pageSearch.includes('deleted_at'), false)
  assert.equal(pageSearch.includes('porteiro_nome'), false)
  assert.equal(pageSearch.includes('decisor_nome'), false)
  assert.match(pageSearch, /company_name\.ilike/)

  try { await getLead(client, 'lead-1', false) } catch { /* idem */ }
  assert.equal(decodeURIComponent(calls[2].url.search).includes('deleted_at'), false)

  try { await listCadenciaQueue(client, '2026-09-12', false) } catch { /* idem */ }
  assert.equal(decodeURIComponent(calls[3].url.search).includes('deleted_at'), false)

  try { await listNovosSemProximaAcao(client, false) } catch { /* idem */ }
  assert.equal(decodeURIComponent(calls[4].url.search).includes('deleted_at'), false)
})

test('P1-001 list/get/cadência com flag ON filtram deleted_at e buscam porteiro/decisor', async () => {
  const { client, calls } = mockLeadsClient()
  try { await listLeads(client, true) } catch { /* mock sem count */ }
  assert.match(decodeURIComponent(calls[0].url.search), /deleted_at=is\.null/)

  try { await listLeadsPage(client, { search: 'joao', porteiroEnabled: true, funilEnabled: false }) } catch { /* idem */ }
  const pageSearch = decodeURIComponent(calls[1].url.search)
  assert.match(pageSearch, /deleted_at=is\.null/)
  assert.match(pageSearch, /porteiro_nome\.ilike/)
  assert.match(pageSearch, /decisor_nome\.ilike/)

  try { await getLead(client, 'lead-1', true) } catch { /* idem */ }
  assert.match(decodeURIComponent(calls[2].url.search), /deleted_at=is\.null/)

  try { await listCadenciaQueue(client, '2026-09-12', true) } catch { /* idem */ }
  assert.match(decodeURIComponent(calls[3].url.search), /deleted_at=is\.null/)

  try { await listNovosSemProximaAcao(client, true) } catch { /* idem */ }
  assert.match(decodeURIComponent(calls[4].url.search), /deleted_at=is\.null/)
})

test('P1-001 busca client-side em porteiro/decisor só com flag ON', () => {
  const leads = [{
    company_name: 'Padaria',
    responsible_name: 'Ana',
    status: 'novo',
    next_action_due_date: null,
    porteiro_nome: 'João',
    decisor_nome: 'Carla',
  }]
  assert.equal(filterLeads(leads, { search: 'joão', status: 'todos', onlyOverdue: false, porteiroEnabled: false }).length, 0)
  assert.equal(filterLeads(leads, { search: 'joão', status: 'todos', onlyOverdue: false, porteiroEnabled: true }).length, 1)
  assert.equal(filterLeads(leads, { search: 'ana', status: 'todos', onlyOverdue: false, porteiroEnabled: false }).length, 1)
})

test('CA-F4-13 spotlight não bloqueia status sem nome', () => {
  assert.equal(
    contactSpotlight({ status: 'contato_porteiro', porteiro_nome: null, decisor_nome: 'Carla' }),
    'Lead em contato com o porteiro, mas o nome do porteiro ainda não foi preenchido.',
  )
  assert.equal(
    contactSpotlight({ status: 'falando_decisor', porteiro_nome: 'João', decisor_nome: '' }),
    'Lead falando com o decisor, mas o nome do decisor ainda não foi preenchido.',
  )
  assert.equal(contactSpotlight({ status: 'contato_porteiro', porteiro_nome: 'João', decisor_nome: null }), null)
  assert.equal(contactSpotlight({ status: 'novo', porteiro_nome: null, decisor_nome: null }), null)
})
