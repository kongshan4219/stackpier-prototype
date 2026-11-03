import { useState } from 'react'
import { Button, Callout, Empty, KeyValue, Panel, SearchInput, Select, Status } from '../ds'
import { PageHeader } from '../shell'
import { useDB, verifyOperation } from '../data/store'
import { go, href, time } from '../lib'
import { LoadGate, OpStatus } from './common'

const kinds: Record<string, string> = { project: '项目', server: '服务器', frp: 'FRP', dns: 'DNS', firewall: '防火墙', monitoring: '巡检' }

export function Operations() {
  const ops = useDB((d) => d.operations)
  const [q, setQ] = useState('')
  const [result, setResult] = useState('all')
  const [kind, setKind] = useState('all')
  const rows = ops.filter((o) => (result === 'all' || o.result === result) && (kind === 'all' || o.target.type === kind) && (!q || (o.label + o.target.name + o.id).toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="page">
      <PageHeader title="操作记录" sub="每次操作完成了什么、哪里失败、哪些结果尚未确认。" />
      <LoadGate id="operations" skeleton>{() => (
        <>
          <div className="toolbar" role="search">
            <SearchInput placeholder="搜索操作、对象或编号" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索操作" />
            <Select aria-label="按结果筛选" value={result} onValueChange={setResult} options={[{ value: 'all', label: '全部结果' }, { value: 'unknown', label: '结果未知' }, { value: 'failed', label: '失败' }, { value: 'running', label: '进行中' }, { value: 'success', label: '成功' }]} />
            <Select aria-label="按对象筛选" value={kind} onValueChange={setKind} options={[{ value: 'all', label: '全部对象' }, ...Object.entries(kinds).map(([value, label]) => ({ value, label }))]} />
          </div>
          <Panel flush footer={ops.length ? `${rows.length} / ${ops.length} 条` : undefined}>
            {!ops.length ? <Empty icon="operations" title="还没有操作记录" /> : !rows.length ? <Empty icon="search" title="没有匹配的记录" /> : (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>操作</th><th>对象</th><th>开始</th><th>结果</th><th>已知事实</th></tr></thead>
                <tbody>{rows.map((o) => (
                  <tr key={o.id}>
                    <td><a className="ds-cell-title" href={href(`/operations/${o.id}`)}>{o.label}</a><div className="ds-cell-sub mono">{o.id}</div></td>
                    <td>{o.target.name}<div className="ds-cell-sub">{kinds[o.target.type]}</div></td>
                    <td className="nowrap">{time(o.startedAt)}</td>
                    <td><OpStatus r={o.result} />{o.recovered && <div className="ds-cell-sub">已核对</div>}</td>
                    <td className="secondary" style={{ minWidth: 220 }}>{o.facts}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Panel>
        </>
      )}</LoadGate>
    </div>
  )
}

const stepTone = { done: 'ok', failed: 'danger', unknown: 'warn', running: 'progress', pending: 'neutral', skipped: 'neutral' } as const
const stepText = { done: '完成', failed: '失败', unknown: '未知', running: '进行中', pending: '未执行', skipped: '跳过' }

export function OperationDetail({ id }: { id: string }) {
  const o = useDB((d) => d.operations.find((x) => x.id === id))
  if (!o) return <div className="page"><Empty icon="operations" title="操作不存在" actions={<Button onClick={() => go('/operations')}>返回操作记录</Button>} /></div>
  const targetHref = o.target.type === 'project' ? `/projects/${o.target.id}` : `/${o.target.type}`
  return (
    <div className="page">
      <PageHeader title={`${o.label} · ${o.target.name}`} badge={<OpStatus r={o.result} />} sub={<><span className="mono">{o.id}</span><span>{time(o.startedAt)} 开始{o.finishedAt ? ` · ${time(o.finishedAt)} 结束` : ''}</span></>}
        actions={<Button onClick={() => go(targetHref)}>打开{kinds[o.target.type]}</Button>} />
      {o.result === 'unknown' && (
        <Callout tone="warn" title="结果未知：先核对，不要重试" actions={<Button variant="primary" onClick={() => verifyOperation(o.id)}>核对原操作</Button>}>
          管理端没有收到最后一步的结果。核对会用同一请求身份向服务器读取实际状态，不会重复执行已完成的步骤。
        </Callout>
      )}
      {o.result === 'running' && <Callout tone="info" title="进行中" live>{o.facts}</Callout>}
      {o.result === 'failed' && <Callout tone="danger" title="失败">{o.facts} 已完成的步骤不会自动回滚；按下方步骤状态判断是否需要清理。</Callout>}
      {o.recovered && <Callout tone="ok" title="已核对">{o.facts}</Callout>}
      <div className="split">
        <Panel title="步骤" flush>
          <ol className="ds-list">{o.steps.map((s, i) => (
            <li key={i}><span className="muted mono" style={{ width: 18 }}>{i + 1}</span><div className="main">{s.label}</div><Status tone={stepTone[s.state]}>{stepText[s.state]}</Status></li>
          ))}</ol>
        </Panel>
        <div className="stack">
          <Panel title="已知事实"><p>{o.facts}</p></Panel>
          {o.snapshot && <Panel title="固定快照" description="执行与核对都使用这份内容，之后的配置修改不影响它。"><KeyValue items={o.snapshot.map(([k, v]) => [k, v, { mono: true }] as [string, string, { mono: boolean }])} /></Panel>}
        </div>
      </div>
    </div>
  )
}
