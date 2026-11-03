import { useEffect, useState } from 'react'
import type { Tone } from './ds'
import type { OpResult, Project, Server, DeployType } from './data/model'

/* ---------- Hash router ---------- */
export function useRoute() {
  const read = () => (location.hash.replace(/^#/, '') || '/overview').split('?')[0]
  const [path, setPath] = useState(read)
  useEffect(() => {
    const on = () => setPath(read())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return path
}
export const go = (path: string) => { location.hash = path }
export const href = (path: string) => '#' + path

/* ---------- Formatting ---------- */
const fmt = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' })
export const time = (iso?: string) => (iso ? fmt.format(new Date(iso)).replace(/\//g, '-') : '—')
export function size(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`
  return `${(n / 1024 / 1024).toFixed(1)} MiB`
}
export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`
export const endpoint = (s: Server) => `${s.user}@${s.host}:${s.port}`

/* ---------- Domain → status vocabulary (one place) ---------- */
export const opTone: Record<OpResult, Tone> = { running: 'progress', success: 'ok', failed: 'danger', unknown: 'warn' }
export const opText: Record<OpResult, string> = { running: '进行中', success: '成功', failed: '失败', unknown: '结果未知' }
export const runtimeTone: Record<Project['runtime']['state'], Tone> = { running: 'ok', stopped: 'neutral', failed: 'danger', unobserved: 'unknown' }
export const runtimeText: Record<Project['runtime']['state'], string> = { running: '运行中', stopped: '已停止', failed: '异常', unobserved: '未观测' }
export const serverTone: Record<Server['observation']['state'], Tone> = { ok: 'ok', auth_failed: 'danger', unreachable: 'danger', unchecked: 'unknown' }
export const serverText: Record<Server['observation']['state'], string> = { ok: '连接正常', auth_failed: '认证失败', unreachable: '无法连接', unchecked: '未检查' }
export const typeText: Record<DeployType, string> = { systemd: 'systemd', compose: 'Compose', frp: 'FRP' }
