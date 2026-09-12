import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { parseFeatureFlag, isGlcKitWhatsappEnabled } from '../src/utils/feature-flags.ts'
import { leadPayload, leadUpdatePayload } from '../src/utils/validation.ts'
import { normalizeWhatsappDigits, toE164Br, whatsappMeUrl } from '../src/features/cadencia/whatsapp.ts'
import {
  bairroOuCidadeFromAddress,
  buildWaTemplateContext,
  buildWhatsappMeUrl,
  displayNameFromUser,
  interpolateWaTemplate,
  statusToWaEtapa,
  suggestWaTemplate,
} from '../src/features/whatsapp/templates.ts'
import { updateLeadLastWaTemplate, waTemplatePayload } from '../src/features/whatsapp/whatsapp-service.ts'
import { registrarCadencia } from '../src/features/cadencia/cadencia-service.ts'

test('CA-F3-01/13 flag do kit fica desligada por padrão e só liga com valores explícitos', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(isGlcKitWhatsappEnabled(), false)
  assert.equal(isGlcKitWhatsappEnabled('true'), true)
  assert.equal(isGlcKitWhatsappEnabled('1'), true)
  assert.equal(isGlcKitWhatsappEnabled('ON'), true)
  assert.equal(isGlcKitWhatsappEnabled('off'), false)
})

test('CA-F3-02/07 seeds da SPEC sugerem por status (2 horários / D-1 / primeira abordagem)', () => {
  const templates = [
    { id: '1', nome: 'Primeira abordagem (porteiro)', etapa: 'contato_porteiro', corpo: 'a', ativo: true, created_at: '', updated_at: '' },
    { id: '2', nome: 'Follow-up D+3', etapa: 'qualquer', corpo: 'b', ativo: true, created_at: '', updated_at: '' },
    { id: '3', nome: 'Break-up', etapa: 'qualquer', corpo: 'c', ativo: true, created_at: '', updated_at: '' },
    { id: '4', nome: 'Decisor respondeu — pedir 2 horários', etapa: 'falando_decisor', corpo: 'd', ativo: true, created_at: '', updated_at: '' },
    { id: '5', nome: 'Confirmar reunião D-1', etapa: 'reuniao_marcada', corpo: 'e', ativo: true, created_at: '', updated_at: '' },
    { id: '6', nome: 'Follow inativo', etapa: 'qualquer', corpo: 'x', ativo: false, created_at: '', updated_at: '' },
  ]
  assert.equal(statusToWaEtapa.novo, 'contato_porteiro')
  assert.equal(statusToWaEtapa.contato_porteiro, 'contato_porteiro')
  assert.equal(statusToWaEtapa.falando_decisor, 'falando_decisor')
  assert.equal(statusToWaEtapa.reuniao_marcada, 'reuniao_marcada')
  assert.equal(statusToWaEtapa.encaminhado, 'qualquer')
  assert.equal(suggestWaTemplate(templates, 'novo')?.id, '1')
  assert.equal(suggestWaTemplate(templates, 'contato_porteiro')?.id, '1')
  assert.equal(suggestWaTemplate(templates, 'falando_decisor')?.nome, 'Decisor respondeu — pedir 2 horários')
  assert.equal(suggestWaTemplate(templates, 'reuniao_marcada')?.nome, 'Confirmar reunião D-1')
  assert.equal(suggestWaTemplate(templates, 'encaminhado')?.nome, 'Follow-up D+3')
  assert.equal(suggestWaTemplate(templates, 'negociacao')?.id, '2')
  assert.notEqual(suggestWaTemplate(templates, 'encaminhado')?.id, '6')
})

test('CA-F3-08/12 variáveis mapeiam campos reais e não gravam o template', () => {
  const corpo = 'Oi {{responsavel}} da {{empresa}} em {{bairro_ou_cidade}}. {{gatilho}} {{segmento}} {{prototipo_url}} {{seu_nome}} {{porteiro_nome}} {{decisor_nome}}'
  const context = buildWaTemplateContext({
    company_name: 'Padaria Central',
    responsible_name: 'Ana',
    gatilho: 'vi o Instagram',
    segment: 'alimentação',
    address: 'Rua das Flores, 10, Boa Viagem, Recife - PE',
    prototipo_url: 'https://proto.example/padaria',
  }, 'Francisco')
  const preview = interpolateWaTemplate(corpo, context)
  assert.equal(context.empresa, 'Padaria Central')
  assert.equal(context.responsavel, 'Ana')
  assert.equal(context.gatilho, 'vi o Instagram')
  assert.equal(context.segmento, 'alimentação')
  assert.equal(context.bairro_ou_cidade, 'Recife')
  assert.equal(context.prototipo_url, 'https://proto.example/padaria')
  assert.equal(context.seu_nome, 'Francisco')
  assert.equal(context.porteiro_nome, '—')
  assert.equal(context.decisor_nome, '—')
  assert.match(preview, /Padaria Central/)
  assert.match(preview, /Recife/)
  assert.equal(corpo.includes('Padaria Central'), false)
  assert.equal(bairroOuCidadeFromAddress(null), '—')
  assert.equal(bairroOuCidadeFromAddress('Centro, Olinda'), 'Olinda')
  assert.equal(displayNameFromUser({ email: 'ana@glc.com', user_metadata: {} }), 'ana')
  assert.equal(displayNameFromUser({ email: 'ana@glc.com', user_metadata: { full_name: 'Ana Souza' } }), 'Ana Souza')
})

test('CA-F3-10 número vira E.164 BR e o wa.me leva texto URL-encoded', () => {
  assert.equal(toE164Br('81 98888-7777'), '+5581988887777')
  assert.equal(normalizeWhatsappDigits('005581988887777'), '5581988887777')
  assert.equal(whatsappMeUrl('81988887777')?.includes('text='), false)
  const url = buildWhatsappMeUrl('81988887777', 'Oi Ana! veja o print')
  assert.equal(url?.startsWith('https://wa.me/5581988887777?text='), true)
  assert.equal(url?.includes('Oi%20Ana'), true)
  assert.equal(url?.includes('graph.facebook.com'), false)
})

test('P2-001 número inválido não gera wa.me', () => {
  assert.equal(normalizeWhatsappDigits('123'), null)
  assert.equal(normalizeWhatsappDigits(''), null)
  assert.equal(normalizeWhatsappDigits('abc'), null)
  assert.equal(normalizeWhatsappDigits('   '), null)
  assert.equal(toE164Br('12'), null)
  assert.equal(whatsappMeUrl('999'), null)
  assert.equal(buildWhatsappMeUrl('abc', 'oi'), null)
})

test('CA-F3-05 payload do template só aceita nome/etapa/corpo/ativo', () => {
  const payload = waTemplatePayload({
    nome: 'Abertura extra',
    etapa: 'contato_porteiro',
    corpo: 'Oi {{empresa}}',
    ativo: true,
  })
  assert.deepEqual(Object.keys(payload).sort(), ['ativo', 'corpo', 'etapa', 'nome'])
  assert.throws(() => waTemplatePayload({ nome: 'x', etapa: 'invalida', corpo: 'oi', ativo: true }))
  assert.throws(() => waTemplatePayload({ nome: '', etapa: 'contato_porteiro', corpo: 'oi', ativo: true }))
})

test('CA-F3-02 update cadastral com flag OFF não envia campos do kit; com ON envia sem mass-assign', () => {
  const values = {
    company_name: 'x',
    gatilho: 'vi o perfil',
    prototipo_url: 'https://proto.example/a',
    prototipo_notas: 'versão 1',
    wa_ultimo_template_id: 'a1111111-1111-4111-8111-111111111111',
    status: 'perdido',
  }
  const off = leadUpdatePayload(values, false)
  assert.equal('gatilho' in off, false)
  assert.equal('prototipo_url' in off, false)
  assert.equal('wa_ultimo_template_id' in off, false)
  assert.equal('status' in off, false)
  const on = leadUpdatePayload(values, true)
  assert.equal(on.gatilho, 'vi o perfil')
  assert.equal(on.prototipo_url, 'https://proto.example/a')
  assert.equal('wa_ultimo_template_id' in on, false)
  assert.equal('status' in on, false)
  const created = leadPayload({ company_name: 'x', status: 'novo', gatilho: 'ok' }, false, true)
  assert.equal(created.gatilho, 'ok')
  assert.throws(() => leadUpdatePayload({ company_name: 'x', prototipo_url: 'http://inseguro.example' }, true))
})

function mock(status = 200, body = { id: 'fixture', updated_at: 'v2' }) {
  const calls = []
  const client = createClient('https://fixture.supabase.co', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      calls.push({ url: new URL(String(url)), ...init })
      return new Response(JSON.stringify(status === 200 ? body : { message: 'erro', code: 'PGRST116' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    } },
  })
  return { client, calls }
}

test('CA-F3-11 Considerar como Toquei chama o motor F2 registrar_cadencia', async () => {
  const { client, calls } = mock()
  await registrarCadencia(client, { id: 'lead-1', updated_at: 'v1' }, {
    acao: 'toquei',
    canal: 'whatsapp',
    nota: 'WhatsApp: Abertura',
  })
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/registrar_cadencia')
  assert.deepEqual(JSON.parse(calls[0].body), {
    p_lead_id: 'lead-1',
    p_expected_updated_at: 'v1',
    p_acao: 'toquei',
    p_nota: 'WhatsApp: Abertura',
    p_next_action: null,
    p_next_action_due_date: null,
    p_canal: 'whatsapp',
  })
})

test('último template grava só wa_ultimo_template_id com versão', async () => {
  const { client, calls } = mock()
  await updateLeadLastWaTemplate(client, { id: 'lead-1', updated_at: 'v1' }, 'a1111111-1111-4111-8111-111111111111')
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].url.searchParams.get('updated_at'), 'eq.v1')
  assert.deepEqual(JSON.parse(calls[0].body), {
    wa_ultimo_template_id: 'a1111111-1111-4111-8111-111111111111',
  })
})

test('CA-F3-13 feature do kit não inclui cliente WhatsApp Cloud API', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const files = [
    ...readdirSync(join(root, 'src/features/whatsapp')).map((name) => join(root, 'src/features/whatsapp', name)),
    join(root, 'src/pages/WaTemplatesPage.tsx'),
    join(root, 'src/features/cadencia/whatsapp.ts'),
    join(root, 'supabase/migrations/20260912160000_kit_whatsapp.sql'),
    join(root, 'supabase/migrations/20260912170000_kit_whatsapp_spec_seeds.sql'),
  ]
  const forbidden = /graph\.facebook\.com|WhatsAppCloud|cloud\.whatsapp|messages\.whatsapp|360dialog|gupshup|from ['"]@[^'"]*whatsapp/i
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    assert.equal(forbidden.test(source), false, file)
  }
})
