// In-browser simulation. Nothing here talks to a server; every "operation" resolves on a timer.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { seed, emptyDB } from './fixtures'
import type { DB, Operation, OpResult, OpStep, Project, DeployType } from './model'

export type Scenario = 'normal' | 'empty' | 'error' | 'slow'

let db: DB = seed()
let scenario: Scenario = 'normal'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

export function useDB<T>(select: (d: DB) => T): T {
  return useSyncExternalStore(subscribe, () => select(db))
}
export const getDB = () => db
export function useScenario() { return useSyncExternalStore(subscribe, () => scenario) }
export function setScenario(s: Scenario) {
  scenario = s
  db = s === 'empty' ? emptyDB() : seed()
  emit()
}
export function resetData() { db = scenario === 'empty' ? emptyDB() : seed(); emit() }

function update(fn: (d: DB) => DB) { db = fn(db); emit() }

/** Simulated read: shows loading / error per scenario so every page exercises those states. */
export function useLoad(key: string): { status: 'loading' | 'error' | 'ready'; retry: () => void } {
  const sc = useScenario()
  const [state, setState] = useState<{ key: string; status: 'loading' | 'error' | 'ready'; n: number }>({ key, status: 'loading', n: 0 })
  useEffect(() => {
    setState((s) => ({ key, status: 'loading', n: s.n }))
    const t = setTimeout(() => setState((s) => ({ ...s, key, status: sc === 'error' ? 'error' : 'ready' })), sc === 'slow' ? 1600 : 120)
    return () => clearTimeout(t)
  }, [key, sc, state.n])
  return { status: state.key === key ? state.status : 'loading', retry: () => setState((s) => ({ ...s, n: s.n + 1 })) }
}

const now = () => new Date().toISOString()
let seq = 0x8a00
const opId = () => 'op-' + (seq++).toString(16)

interface RunOptions {
  kind: string; label: string; target: Operation['target']; steps: string[]
  outcome?: Exclude<OpResult, 'running'>; facts?: string; snapshot?: [string, string][]
  onSuccess?: (d: DB) => DB; durationMs?: number
}

/** Starts a simulated operation and returns its id immediately (like the real API's accepted request). */
export function runOperation(o: RunOptions): string {
  const id = opId()
  const steps: OpStep[] = o.steps.map((label, i) => ({ label, state: i === 0 ? 'running' : 'pending' }))
  update((d) => ({ ...d, operations: [{ id, kind: o.kind, label: o.label, target: o.target, startedAt: now(), result: 'running', facts: '正在执行…', steps, snapshot: o.snapshot }, ...d.operations] }))
  const outcome = o.outcome ?? 'success'
  setTimeout(() => {
    update((d) => {
      const ops = d.operations.map((op) => {
        if (op.id !== id) return op
        const failAt = outcome === 'success' ? -1 : Math.max(0, op.steps.length - 1)
        return {
          ...op, result: outcome, finishedAt: now(),
          facts: o.facts ?? (outcome === 'success' ? '全部步骤已完成并核验。' : outcome === 'failed' ? '最后一步失败，前面的步骤已完成。' : '连接中断，未收到最后一步的结果。'),
          steps: op.steps.map((s, i): OpStep => ({ ...s, state: failAt < 0 || i < failAt ? 'done' : i === failAt ? (outcome === 'failed' ? 'failed' : 'unknown') : 'pending' })),
        }
      })
      const next = { ...d, operations: ops }
      return outcome === 'success' && o.onSuccess ? o.onSuccess(next) : next
    })
  }, o.durationMs ?? 1400)
  return id
}

/** Simulated "核对原操作": re-reads the remote state for the same request identity. */
export function verifyOperation(id: string) {
  update((d) => ({ ...d, operations: d.operations.map((op) => op.id === id ? { ...op, result: 'running' as const, facts: '正在向服务器核对原操作…' } : op) }))
  setTimeout(() => update((d) => ({
    ...d,
    operations: d.operations.map((op) => op.id === id ? {
      ...op, result: 'success' as const, recovered: true, finishedAt: now(),
      facts: '核对完成：服务器上已写入服务单元并运行中，原操作按成功结束。',
      steps: op.steps.map((s) => ({ ...s, state: 'done' as const })),
    } : op),
    projects: d.projects.map((p) => p.id === op(d, id)?.target.id ? { ...p, runtime: { state: 'running', observedAt: now() }, configRevision: d.configurations.find((c) => c.id === p.configurationId)?.revision ?? p.configRevision } : p),
  })), 1600)
}
const op = (d: DB, id: string) => d.operations.find((o) => o.id === id)

export function lifecycle(p: Project, action: 'start' | 'stop' | 'restart') {
  const label = { start: '启动', stop: '停止', restart: '重启' }[action]
  const next: Project['runtime']['state'] = action === 'stop' ? 'stopped' : 'running'
  return runOperation({
    kind: action, label, target: { type: 'project', id: p.id, name: p.name }, steps: [label + '服务', '核验运行状态'],
    onSuccess: (d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, runtime: { state: next, observedAt: now() } } : x) }),
  })
}

export function deployProject(input: { type: DeployType; serverId: string; name: string; configurationId: string; outcome?: 'success' | 'failed' | 'unknown' }) {
  const d = getDB()
  const cfg = d.configurations.find((c) => c.id === input.configurationId)!
  const srv = d.servers.find((s) => s.id === input.serverId)!
  const pid = 'p-' + input.name
  return runOperation({
    kind: 'deploy', label: '部署', target: { type: 'project', id: pid, name: input.name }, outcome: input.outcome,
    steps: ['核对目标与快照', '上传文件', input.type === 'compose' ? '同步目录并拉起服务' : '写入服务单元', '启动并核验'],
    snapshot: [['配置', `${cfg.name} · 修订 ${cfg.revision}`], ['服务器', `${srv.user}@${srv.host}:${srv.port}`]],
    durationMs: 2200,
    onSuccess: (db) => ({
      ...db,
      projects: [...db.projects, {
        id: pid, name: input.name, type: input.type, serverId: input.serverId, configurationId: cfg.id, configRevision: cfg.revision, stage: 'deployed',
        runtime: { state: 'running', observedAt: now() }, monitor: { method: input.type === 'compose' ? 'Compose 服务状态' : 'systemd 状态', intervalMin: 5, enabled: true },
        dir: `/opt/stackpier/${input.name}`, unit: input.type === 'compose' ? undefined : `stackpier-${input.name}.service`, updatable: input.type === 'systemd', createdAt: now(),
      }],
    }),
  })
}

export function uninstallProject(p: Project) {
  update((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, stage: 'uninstalling' } : x) }))
  return runOperation({
    kind: 'uninstall', label: '完整卸载', target: { type: 'project', id: p.id, name: p.name }, steps: ['停止服务', '删除专属文件与目录', '移除服务单元'],
    onSuccess: (d) => ({ ...d, projects: d.projects.filter((x) => x.id !== p.id) }),
  })
}

export function mutate(fn: (d: DB) => DB) { update(fn) }

export function checkServer(id: string) {
  update((d) => ({ ...d, servers: d.servers.map((s) => s.id === id ? { ...s, observation: { ...s.observation, checkedAt: now() } } : s) }))
}
