import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, MAX_CSV_BYTES } from '../src/utils/csv.ts'
import { isDate, localDate, dateLabel, revenueTotal } from '../src/utils/dates.ts'
import { contactPayload, leadPayload, projectPayload } from '../src/utils/validation.ts'
import { filterClients, groupProjectsByClient } from '../src/utils/clients.ts'
import { filterLeads, isOverdueLead } from '../src/utils/leads.ts'
import { readAll } from '../src/lib/read-all.ts'
import { assertBuildPublicConfig, publicConfig } from '../src/utils/public-config.ts'

test('configuração barra segredo privilegiado antes de gerar bundle', () => {
  const jwt = (role) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.fixture'
  assert.throws(() => publicConfig('https://fixture.supabase.co', 'sb_secret_fixture'))
  assert.throws(() => publicConfig('https://fixture.supabase.co', jwt('service_role')))
  assert.throws(() => publicConfig('https://fixture.supabase.co', jwt('authenticated')))
  assert.throws(() => publicConfig('', ''))
  assert.throws(() => publicConfig('http://fixture.supabase.co', 'sb_publishable_fixture'))
  assert.equal(publicConfig('https://fixture.supabase.co', jwt('anon')).key, jwt('anon'))
  assert.equal(publicConfig('https://fixture.supabase.co', 'sb_publishable_fixture').key, 'sb_publishable_fixture')
})

test('build sem VITE_SUPABASE_* não aborta; par incompleto ou privilegiado aborta', () => {
  const jwt = (role) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.fixture'
  assert.equal(assertBuildPublicConfig(undefined, undefined), null)
  assert.equal(assertBuildPublicConfig('', ''), null)
  assert.equal(assertBuildPublicConfig('   ', '  '), null)
  assert.throws(() => assertBuildPublicConfig('https://fixture.supabase.co', ''))
  assert.throws(() => assertBuildPublicConfig('', 'sb_publishable_fixture'))
  assert.throws(() => assertBuildPublicConfig('https://fixture.supabase.co', jwt('service_role')))
  assert.equal(assertBuildPublicConfig('https://fixture.supabase.co', 'sb_publishable_fixture')?.key, 'sb_publishable_fixture')
})

test('mês inclui primeiro dia inteiro, exclui anterior e futuro', () => {
  const rows = [{ price: 10, completed_at: '2026-09-01' }, { price: 20, completed_at: '2026-08-31' }, { price: 30, completed_at: '2026-09-07' }]
  assert.equal(revenueTotal(rows, 'mes', new Date(2026, 8, 6, 17)), 10)
  assert.equal(revenueTotal(rows, 'total'), 60)
})
test('semana inclui domingo à meia-noite', () => {
  assert.equal(revenueTotal([{ price: 100, completed_at: '2026-09-06' }], 'semana', new Date(2026, 8, 6, 17)), 100)
})
test('soma em centavos não acumula erro de ponto flutuante', () => {
  assert.equal(revenueTotal([{ price: '0.10', completed_at: null }, { price: '0.20', completed_at: null }], 'total'), 0.3)
  assert.throws(() => revenueTotal([{ price: 'NaN', completed_at: null }], 'total'))
})
test('data civil preserva dia local e rejeita dias inexistentes', () => {
  assert.equal(localDate(new Date(2026, 8, 6, 23, 59)), '2026-09-06')
  assert.equal(isDate('2026-02-30'), false)
  assert.equal(isDate('2024-02-29'), true)
  assert.equal(isDate('2025-02-29'), false)
  assert.equal(dateLabel('malformada'), 'Sem data válida')
})
test('filtros puros preservam busca, status e atrasos', () => {
  const leads = [
    { company_name: 'Acme', responsible_name: 'Ana', status: 'novo', next_action_due_date: '2026-09-05' },
    { company_name: 'Beta', responsible_name: 'Bruno', status: 'perdido', next_action_due_date: '2026-09-01' },
    { company_name: 'Gamma', responsible_name: null, status: 'negociacao', next_action_due_date: null },
  ]
  assert.equal(isOverdueLead(leads[0], '2026-09-10'), true)
  assert.deepEqual(filterLeads(leads, { search: ' ana ', status: 'ativos', onlyOverdue: true }, '2026-09-10'), [leads[0]])
  assert.deepEqual(filterLeads(leads, { search: '', status: 'todos', onlyOverdue: false }, '2026-09-10'), leads)
})
test('filtro de clientes procura contato e situação de projeto', () => {
  const clients = [
    { company_name: 'Acme', responsible_name: 'Ana', projects: [{ status: 'concluido' }] },
    { company_name: 'Beta', responsible_name: 'Bruno', projects: [{ status: 'pausado' }] },
  ]
  assert.deepEqual(filterClients(clients, 'ana', 'concluido'), [clients[0]])
  assert.deepEqual(filterClients(clients, '', 'todos'), clients)
})
test('agrupamento de projetos não compartilha listas entre clientes', () => {
  const projects = [
    { id: 'p1', client_id: 'c1' },
    { id: 'p2', client_id: 'c1' },
    { id: 'p3', client_id: 'c2' },
  ]
  const grouped = groupProjectsByClient(projects)
  assert.deepEqual(grouped.get('c1'), [projects[0], projects[1]])
  assert.deepEqual(grouped.get('c2'), [projects[2]])
})
test('CSV suporta BOM, CRLF, aspas escapadas, vírgula e quebra em campo', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"um, dois","diz ""oi""\nlinha"\r\n'), [['a', 'b'], ['um, dois', 'diz "oi"\nlinha']])
})
test('CSV rejeita aspas truncadas, sintaxe inválida, campos enormes e excesso de linhas', () => {
  for (const text of ['a\n"ab', 'a\nx"y', 'a\n"ab"x', 'a\n' + 'x'.repeat(10001), 'a\n' + 'x\n'.repeat(501), 'x'.repeat(MAX_CSV_BYTES + 1)]) assert.throws(() => parseCsv(text))
  assert.equal(parseCsv('a\n' + 'x\n'.repeat(500)).length, 501)
})
test('payload permite somente campos de negócio e normaliza contatos', () => {
  const result = contactPayload({ company_name: ' Empresa ', id: 'injetado', lead_id: 'injetado', role: 'admin', email: ' a@b.com ' })
  assert.equal(result.company_name, 'Empresa')
  assert.equal(result.email, 'a@b.com')
  for (const key of ['id', 'lead_id', 'role']) assert.equal(key in result, false)
})
test('validação rejeita URL executável, email inválido e tamanho excessivo', () => {
  for (const values of [{ company_name: ' ' }, { company_name: 'x', google_maps_url: 'javascript:alert(1)' }, { company_name: 'x', email: 'invalido' }, { company_name: 'x', notes: 'x'.repeat(10001) }]) assert.throws(() => contactPayload(values))
  assert.throws(() => leadPayload({ company_name: 'x', status: 'novo', next_action_due_date: '2026-02-30' }))
})
test('projeto preserva centavos, valida limites e remove data fora de concluído', () => {
  const value = { name: ' Site ', price: '10.50', deadline: '', status: 'concluido', completed_at: '2026-09-01' }
  assert.equal(projectPayload(value).price, '10.50')
  assert.equal(projectPayload({ ...value, status: 'pausado' }).completed_at, null)
  for (const price of ['', '-1', 'NaN', 'Infinity', '1.001', '10000000000']) assert.throws(() => projectPayload({ ...value, price }))
})
test('leitura pagina mesmo quando servidor limita a menos de 500 linhas', async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }))
  const result = await readAll((from) => Promise.resolve({ data: rows.slice(from, from + 100), count: rows.length, error: null }))
  assert.equal(result.length, 1201)
  assert.equal(result.at(-1).id, 1200)
})
test('leitura não retorna resultado parcial quando há falha, mudança ou limite', async () => {
  await assert.rejects(readAll(() => Promise.resolve({ data: [], count: 1, error: null })))
  await assert.rejects(readAll(() => Promise.resolve({ data: [], count: 20001, error: null })))
  await assert.rejects(readAll(() => Promise.resolve({ data: [], count: null, error: null })))
  await assert.rejects(readAll((from) => Promise.resolve({ data: [{ id: from }], count: from === 0 ? 2 : 3, error: null })))
  await assert.rejects(readAll(() => Promise.resolve({ data: null, count: null, error: new Error('falha') })))
})
