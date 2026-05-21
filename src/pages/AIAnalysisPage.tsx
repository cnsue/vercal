import { useMemo, useState, type CSSProperties } from 'react'
import MarkdownText from '../components/MarkdownText'
import { StorageService } from '../store/storage'
import { findAIProviderPreset, type AIAnalysisAction, type AIAnalysisRecord, type AIAnalysisRequest, type AIAnalysisTokens } from '../types/ai'
import { v4 as uuidv4 } from '../utils/uuid'

type ActiveTab = 'analysis' | 'tokens'

interface Props {
  request: AIAnalysisRequest
  onAction: (action: AIAnalysisAction) => void
}

interface ActionItem {
  key: string
  title: string
  detail: string
  button: string
  action: AIAnalysisAction
  tone?: 'warning' | 'danger' | 'info'
}

const SYSTEM_PROMPT = [
  '你是 Coinsight 内置的全能资产与股息分析助手，帮用户构建面向「伪财富自由 + 养老」的现金流组合。',
  '判断与建议要同时兼顾四个目标，并显式说明每条建议是为哪个目标服务的：',
  '- 未来股息现金流：年化、可持续性、复合增长、税后口径',
  '- 股价增长潜力：研报目标价空间、未来 3 年盈利增速、行业景气度',
  '- 组合回撤与防御性：单标 / 行业集中度、估值安全边际、利率与经济周期敏感度',
  '- 退休覆盖：与体面标准的差距、targetShares 缺口、被动收入结构（股息/养老金/其他）的稳定性',
  '',
  '数据原则：所有输入都来自用户本地记录、应用内置库或确定性数据接口。',
  '- 不要编造分红、价格、研报、ETF 分派、收益率或任何来源',
  '- 数据缺失、过旧、来源不清或口径冲突时，必须明确写「需要补充/核验」',
  '- 不构成买卖指令、不构成投资建议；用建议口吻而非命令口吻',
  '',
  '风格：中文、简洁、可执行。',
  '- 优先点出风险与失衡（单一标的或行业过度集中、收益率与基本面背离、研报与历史增长不一致等）',
  '- 引用具体数字（金额、占比、年数、参考价、股息率），让用户能直接对照检查',
  '- 给可操作的再平衡方向（哪类该补、哪类可减、哪些 targetShares 优先填），不指明具体买卖时机',
].join('\n')

export default function AIAnalysisPage({ request, onAction }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')
  const [history, setHistory] = useState<AIAnalysisRecord[]>(() => StorageService.getAIAnalysisHistory())
  const [lastTokens, setLastTokens] = useState<AIAnalysisTokens | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('analysis')
  const contextPreview = useMemo(() => summarizeContext(request.context), [request.context])
  const actionItems = useMemo(() => buildActionItems(request.context, result), [request.context, result])

  async function run() {
    const settings = StorageService.getAISettings()
    if (!settings.apiKey || !settings.model || !settings.baseUrl) {
      setError('请先到「设置 → AI 设置」填写 API Key、Model 和 Base URL。')
      setResult('')
      return
    }
    setLoading(true)
    setError('')
    setSavedId('')
    setLastTokens(null)
    try {
      const preset = findAIProviderPreset(settings.provider)
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          title: request.title,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: buildUserPrompt(request.title, request.scope),
          context: request.context,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `${preset.label} 分析失败`)
      setResult(String(data.text ?? '').trim())
      const tokens = normalizeUsage(data.usage)
      if (tokens) setLastTokens(tokens)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResult('')
    } finally {
      setLoading(false)
    }
  }

  function saveResult() {
    if (!result.trim()) return
    const settings = StorageService.getAISettings()
    const preset = findAIProviderPreset(settings.provider)
    const record: AIAnalysisRecord = {
      id: uuidv4(),
      title: request.title,
      scope: request.scope,
      provider: settings.provider,
      providerLabel: preset.label,
      model: settings.model,
      createdAt: new Date().toISOString(),
      result: result.trim(),
      ...(lastTokens ? { tokens: lastTokens } : {}),
    }
    const next = [record, ...history].slice(0, 50)
    StorageService.saveAIAnalysisHistory(next)
    setHistory(next)
    setSavedId(record.id)
  }

  function deleteRecord(id: string) {
    const next = history.filter(r => r.id !== id)
    StorageService.saveAIAnalysisHistory(next)
    setHistory(next)
    if (savedId === id) setSavedId('')
  }

  const tokenStats = useMemo(() => computeTokenStats(history), [history])

  return (
    <div style={{ paddingBottom: 20 }}>
      <section style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
          独立分析页
        </div>
        <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--text-strong)', marginBottom: 8 }}>
          {request.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          {request.scope}
        </div>
      </section>

      <div style={{
        display: 'flex', gap: 8, marginBottom: 12,
        background: 'var(--surface-muted)', borderRadius: 12, padding: 4,
      }}>
        <TabButton label="分析" active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
        <TabButton
          label={`Token 消耗${tokenStats.total > 0 ? ` · ${formatTokens(tokenStats.total)}` : ''}`}
          active={activeTab === 'tokens'}
          onClick={() => setActiveTab('tokens')}
        />
      </div>

      {activeTab === 'tokens' ? (
        <TokensView lastTokens={lastTokens} stats={tokenStats} />
      ) : (
        <AnalysisView
          contextPreview={contextPreview}
          loading={loading}
          result={result}
          error={error}
          savedId={savedId}
          actionItems={actionItems}
          history={history}
          onRun={run}
          onSave={saveResult}
          onDelete={deleteRecord}
          onAction={onAction}
        />
      )}
    </div>
  )
}

interface AnalysisViewProps {
  contextPreview: string
  loading: boolean
  result: string
  error: string
  savedId: string
  actionItems: ActionItem[]
  history: AIAnalysisRecord[]
  onRun: () => void
  onSave: () => void
  onDelete: (id: string) => void
  onAction: (action: AIAnalysisAction) => void
}

function AnalysisView({
  contextPreview, loading, result, error, savedId, actionItems, history,
  onRun, onSave, onDelete, onAction,
}: AnalysisViewProps) {
  return (
    <>
      <section style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>本次数据摘要</div>
        <pre style={previewStyle}>{contextPreview}</pre>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={run} disabled={loading} style={{
            ...btnStyle,
            flex: 2,
            background: loading ? 'var(--button-secondary-bg)' : 'var(--primary)',
            color: loading ? 'var(--muted)' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '分析中...' : result ? '重新分析' : '开始分析'}
          </button>
          <button type="button" onClick={saveResult} disabled={!result.trim()} style={{
            ...btnStyle,
            flex: 1,
            background: result.trim() ? 'var(--button-secondary-bg)' : 'var(--surface-muted)',
            color: result.trim() ? 'var(--button-secondary-text)' : 'var(--muted)',
            cursor: result.trim() ? 'pointer' : 'not-allowed',
          }}>
            保存结果
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
          分析结果只在你点击保存后进入本机历史；不会上传到同步数据。
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{error}</div>}
        {savedId && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--primary-strong)' }}>已保存到本机历史</div>}
        {actionItems.length > 0 && (
          <div style={actionBoxStyle}>
            <div style={{ fontSize: 13, fontWeight: 850, marginBottom: 8, color: 'var(--text-strong)' }}>
              待处理事项
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
              这些是当前数据和分析文本里能直接处理的项，点击后会回到对应配置入口。
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {actionItems.map(item => (
                <div key={item.key} style={actionItemStyle(item.tone)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-strong)' }}>{item.title}</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>{item.detail}</div>
                  </div>
                  <button type="button" onClick={() => onAction(item.action)} style={smallActionBtn}>
                    {item.button}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {result && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 12,
            background: 'var(--surface-muted)',
          }}>
            <MarkdownText content={result} />
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>历史分析</div>
        {history.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
            暂无保存记录
          </div>
        ) : history.map(record => (
          <details key={record.id} style={{
            background: 'var(--surface-muted)', borderRadius: 12, padding: 10, marginBottom: 8,
          }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>{record.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(record.createdAt).toLocaleString()} · {record.providerLabel} · {record.model}
                  </div>
                </div>
                <button type="button" onClick={e => { e.preventDefault(); deleteRecord(record.id) }} style={{
                  border: 'none', background: 'transparent', color: 'var(--danger)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}>
                  删除
                </button>
              </div>
            </summary>
            <div style={{
              marginTop: 10,
            }}>
              <MarkdownText content={record.result} compact />
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}

function buildUserPrompt(title: string, scope: string): string {
  return [
    `请按"伪财富自由 + 养老"的目标分析「${title}」。`,
    `分析范围：${scope}`,
    '',
    '请围绕以下维度展开，仅在数据足够支撑结论时才写，不要凑数：',
    '1. 关键结论：3 条以内，写组合健康度、与体面标准的差距、最值得立刻处理的事',
    '2. 集中度与平衡：',
    '   - 单一标的占比（>30% 提示，>50% 强提示），点名风险敞口与建议上限',
    '   - 行业/类别集中度（银行 / 能源 / 基建 / 消费 / 通信 / 红利ETF / 宽基ETF 等），指出过度集中或缺位的板块',
    '   - 给出具体的再平衡方向（哪类该补、哪类可减、可考虑的互补品种类型）',
    '3. 现金流与股息可持续性：',
    '   - 当前年化股息（税前/税后）、加权股息率',
    '   - 单标股息可持续性（基本面、研报盈利预期、披露完整度、行业周期）',
    '   - 退休口径下的股息推算（结合 yearsToRetire / scenario 数据，若有）',
    '4. 股价增长与回撤防御：',
    '   - 研报目标价空间、未来 3 年盈利增速是否支撑分红',
    '   - 估值/股息率背离、利率/政策/周期敏感度',
    '   - 哪些品种回撤更可控、哪些需要更谨慎',
    '5. 目标缺口与可执行动作：',
    '   - targetShares vs shares 的差距及其填补优先级（按现金流贡献 + 集中度风险综合排序）',
    '   - 如有现金可用，建议先补什么、为什么',
    '6. 数据完整性：缺失、过旧、来源不清或需要人工确认的字段',
    '',
    '输出要求：',
    '- 中文，简洁、可执行；引用具体数字让用户能直接对照',
    '- 使用 Markdown，允许三级标题、列表、加粗、行内代码',
    '- 不构成买卖指令，用建议口吻',
    '- 数据不足以回答某维度时直接写"数据不足"并指出还需要什么',
  ].join('\n')
}

function summarizeContext(context: unknown): string {
  try {
    const json = JSON.stringify(context, null, 2)
    return json.length > 3000 ? `${json.slice(0, 3000)}\n...` : json
  } catch {
    return '无法预览本次上下文'
  }
}

function buildActionItems(context: unknown, result: string): ActionItem[] {
  const ctx = normalizeDividendContext(context)
  const items = new Map<string, ActionItem>()
  const add = (item: ActionItem) => {
    if (!items.has(item.key)) items.set(item.key, item)
  }

  if (ctx.targetGaps.some(g => g.value > 0)) {
    const totalGap = ctx.targetGaps.reduce((sum, item) => sum + Math.max(0, item.value), 0)
    const top = [...ctx.targetGaps].sort((a, b) => b.value - a.value)[0]
    add({
      key: 'target-gaps',
      title: '目标资金缺口需要确认',
      detail: `${top?.name ?? '部分标的'}仍有目标资金缺口，合计约 ¥${Math.round(totalGap).toLocaleString()}。可在目标试算里调整目标数量或清除不再需要的目标。`,
      button: '打开目标试算',
      action: { kind: 'retirement', focus: 'target-simulator' },
      tone: 'warning',
    })
  }

  const totalGross = ctx.totals.grossAnnual || ctx.holdings.reduce((sum, h) => sum + Math.max(0, h.grossAnnual), 0)
  ctx.holdings.forEach(holding => {
    if (holding.targetShares !== undefined && holding.targetShares > 0 && holding.shares <= 0) {
      add({
        key: `zero-target-${holding.code}`,
        title: `${holding.name} 是零持仓目标`,
        detail: `当前持仓为 0，但目标为 ${holding.targetShares.toLocaleString()}。确认是否要启动这条目标，或在目标试算中清除。`,
        button: '打开目标试算',
        action: { kind: 'retirement', focus: 'target-simulator' },
        tone: 'warning',
      })
    }

    const weight = totalGross > 0 ? holding.grossAnnual / totalGross : 0
    if (weight >= 0.7) {
      add({
        key: `concentration-${holding.code}`,
        title: `${holding.name} 股息贡献过高`,
        detail: `当前税前年股息占比约 ${(weight * 100).toFixed(1)}%。这不是缺字段，但可以通过目标试算调整目标结构。`,
        button: '打开目标试算',
        action: { kind: 'retirement', focus: 'target-simulator' },
        tone: 'danger',
      })
    }

    const note = [holding.sourceNote, holding.disclosureNote].filter(Boolean).join('；')
    if (/估算|核验|确认|缺失|来源不清|尚待|预案|手填|用户确认/.test(note)) {
      add({
        key: `verify-note-${holding.code}`,
        title: `核验 ${holding.name} 的分红/分派口径`,
        detail: note || `AI 提到了 ${holding.name} 的数据口径需要确认，可回到股息持仓编辑每股股息或新增本地标的数据。`,
        button: '去股息持仓',
        action: { kind: 'retirement', focus: 'dividend-holdings' },
        tone: 'warning',
      })
    }
  })

  const lines = result.split('\n').map(line => line.replace(/^[-*+]\s*/, '').trim()).filter(Boolean)
  ctx.holdings.forEach(holding => {
    const line = lines.find(text =>
      (text.includes(holding.name) || text.includes(holding.code)) &&
      /估算|核验|确认|缺失|来源不清|口径|下调风险|暂无/.test(text)
    )
    if (line) {
      add({
        key: `ai-verify-${holding.code}`,
        title: `处理 AI 提到的 ${holding.name} 数据问题`,
        detail: line.replace(/[*_`#]/g, '').slice(0, 140),
        button: '去股息持仓',
        action: { kind: 'retirement', focus: 'dividend-holdings' },
        tone: 'warning',
      })
    }
  })

  if (/退休现金流|覆盖倍数|年度开销目标|体面目标|目标开支/.test(result)) {
    add({
      key: 'decent-standard',
      title: '退休覆盖口径需要补齐',
      detail: '如果要让 AI 判断覆盖倍数，需要先确认体面目标开销、养老金和其他被动收入等配置。',
      button: '编辑体面目标',
      action: { kind: 'retirement', focus: 'decent-standard' },
      tone: 'info',
    })
  }

  return Array.from(items.values()).slice(0, 6)
}

function normalizeDividendContext(context: unknown) {
  const record = isRecord(context) ? context : {}
  const holdings = Array.isArray(record.holdings)
    ? record.holdings.map(normalizeHolding).filter((h): h is HoldingContext => Boolean(h))
    : []
  const targetGaps = Array.isArray(record.targetGaps)
    ? record.targetGaps.map(normalizeTargetGap).filter((g): g is TargetGapContext => Boolean(g))
    : []
  const totalsRecord = isRecord(record.totals) ? record.totals : {}
  return {
    holdings,
    targetGaps,
    totals: {
      grossAnnual: toNumber(totalsRecord.grossAnnual),
      netAnnual: toNumber(totalsRecord.netAnnual),
    },
  }
}

interface HoldingContext {
  name: string
  code: string
  shares: number
  targetShares?: number
  grossAnnual: number
  sourceNote?: string
  disclosureNote?: string
}

interface TargetGapContext {
  name: string
  value: number
}

function normalizeHolding(raw: unknown): HoldingContext | null {
  if (!isRecord(raw)) return null
  const name = toStringValue(raw.name)
  const code = toStringValue(raw.code)
  if (!name || !code) return null
  const targetShares = raw.targetShares === undefined ? undefined : toNumber(raw.targetShares)
  return {
    name,
    code,
    shares: toNumber(raw.shares),
    targetShares,
    grossAnnual: toNumber(raw.grossAnnual),
    sourceNote: toStringValue(raw.sourceNote),
    disclosureNote: toStringValue(raw.disclosureNote),
  }
}

function normalizeTargetGap(raw: unknown): TargetGapContext | null {
  if (!isRecord(raw)) return null
  const name = toStringValue(raw.name)
  if (!name) return null
  return { name, value: toNumber(raw.value) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16, marginBottom: 12,
}

const previewStyle: CSSProperties = {
  margin: 0, maxHeight: 180, overflow: 'auto',
  background: 'var(--surface-muted)', borderRadius: 10, padding: 10,
  color: 'var(--muted)', fontSize: 11, lineHeight: 1.5,
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
}

const btnStyle: CSSProperties = {
  padding: '11px 10px', borderRadius: 10, border: 'none',
  fontSize: 14, fontWeight: 800,
}

const actionBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-muted)',
}

function actionItemStyle(tone: ActionItem['tone']): CSSProperties {
  const borderColor = tone === 'danger'
    ? 'var(--danger)'
    : tone === 'warning'
      ? 'var(--warning-text)'
      : 'var(--border)'
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${borderColor}`,
    background: 'var(--surface)',
  }
}

const smallActionBtn: CSSProperties = {
  border: 'none',
  borderRadius: 9,
  padding: '7px 9px',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  flexShrink: 0,
}
