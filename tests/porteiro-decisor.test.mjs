import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFeatureFlag, isGlcPorteiroDecisorEnabled } from '../src/utils/feature-flags.ts'
import { leadPayload, leadUpdatePayload } from '../src/utils/validation.ts'
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

test('CA-F4-03/04 payload mantém geral legado e default contato_principal=geral', () => {
  const created = leadPayload({ company_name: 'Padaria', status: 'novo' })
  assert.equal(created.responsible_name, null)
  assert.equal(created.whatsapp, null)
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
  })
  assert.equal(updated.responsible_name, 'Ana')
  assert.equal(updated.whatsapp, '81988887777')
  assert.equal(updated.contato_principal, 'porteiro')
  assert.equal(updated.porteiro_nome, 'João')
  assert.equal('deleted_at' in updated, false)
  assert.equal('status' in updated, false)
  assert.throws(() => leadPayload({ company_name: 'x', status: 'novo', contato_principal: 'secretaria' }))
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
