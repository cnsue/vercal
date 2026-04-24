interface Props {
  url: string
}

/**
 * 将外部工具页作为 iframe 内嵌到应用 shell 内，保持底部导航与标题栏一致。
 * 假设目标路径与本应用同源（或服务端已允许被 iframe 嵌入）。
 */
export default function ExternalToolPage({ url }: Props) {
  return (
    <iframe
      src={url}
      title="内嵌工具"
      style={{
        width: '100%', height: '100%',
        border: 'none', display: 'block', background: 'var(--bg)',
      }}
    />
  )
}
