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
  guiaConversaEvitar,
  guiaConversaF3Chips,
  guiaConversaFazer,
  guiaConversaFunil,
  guiaConversaPrinciples,
  guiaConversaSays,
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
  const chips = guiaConversaF3Chips()
  assert.equal(chips.length, 5)
  assert.deepEqual(
    chips.map((item) => [item.id, item.f3Chip]).sort((a, b) => a[0].localeCompare(b[0])),
    [
      ['decisor-responde', 'Decisor respondeu — pedir 2 horários'],
      ['mensagem-porteiro', 'Primeira abordagem (porteiro)'],
      ['pos-breakup', 'Break-up'],
      ['pos-confirmar-d1', 'Confirmar reunião D-1'],
      ['reacao-f', 'Follow-up D+3'],
    ],
  )
  assert.deepEqual([...new Set(chips.map((item) => item.f3Chip))].sort(), [...waSpecSeedNames].sort())
  const primeira = flattenGuiaConversaNodes().find((item) => item.f3Chip === 'Primeira abordagem (porteiro)')
  assert.equal(primeira?.id, 'mensagem-porteiro')
  assert.equal(primeira?.say, guiaConversaSays.abertura)
  assert.equal(primeira?.say?.includes('Oi! Aqui é'), false)
  const t3 = flattenGuiaConversaNodes().find((item) => item.id === 'pos-t3')
  assert.equal(t3?.f3Chip, undefined)
  const kitSql = readFileSync(join(root, 'supabase/migrations/20260912170000_kit_whatsapp_spec_seeds.sql'), 'utf8')
  assert.match(kitSql, /Primeira abordagem \(porteiro\)/)
  assert.match(
    kitSql,
    /Oi! Aqui é \{\{seu_nome\}\}\. Vi a \{\{empresa\}\} \(\{\{segmento\}\} em \{\{bairro_ou_cidade\}\}\) e \{\{gatilho\}\}/,
  )
})

test('CA-F11 copy WhatsApp bate com o brief PRIMARY (abertura, ramos, §3.3, T4)', () => {
  const nodes = flattenGuiaConversaNodes()
  const byId = Object.fromEntries(nodes.map((item) => [item.id, item]))
  assert.equal(byId['mensagem-porteiro']?.say, guiaConversaSays.abertura)
  assert.match(guiaConversaSays.abertura, /Separei um print rápido de uma ideia de página pra \{\{empresa\}\} \(mobile\)/)
  assert.equal(byId['variante-gatilho']?.say, guiaConversaSays.varianteGatilho)
  assert.equal(byId['reacao-a']?.title, 'A — Pode falar por aqui / pode mandar')
  assert.equal(byId['reacao-a']?.say, guiaConversaSays.ramoA)
  assert.equal(byId['reacao-a']?.glc?.next_action_due_date, 'D+3')
  assert.match(byId['reacao-a']?.glc?.next_action ?? '', /Follow-up se silêncio/)
  assert.equal(byId['reacao-b']?.title, 'B — A responsável não está / liga depois')
  assert.equal(
    byId['reacao-b']?.say,
    'Tranquilo. Qual o melhor jeito de deixar o recado — esse WhatsApp mesmo?\n\nTe mando 1 print + 2 linhas pra ficar fácil de encaminhar. Qual seu nome, por favor?',
  )
  assert.equal(byId['reacao-b']?.say?.includes('Obrigado, {{porteiro_nome}}'), false)
  assert.equal(byId['reacao-b-obrigado']?.say, 'Obrigado, {{porteiro_nome}}! Qualquer dúvida dela, pode me chamar aqui.')
  assert.equal(byId['reacao-c']?.title, 'C — Não temos interesse')
  assert.equal(byId['reacao-c']?.say, guiaConversaSays.ramoC)
  assert.equal(byId['reacao-c-nao']?.say, 'Combinado, valeu pelo tempo. Se no futuro mudarem de ideia, é só chamar.')
  assert.equal(byId['reacao-c-nao']?.say?.startsWith('Se não:'), false)
  assert.equal(byId['reacao-c-nao']?.glc?.status, 'perdido')
  assert.equal(byId['reacao-c-nao']?.glc?.motivo_perda, 'sem_decisor')
  assert.match(byId['reacao-c-nao']?.glc?.note ?? '', /pausado_60d/)
  assert.equal(byId['reacao-d']?.title, 'D — Já temos site / já tem alguém')
  assert.equal(byId['reacao-d']?.say, guiaConversaSays.ramoD)
  assert.match(guiaConversaSays.ramoD, /site atual já gera contato pelo Google\/WhatsApp/)
  assert.equal(byId['reacao-e']?.title, 'E — Manda proposta / manda por e-mail')
  assert.equal(byId['reacao-e']?.say, guiaConversaSays.ramoE)
  assert.equal(byId['reacao-f']?.title, 'F — Silêncio (2–3 dias após 1º toque)')
  assert.equal(byId['reacao-f']?.say, guiaConversaSays.ramoF)
  assert.equal(byId['decisor-responde']?.say, guiaConversaSays.decisor31)
  assert.equal(byId['pedir-reuniao']?.say, guiaConversaSays.decisor32)
  assert.equal(byId['decisor-33']?.say, guiaConversaSays.decisor33)
  assert.match(guiaConversaSays.decisor33, /Faixa pra esse tipo de landing depende do escopo/)
  assert.equal(guiaConversaSays.decisor33.includes('R$'), false)
  assert.equal(byId['decisor-34']?.say, guiaConversaSays.decisor34)
  assert.equal(byId['decisor-35']?.say, guiaConversaSays.decisor35)
  assert.equal(byId['decisor-36']?.say, guiaConversaSays.decisor36)
  assert.equal(byId['pos-confirmar-d1']?.say, guiaConversaSays.decisor37)
  assert.equal(byId['pos-t3']?.say, guiaConversaSays.cadenciaT3)
  assert.equal(byId['pos-breakup']?.title, 'Break-up T4')
  assert.equal(byId['pos-breakup']?.say, guiaConversaSays.cadenciaT4)
  assert.match(guiaConversaSays.cadenciaT4, /vou pausar pra não atrapalhar a rotina de vocês/)
  const fazer = guiaConversaFazer.join('\n')
  assert.match(guiaConversaFazer[0], /não “site”\./)
  assert.equal(fazer.includes('“site.”'), false)
  assert.match(fazer, /Exemplos de gatilho/)
  assert.match(fazer, /com atendente/)
  assert.match(fazer, /quando for pedir call/)
  assert.equal(guiaConversaEvitar[0].includes('Olá, tudo bem?'), true)
  assert.equal(guiaConversaFunil, 'Novo → Contato porteiro → Encaminhado → Falando com decisor → Reunião marcada → Proposta enviada → Convertido ↘ Pausado 60d / Perdido')
})

test('CA-F11 conteúdo do Guia WhatsApp não tem R$ de pacote nem proxima_acao', () => {
  const blob = JSON.stringify({ tree: guiaConversaTree, principles: guiaConversaPrinciples, says: guiaConversaSays })
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
    assert.equal(src.includes('R$'), false, file)
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
    reuniao_em: '2026-09-15T10:00:00-03:00',
    reuniao_link: 'https://meet.example/glc',
  }, 'Francisco', now)
  assert.equal(vars.empresa, 'Padaria Central')
  assert.equal(vars.horario_1, 'amanhã 10h')
  assert.equal(vars.horario_2, 'amanhã 16h')
  assert.equal(vars.nome, 'Carla')
  assert.equal(vars.hora, '10h')
  assert.equal(vars.reuniao_link, 'https://meet.example/glc')
  const onlyPorteiro = buildGuiaConversaVars({
    company_name: 'Padaria Central',
    responsible_name: 'Ana',
    gatilho: 'vi o Instagram',
    segment: 'alimentação',
    address: 'Rua das Flores, 10, Boa Viagem, Recife - PE',
    prototipo_url: 'https://proto.example/padaria',
    porteiro_nome: 'João',
  }, 'Francisco', now)
  assert.equal(onlyPorteiro.nome, 'João')
  const onlyResponsavel = buildGuiaConversaVars({
    company_name: 'Padaria Central',
    responsible_name: 'Ana',
    gatilho: 'vi o Instagram',
    segment: 'alimentação',
    address: 'Rua das Flores, 10, Boa Viagem, Recife - PE',
    prototipo_url: 'https://proto.example/padaria',
  }, 'Francisco', now)
  assert.equal(onlyResponsavel.nome, 'Ana')
  const filled = interpolateGuiaConversa('Oi {{empresa}} {{#se gatilho}}porque {{gatilho}}{{/se}} às {{horario_1}}', vars)
  assert.equal(filled.includes('Padaria Central'), true)
  assert.equal(filled.includes('porque vi o Instagram'), true)
  assert.equal(filled.includes('10h'), true)
  const withPorteiro = interpolateGuiaConversa(guiaConversaSays.ramoA, vars)
  assert.match(withPorteiro, /obrigado, João/)
  const withoutPorteiro = interpolateGuiaConversa(guiaConversaSays.ramoA, { ...vars, porteiro_nome: '—' })
  assert.equal(withoutPorteiro.includes('obrigado.'), true)
  assert.equal(withoutPorteiro.includes('João'), false)
  const t4 = interpolateGuiaConversa(guiaConversaSays.cadenciaT4, vars)
  assert.match(t4, /^Carla, vou pausar pra não atrapalhar a rotina de vocês/)
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
  const hits = searchGuiaConversaNodes('pode mandar')
  assert.equal(hits.some((item) => item.id === 'reacao-a'), true)
  const siteHits = searchGuiaConversaNodes('já temos site')
  assert.equal(siteHits.some((item) => item.id === 'reacao-d'), true)
  const panel = readFileSync(join(root, 'src/features/guide/GuideWhatsAppPanel.tsx'), 'utf8')
  assert.match(panel, /<details className="guide-principles">/)
  assert.match(panel, /Princípios do estilo de venda/)
  assert.match(panel, /guiaConversaFazer/)
  assert.match(panel, /guiaConversaEvitar/)
  assert.match(panel, /guiaConversaFunil/)
  assert.match(panel, /anexe o print do protótipo/)
  assert.match(panel, /next_action/)
  assert.match(panel, /next_action_due_date/)
  assert.match(panel, /motivo_perda/)
  assert.equal(panel.includes('proxima_acao'), false)
})
