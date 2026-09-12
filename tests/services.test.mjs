import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { updateClient, updateProject } from '../src/features/clients/client-service.ts'
import { updateLead, createLeads, deleteLead, convertLeadToClient } from '../src/features/leads/lead-service.ts'

function mock(status = 200) {
  const calls = []
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), ...init })
      return new Response(JSON.stringify(status === 200 ? { id: 'fixture' } : { message: 'No rows', code: 'PGRST116' }), { status, headers: { 'Content-Type': 'application/json' } })
    } },
  })
  return { client, calls }
}
test('edições enviam versão esperada e não aceitam campos administrativos', async () => {
  const { client, calls } = mock()
  await updateLead(client, 'fixture', { company_name: 'Teste', status: 'novo', id: 'outro' }, 'versao-1')
  await updateClient(client, 'fixture', { company_name: 'Teste', lead_id: 'outro' }, 'versao-2')
  await updateProject(client, 'fixture', { name: 'Teste', price: '1.25', status: 'pausado', deadline: '', completed_at: '' }, 'versao-3')
  assert.equal(calls.length, 3)
  calls.forEach((call, index) => {
    assert.equal(call.url.searchParams.get('updated_at'), `eq.versao-${index + 1}`)
    assert.equal(call.method, 'PATCH')
    assert.equal('id' in JSON.parse(call.body), false)
    assert.equal('lead_id' in JSON.parse(call.body), false)
    if (index === 0) assert.equal('status' in JSON.parse(call.body), false)
  })
})
test('edição concorrente e exclusão sem registro não são sucesso falso', async () => {
  const { client } = mock(406)
  await assert.rejects(updateClient(client, 'fixture', { company_name: 'Teste' }, 'antiga'))
  await assert.rejects(deleteLead(client, 'fixture'))
})
test('importação excedente é recusada antes da rede', async () => {
  const { client, calls } = mock()
  await assert.rejects(createLeads(client, Array(501).fill({ company_name: 'Teste', status: 'novo' })))
  assert.equal(calls.length, 0)
})

test('conversão chama a RPC com o lead correto', async () => {
  const { client, calls } = mock()
  await convertLeadToClient(client, 'lead-123')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/convert_lead_to_client')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].body), { p_lead_id: 'lead-123' })
})

test('conversão propaga erro da RPC', async () => {
  const { client } = mock(400)
  await assert.rejects(convertLeadToClient(client, 'lead-123'))
})
