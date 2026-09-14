import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFeatureFlag, isGlcGuiaConversaEnabled } from '../src/utils/feature-flags.ts'
import {
  APP_DOCUMENT_TITLE,
  GUIDE_PATH_CANONICAL,
  GUIDE_PATH_LEGACY,
  GUIDE_TITLE_OFF,
  GUIDE_TITLE_ON,
  defaultGuideTab,
  displayGuideNodeTitle,
  guideDocumentTitle,
  guidePageTitle,
  guideTabs,
  shouldRedirectLegacyGuidePath,
} from '../src/features/guide/guide-chrome.ts'
import {
  flattenGuiaConversaNodes,
  guiaConversaEtapaIds,
  guiaConversaEtapas,
  guiaConversaF3Chips,
  guiaConversaPrinciples,
  guiaConversaTree,
  searchGuiaConversaNodes,
} from '../src/features/guide/guia-conversa-data.ts'
import { buildGuiaConversaVars, interpolateGuiaConversa } from '../src/features/guide/guia-conversa-interpolate.ts'
import { parseAppLocation, buildGuideHref } from '../src/utils/app-location.ts'
import { waSpecSeedNames } from '../src/types/whatsapp.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('CA-F11 flag do guia fica desligada por padrão e só liga com valores explícitos', () => {
  assert.equal(parseFeatureFlag(undefined), false)
  assert.equal(isGlcGuiaConversaEnabled(), false)
  assert.equal(isGlcGuiaConversaEnabled('true'), true)
  assert.equal(isGlcGuiaConversaEnabled('1'), true)
  assert.equal(isGlcGuiaConversaEnabled('ON'), true)
  assert.equal(isGlcGuiaConversaEnabled('off'), false)
})

test('CA-F11 rename do chrome só com a flag ON; OFF preserva Guia de ligação', () => {
  assert.equal(guidePageTitle(false), GUIDE_TITLE_OFF)
  assert.equal(guidePageTitle(true), GUIDE_TITLE_ON)
  assert.equal(guideDocumentTitle(false), `Guia de ligação — ${APP_DOCUMENT_TITLE}`)
  assert.equal(guideDocumentTitle(true), `Guia de conversa — ${APP_DOCUMENT_TITLE}`)
  assert.deepEqual(guideTabs(false), ['ligacao'])
  assert.deepEqual(guideTabs(true), ['ligacao', 'whatsapp'])
  assert.equal(defaultGuideTab(true), 'whatsapp')
  assert.equal(defaultGuideTab(false), 'ligacao')
  assert.equal(displayGuideNodeTitle('Guia de ligação', true), 'Guia de conversa')
  assert.equal(displayGuideNodeTitle('Guia de ligação', false), 'Guia de ligação')
})

test('CA-F11 rotas /guia-conversa e legado /guia-ligacao; redirect do legado só com flag ON', () => {
  assert.equal(GUIDE_PATH_CANONICAL, '/guia-conversa')
  assert.equal(GUIDE_PATH_LEGACY, '/guia-ligacao')
  assert.equal(shouldRedirectLegacyGuidePath('/guia-ligacao', true), true)
  assert.equal(shouldRedirectLegacyGuidePath('/guia-ligacao', false), false)
  assert.equal(shouldRedirectLegacyGuidePath('/guia-conversa', true), false)
  const off = parseAppLocation('https://glc.local/guia-ligacao', { guiaEnabled: false, cadenciaEnabled: false })
  assert.equal(off.page, 'guide')
  assert.equal(off.guideTab, 'ligacao')
  assert.equal(off.replacePath, null)
  const onLegacy = parseAppLocation('https://glc.local/guia-ligacao?leadId=abc', { guiaEnabled: true, cadenciaEnabled: false })
  assert.equal(onLegacy.page, 'guide')
  assert.equal(onLegacy.leadId, 'abc')
  assert.equal(onLegacy.replacePath, '/guia-conversa')
  assert.equal(onLegacy.guideTab, 'whatsapp')
  const onTab = parseAppLocation('https://glc.local/guia-conversa?tab=ligacao', { guiaEnabled: true, cadenciaEnabled: true })
  assert.equal(onTab.guideTab, 'ligacao')
  assert.equal(buildGuideHref({ enabled: true, leadId: 'lead-1' }), '/guia-conversa?leadId=lead-1')
  assert.equal(buildGuideHref({ enabled: false }), '/guia-ligacao')
  const hoje = parseAppLocation('https://glc.local/hoje', { guiaEnabled: false, cadenciaEnabled: true })
  assert.equal(hoje.page, 'hoje')
})

test('CA-F11 as 6 etapas do WhatsApp estão presentes', () => {
  const titles = guiaConversaEtapas().map((item) => item.title)
  assert.deepEqual(guiaConversaEtapaIds, [
    'preparacao',
    'mensagem-porteiro',
    'reacoes',
    'decisor-responde',
    'pedir-reuniao',
    'pos-cadencia',
  ])
  assert.deepEqual(titles, [
    'Preparação',
    'Mensagem ao porteiro',
    'Reações A–F',
    'Decisor responde',
    'Pedir reunião',
    'Pós/cadência',
  ])
  for (const id of guiaConversaEtapaIds) {
    assert.equal(guiaConversaTree.children?.some((item) => item.id === id), true)
  }
})

test('CA-F11 chips F3 só nos 5 mapeamentos; corpos do Kit não mudam nesta entrega', () => {
  const chips = guiaConversaF3Chips().map((item) => item.f3Chip)
  assert.deepEqual([...new Set(chips)].sort(), [...waSpecSeedNames].sort())
  assert.equal(chips.filter((item) => item === 'Follow-up D+3').length, 2)
  assert.equal(guiaConversaF3Chips().length, 6)
  const primeira = flattenGuiaConversaNodes().find((item) => item.f3Chip === 'Primeira abordagem (porteiro)')
  assert.equal(
    primeira?.say,
    'Oi! Aqui é {{seu_nome}}. Vi a {{empresa}} ({{segmento}} em {{bairro_ou_cidade}}) e {{gatilho}}. Você poderia me encaminhar para quem decide a parte de marketing/site?',
  )
  const caseNicho = flattenGuiaConversaNodes().find((item) => item.id === 'pos-case-nicho')
  assert.equal(caseNicho?.f3Chip, undefined)
  const kitSql = readFileSync(join(root, 'supabase/migrations/20260912170000_kit_whatsapp_spec_seeds.sql'), 'utf8')
  assert.match(kitSql, /Primeira abordagem \(porteiro\)/)
})

test('CA-F11 conteúdo do Guia WhatsApp não tem R$ de pacote nem proxima_acao_*', () => {
  const blob = JSON.stringify({ tree: guiaConversaTree, principles: guiaConversaPrinciples })
  assert.equal(blob.includes('R$'), false)
  assert.equal(blob.includes('proxima_acao'), false)
  const files = [
    'src/features/guide/guia-conversa-data.ts',
    'src/features/guide/guia-conversa-interpolate.ts',
    'src/features/guide/GuideWhatsAppPanel.tsx',
    'src/pages/GuidePage.tsx',
    'src/features/guide/guide-chrome.ts',
  ]
  for (const file of files) {
    const src = readFileSync(join(root, file), 'utf8')
    assert.equal(src.includes('proxima_acao'), false, file)
    assert.equal(/R\$\s*\d/.test(src), false, file)
  }
})

test('CA-F11 interpolação F3 + horario_1/2 default amanhã 10h/16h e {{#se}} omite vazio', () => {
  const now = new Date('2026-09-14T15:00:00-03:00')
  const vars = buildGuiaConversaVars({
    company_name: 'Padaria Central',
    responsible_name: 'Ana',
    gatilho: 'vi o Instagram',
    segment: 'alimentação',
    address: 'Rua das Flores, 10, Boa Viagem, Recife - PE',
    prototipo_url: 'https://proto.example/padaria',
    porteiro_nome: 'João',
    decisor_nome: 'Carla',
  }, 'Francisco', now)
  assert.equal(vars.empresa, 'Padaria Central')
  assert.equal(vars.horario_1.includes('amanhã'), true)
  assert.equal(vars.horario_1.includes('10h'), true)
  assert.equal(vars.horario_2.includes('16h'), true)
  const filled = interpolateGuiaConversa('Oi {{empresa}} {{#se gatilho}}porque {{gatilho}}{{/se}} às {{horario_1}}', vars)
  assert.equal(filled.includes('Padaria Central'), true)
  assert.equal(filled.includes('porque vi o Instagram'), true)
  assert.equal(filled.includes('10h'), true)
  const empty = interpolateGuiaConversa('Oi {{empresa}} {{#se gatilho}}porque {{gatilho}}.{{/se}} fim', {
    empresa: 'Padaria Central',
    gatilho: '—',
    horario_1: vars.horario_1,
    horario_2: vars.horario_2,
  })
  assert.equal(empty.includes('porque'), false)
  assert.equal(empty.includes('Oi Padaria Central'), true)
  const missingLead = buildGuiaConversaVars(null, '', now)
  assert.equal(missingLead.empresa, '—')
  assert.equal(interpolateGuiaConversa('{{#se empresa}}X{{/se}}', missingLead), '')
})

test('CA-F11 busca encontra reação e princípios permanecem colapsáveis no markup', () => {
  const hits = searchGuiaConversaNodes('encaminhou')
  assert.equal(hits.some((item) => item.id === 'reacao-a'), true)
  const panel = readFileSync(join(root, 'src/features/guide/GuideWhatsAppPanel.tsx'), 'utf8')
  assert.match(panel, /<details className="guide-principles">/)
  assert.match(panel, /anexe o print do protótipo/)
  assert.match(panel, /next_action/)
  assert.match(panel, /next_action_due_date/)
  assert.equal(panel.includes('proxima_acao'), false)
})
