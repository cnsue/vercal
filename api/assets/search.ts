import type { VercelRequest, VercelResponse } from '@vercel/node'
import { collectObjects, EASTMONEY_TOKEN, inferAssetType, inferExchange, normalizeCode, SOURCE_PROVIDER, toCandidate } from './_shared.js'

const SEARCH_LIMIT = 12

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q.length < 1 || q.length > 40) return res.status(400).json({ error: 'Invalid query' })

  const url = new URL('https://searchapi.eastmoney.com/api/suggest/get')
  url.searchParams.set('input', q)
  url.searchParams.set('type', '14')
  url.searchParams.set('token', EASTMONEY_TOKEN)
  url.searchParams.set('count', String(SEARCH_LIMIT))

  const candidates = new Map<string, ReturnType<typeof toCandidate> extends infer T ? NonNullable<T> : never>()

  try {
    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'Coinsight/1.0 asset resolver',
      },
    })
    if (upstream.ok) {
      const data = await upstream.json() as unknown
      for (const obj of collectObjects(data)) {
        const candidate = toCandidate(obj)
        if (candidate) candidates.set(`${candidate.assetType}-${candidate.exchange}-${candidate.code}`, candidate)
        if (candidates.size >= SEARCH_LIMIT) break
      }
    }
  } catch {
    // Keep deterministic fallback below for code queries.
  }

  if (candidates.size === 0 && /^\d{1,6}$/.test(q)) {
    const code = normalizeCode(q)
    const name = code
    const assetType = inferAssetType(code, name)
    candidates.set(`${assetType}-${inferExchange(code)}-${code}`, {
      code,
      name,
      assetType,
      exchange: inferExchange(code),
      sourceProvider: SOURCE_PROVIDER,
    })
  }

  return res.status(200).json({ candidates: Array.from(candidates.values()).slice(0, SEARCH_LIMIT) })
}
