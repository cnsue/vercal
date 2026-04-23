const TOOLS = [
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
  return (
    <div style={{ paddingTop: 12, paddingBottom: 16 }}>
      {TOOLS.map(tool => (
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
