import { useState } from 'react'
import { Button, Empty, Fact, Facts, Panel, Status } from '../ds'
import { PageHeader } from '../shell'
import { useDB } from '../data/store'
import { endpoint, href, serverText, serverTone, time } from '../lib'
import { LoadGate, OpStatus, Runtime } from './common'
import { DeployDialog } from './deploy'

export function Overview() {
  const db = useDB((d) => d)
  const [deploy, setDeploy] = useState(false)
  const unknown = db.operations.filter((o) => o.result === 'unknown')
  const failedProjects = db.projects.filter((p) => p.runtime.state === 'failed')
  const authFailed = db.servers.filter((s) => s.observation.state === 'auth_failed' || s.observation.state === 'unreachable')
  const drafts = db.projects.filter((p) => p.draft)
  const attention = [
    ...unknown.map((o) => ({ key: o.id, tone: 'warn' as const, tag: '结果未知', title: `${o.label} ${o.target.name} 结果未知`, body: '先核对原操作，不要直接重试。', link: `/operations/${o.id}`, action: '核对' })),
    ...failedProjects.map((p) => ({ key: p.id, tone: 'danger' as const, tag: '异常', title: `${p.name} 运行异常`, body: p.runtime.detail ?? '', link: `/projects/${p.id}`, action: '查看' })),
    ...authFailed.map((s) => ({ key: s.id, tone: 'danger' as const, tag: serverText[s.observation.state], title: `${s.name} ${serverText[s.observation.state]}`, body: s.observation.message ?? '', link: `/servers/${s.id}`, action: '处理' })),
  ]
  return (
    <div className="page">
      <PageHeader title="总览" sub="服务器、项目和需要你处理的事项。" actions={<Button variant="primary" icon="plus" onClick={() => setDeploy(true)}>部署项目</Button>} />
      <LoadGate id="overview">{() => (
        <>
          <Facts label="实例概况" cols={4}>
            <Fact href={href('/servers')} k="服务器" v={db.servers.length} large s={authFailed.length ? `${authFailed.length} 台连接异常` : '连接均正常'} />
            <Fact href={href('/projects')} k="项目" v={db.projects.length} large s={`${db.projects.filter((p) => p.runtime.state === 'running').length} 个运行中`} />
            <Fact href={href('/projects')} k="未应用的配置草稿" v={drafts.length} large s="需在项目中确认应用" />
            <Fact href={href('/operations')} k="结果未知的操作" v={unknown.length} large s={unknown.length ? '需核对' : '无'} />
          </Facts>
          <div className="split">
            <Panel title="需要处理" flush description={attention.length ? undefined : '目前没有'}>
              {attention.length ? (
                <ul className="ds-list">
                  {attention.map((a) => (
                    <li key={a.key}>
                      <div className="main"><a className="ds-cell-title" href={href(a.link)}>{a.title}</a><span className="ds-cell-sub">{a.body}</span></div>
                      <Status tone={a.tone}>{a.tag}</Status>
                      <Button size="sm" onClick={() => (location.hash = a.link)}>{a.action}</Button>
                    </li>
                  ))}
                </ul>
              ) : <Empty icon="check" title="一切正常">没有结果未知的操作、异常项目或连接失败的服务器。</Empty>}
            </Panel>
            <Panel title="最近操作" flush actions={<a href={href('/operations')}>全部</a>}>
              {db.operations.length ? (
                <ul className="ds-list">
                  {db.operations.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <div className="main"><a className="ds-cell-title" href={href(`/operations/${o.id}`)}>{o.label} · {o.target.name}</a><span className="ds-cell-sub">{time(o.startedAt)}</span></div>
                      <OpStatus r={o.result} />
                    </li>
                  ))}
                </ul>
              ) : <Empty title="还没有操作">部署、启停和网络变更都会记录在这里。</Empty>}
            </Panel>
          </div>
          <Panel title="服务器" flush actions={<a href={href('/servers')}>管理</a>}>
            {db.servers.length ? (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>服务器</th><th>连接</th><th>项目</th><th>系统</th></tr></thead>
                <tbody>{db.servers.map((s) => {
                  const ps = db.projects.filter((p) => p.serverId === s.id)
                  return (
                    <tr key={s.id}>
                      <td><a className="ds-cell-title" href={href(`/servers/${s.id}`)}>{s.name}</a><div className="ds-cell-sub mono">{endpoint(s)}</div></td>
                      <td><Status tone={serverTone[s.observation.state]}>{serverText[s.observation.state]}</Status><div className="ds-cell-sub">{time(s.observation.checkedAt)}</div></td>
                      <td>{ps.length ? <div className="stack" data-gap="sm" style={{ gap: 2 }}>{ps.map((p) => <span key={p.id} className="row" style={{ gap: 8 }}><a href={href(`/projects/${p.id}`)}>{p.name}</a><Runtime p={p} /></span>)}</div> : <span className="muted">—</span>}</td>
                      <td className="secondary">{s.observation.os ?? '—'} · {s.observation.arch ?? '—'}</td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
            ) : <Empty icon="server" title="还没有服务器" actions={<Button variant="primary" onClick={() => (location.hash = '/servers?add')}>接入服务器</Button>}>接入一台可通过 SSH 登录的服务器后才能部署项目。</Empty>}
          </Panel>
        </>
      )}</LoadGate>
      <DeployDialog open={deploy} onOpenChange={setDeploy} />
    </div>
  )
}
