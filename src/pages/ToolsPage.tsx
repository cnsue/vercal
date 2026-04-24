import type { Subpage } from '../App'

interface Props {
  onNavigate: (subpage: Subpage) => void
}

const TOOLS: { title: string; desc: string; subpage: Exclude<Subpage, null> }[] = [
  {
    title: '房贷提前还款计算器',
    desc: '对商贷做一次性提前还款，对比"缩短年限"和"减少月供"，看能省多少利息、缩多少时间。支持等额本息与等额本金。',
    subpage: { kind: 'mortgage-prepayment' },
  },
  {
    title: '退休待遇与养老缺口测算',
    desc: '按社保养老金口径估算退休待遇，把退休支出目标、其他收入和养老储备拆开看。',
    subpage: { kind: 'external-tool', title: '退休待遇与养老缺口', url: '/retirement-gap-calculator' },
  },
  {
    title: '银行股养老全收益计算器',
    desc: '按股息再投入策略模拟招行、农行、长江电力的 30 年养老收益。',
    subpage: { kind: 'external-tool', title: '银行股养老全收益', url: '/pension-calc-v5' },
  },
  {
    title: '多城灵活就业养老金测算',
    desc: '比较上海、杭州、北京、广州、深圳的灵活就业社保缴费与退休待遇。',
    subpage: { kind: 'external-tool', title: '多城灵活就业养老金', url: '/flex-pension-city-compare' },
  },
]

export default function ToolsPage({ onNavigate }: Props) {
  return (
    <div style={{ paddingTop: 12, paddingBottom: 16 }}>
      {TOOLS.map(tool => (
        <button key={tool.title} onClick={() => onNavigate(tool.subpage)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 18, marginBottom: 12, color: 'inherit', cursor: 'pointer',
          }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{tool.title}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{tool.desc}</div>
          <div style={{ marginTop: 12, color: 'var(--primary-strong)', fontWeight: 600, fontSize: 13 }}>打开 ›</div>
        </button>
      ))}
    </div>
  )
}
