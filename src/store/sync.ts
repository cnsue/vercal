/**
 * 设备配对同步：用一段随机 pairCode 作为「账号」，所有设备共享同一码即同步同一份数据。
 * - 启用同步：本机生成 pairCode，立即把当前 localStorage 推到 Redis
 * - 配对设备：粘贴 pairCode，从 Redis 拉数据，覆盖本地后 reload
 * - 启动时自动拉一次（远端 updatedAt 比本地新才覆盖）
 * - 任何 mutation 后 debounce 推一次
 */

const PAIR_CODE_KEY = 'asset-tracker:pairCode'
const LAST_SYNC_AT_KEY = 'asset-tracker:lastSyncAt'
const SYNC_VERSION = 1
const PUSH_DEBOUNCE_MS = 2500
const PAIR_CODE_REGEX = /^[a-z0-9]{16,40}$/

/** 参与同步的 localStorage key 白名单。push/exchangeRate/installBanner/同步元数据本身不进。
 *  AI 请求日志 (aiRequestLog) 为本机诊断数据，不进。 */
const SYNCED_KEYS: readonly string[] = [
  'asset-tracker:snapshots',
  'asset-tracker:annualTarget',
  'asset-tracker:platforms',
  'asset-tracker:classes',
  'asset-tracker:hiddenPlatforms',
  'asset-tracker:hiddenClasses',
  'asset-tracker:retirementPlan',
  'asset-tracker:mortgageInputs',
  'asset-tracker:themePreference',
  'asset-tracker:cashFlows',
  'asset-tracker:aiSettings',
  'asset-tracker:aiApiKeys',
  'asset-tracker:aiAnalysisHistory',
]

interface RemoteBlob {
  version: number
  updatedAt: string
  data: Record<string, string>
}

let applying = false
let pushTimer: ReturnType<typeof setTimeout> | null = null

export function getPairCode(): string | null {
  const v = localStorage.getItem(PAIR_CODE_KEY)
  return v && PAIR_CODE_REGEX.test(v) ? v : null
}

export function getLastSyncAt(): string | null {
  return localStorage.getItem(LAST_SYNC_AT_KEY)
}

export function isPaired(): boolean {
  return !!getPairCode()
}

export function generatePairCode(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 24)
}

export function clearPairing(): void {
  localStorage.removeItem(PAIR_CODE_KEY)
  localStorage.removeItem(LAST_SYNC_AT_KEY)
}

function snapshotLocal(): Record<string, string> {
  const data: Record<string, string> = {}
  for (const key of SYNCED_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw !== null) data[key] = raw
  }
  return data
}

function applyRemote(data: Record<string, string>): void {
  applying = true
  try {
    for (const key of SYNCED_KEYS) {
      if (key in data) localStorage.setItem(key, data[key])
      else localStorage.removeItem(key)
    }
  } finally {
    applying = false
  }
}

async function pullFromRemote(code: string): Promise<RemoteBlob | null> {
  const res = await fetch(`/api/sync/pull?code=${encodeURIComponent(code)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`同步拉取失败：${res.status}`)
  return await res.json()
}

async function pushToRemoteRaw(code: string): Promise<string> {
  const updatedAt = new Date().toISOString()
  const body = { code, version: SYNC_VERSION, updatedAt, data: snapshotLocal() }
  const res = await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`同步推送失败：${res.status} ${text}`)
  }
  localStorage.setItem(LAST_SYNC_AT_KEY, updatedAt)
  return updatedAt
}

/** 任何 mutation 后调用，debounce 触发推送。 */
export function markDirty(): void {
  if (applying) return
  const code = getPairCode()
  if (!code) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushToRemoteRaw(code).catch(err => console.warn('auto push failed:', err))
  }, PUSH_DEBOUNCE_MS)
}

/** 在本机启用同步：生成码 + 立即推送当前数据。 */
export async function enableSyncOnThisDevice(): Promise<string> {
  const code = generatePairCode()
  localStorage.setItem(PAIR_CODE_KEY, code)
  try {
    await pushToRemoteRaw(code)
    return code
  } catch (err) {
    localStorage.removeItem(PAIR_CODE_KEY)
    throw err
  }
}

/** 配对到已有设备的码：拉远端数据覆盖本地。返回是否取到数据。 */
export async function pairWithCode(rawCode: string): Promise<boolean> {
  const code = rawCode.trim().toLowerCase()
  if (!PAIR_CODE_REGEX.test(code)) {
    throw new Error('配对码格式错误（应为 16–40 位字母数字）')
  }
  const remote = await pullFromRemote(code)
  if (!remote) {
    throw new Error('远端没有数据。先在另一台设备「启用同步」生成配对码再来')
  }
  localStorage.setItem(PAIR_CODE_KEY, code)
  localStorage.setItem(LAST_SYNC_AT_KEY, remote.updatedAt)
  applyRemote(remote.data)
  return true
}

/** 启动时静默拉一次；远端 updatedAt 比本地新就覆盖并 reload。 */
export async function autoPullOnLoad(): Promise<void> {
  const code = getPairCode()
  if (!code) return
  try {
    const remote = await pullFromRemote(code)
    if (!remote) return
    const localAt = getLastSyncAt() ?? ''
    if (remote.updatedAt > localAt) {
      applyRemote(remote.data)
      localStorage.setItem(LAST_SYNC_AT_KEY, remote.updatedAt)
      // 让 Zustand store 重新从 localStorage 读取
      window.location.reload()
    }
  } catch (err) {
    console.warn('auto pull failed:', err)
  }
}

/** 用户点「立即同步」：先推后拉，UI 用。 */
export async function manualSync(): Promise<{ pushedAt: string; remoteAt: string | null }> {
  const code = getPairCode()
  if (!code) throw new Error('未启用同步')
  const pushedAt = await pushToRemoteRaw(code)
  const remote = await pullFromRemote(code)
  return { pushedAt, remoteAt: remote?.updatedAt ?? null }
}
