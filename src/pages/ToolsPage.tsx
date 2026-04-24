import { useState } from 'react'
import MortgagePrepaymentPage from './MortgagePrepaymentPage'

type Subpage = 'prepayment' | null

const BUILTIN_TOOLS: { title: string; desc: string; subpage: Exclude<Subpage, null> }[] = [
  {
    title: '房贷提前还款计算器',
    desc: '对商贷做一次性提前还款，对比"缩短年限"和"减少月供"，看能省多少利息、缩多少时间。支持等额本息与等额本金。',
    subpage: 'prepayment',
  },
]

const EXTERNAL_TOOLS = [
  {
    title: '退休待遇与养老缺口测算',
    desc: '按社保养老金口径估算退休待遇，把退休支出目标、其他收入和养老储备拆开看。',
    href: '/retirement-gap-calculator',
  },
  {
    title: '银行股养老全收益计算器',
    desc: '按股息再投入策略模拟招行、农行、长江电力的30年养老收益。',
    href: '/pension-calc-v5',
  },
  {
    title: '多城灵活就业养老金测算',
    desc: '比较上海、杭州、北京、广州、深圳的灵活就业社保缴费与退休待遇。',
    href: '/flex-pension-city-compare',
  },
]

export default function ToolsPage() {
  const [subpage, setSubpage] = useState<Subpage>(null)

  if (subpage === 'prepayment') {
    return <MortgagePrepaymentPage onBack={() => setSubpage(null)} />
  }

  return (
    <div style={{ paddingTop: 12, paddingBottom: 16 }}>
      <SectionTitle>内置计算器</SectionTitle>
      {BUILTIN_TOOLS.map(tool => (
        <button key={tool.subpage} onClick={() => setSubpage(tool.subpage)}
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

      <SectionTitle>外部工具</SectionTitle>
      {EXTERNAL_TOOLS.map(tool => (
        <a key={tool.href} href={tool.href}
          style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, marginBottom: 12, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{tool.title}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{tool.desc}</div>
          <div style={{ marginTop: 12, color: 'var(--primary-strong)', fontWeight: 600, fontSize: 13 }}>打开 ›</div>
        </a>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '4px 4px 8px', letterSpacing: '0.02em' }}>
      {children}
    </div>
  )
}
