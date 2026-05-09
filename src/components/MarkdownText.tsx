import type { CSSProperties, ReactNode } from 'react'

interface Props {
  content: string
  compact?: boolean
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' }

export default function MarkdownText({ content, compact = false }: Props) {
  const blocks = parseBlocks(content)
  return (
    <div style={compact ? compactRootStyle : rootStyle}>
      {blocks.map((block, index) => renderBlock(block, index, compact))}
    </div>
  )
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let paragraph: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []

  function flushParagraph() {
    if (paragraph.length === 0) return
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
    paragraph = []
  }

  function flushList() {
    if (!listType || listItems.length === 0) return
    blocks.push({ type: listType, items: listItems })
    listType = null
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'hr' })
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }

    const unordered = /^[-*+]\s+(.+)$/.exec(line)
    if (unordered) {
      flushParagraph()
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(unordered[1])
      continue
    }

    const ordered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (ordered) {
      flushParagraph()
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(ordered[1])
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks
}

function renderBlock(block: Block, index: number, compact: boolean): ReactNode {
  if (block.type === 'heading') {
    const level = Math.min(Math.max(block.level, 1), 6)
    const size = compact ? compactHeadingSizes[level] : headingSizes[level]
    return (
      <div key={index} style={{ ...headingStyle, fontSize: size, marginTop: index === 0 ? 0 : compact ? 12 : 16 }}>
        {renderInline(block.text)}
      </div>
    )
  }
  if (block.type === 'paragraph') {
    return <p key={index} style={compact ? compactParagraphStyle : paragraphStyle}>{renderInline(block.text)}</p>
  }
  if (block.type === 'ul') {
    return (
      <ul key={index} style={compact ? compactListStyle : listStyle}>
        {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
      </ul>
    )
  }
  if (block.type === 'ol') {
    return (
      <ol key={index} style={compact ? compactListStyle : listStyle}>
        {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
      </ol>
    )
  }
  return <div key={index} style={hrStyle} />
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    const token = match[0]
    const key = `${match.index}-${token}`
    if (token.startsWith('`')) {
      nodes.push(<code key={key} style={codeStyle}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    cursor = match.index + token.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

const rootStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.75,
  wordBreak: 'break-word',
}

const compactRootStyle: CSSProperties = {
  ...rootStyle,
  fontSize: 12,
  lineHeight: 1.65,
}

const headingStyle: CSSProperties = {
  marginBottom: 8,
  color: 'var(--text-strong)',
  fontWeight: 850,
  lineHeight: 1.35,
}

const headingSizes: Record<number, number> = {
  1: 18,
  2: 17,
  3: 16,
  4: 15,
  5: 14,
  6: 13,
}

const compactHeadingSizes: Record<number, number> = {
  1: 15,
  2: 14,
  3: 13,
  4: 13,
  5: 12,
  6: 12,
}

const paragraphStyle: CSSProperties = {
  margin: '0 0 10px',
}

const compactParagraphStyle: CSSProperties = {
  margin: '0 0 8px',
}

const listStyle: CSSProperties = {
  margin: '0 0 12px',
  paddingLeft: 20,
}

const compactListStyle: CSSProperties = {
  margin: '0 0 10px',
  paddingLeft: 18,
}

const codeStyle: CSSProperties = {
  padding: '1px 5px',
  borderRadius: 5,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.92em',
}

const hrStyle: CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '14px 0',
}
