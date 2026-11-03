import { useMemo, useState } from 'react'
import { Badge, Button, ButtonGroup, Callout, Code, ConfirmDialog, Consequences, Dialog, Diff, Empty, Fact, Facts, Field, Input, KeyValue, Menu, Panel, SearchInput, SectionLabel, Select, Status, Switch, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, lifecycle, uninstallProject, runOperation, mutate } from '../data/store'
import type { Project } from '../data/model'
import { endpoint, go, href, time, typeText } from '../lib'
import { LoadGate, OpStatus, Runtime } from './common'
import { DeployDialog } from './deploy'

export function Projects({ tab }: { tab: 'list' | 'failed' }) {
  const db = useDB((d) => d)
  const [q, setQ] = useState('')
  const [server, setServer] = useState('all')
  const [state, setState] = useState('all')
  const [deploy, setDeploy] = useState(false)
  const rows = db.projects.filter((p) => (server === 'all' || p.serverId === server) && (state === 'all' || p.runtime.state === state) && (!q || (p.name + (db.servers.find((s) => s.id === p.serverId)?.name ?? '')).toLowerCase().includes(q.toLowerCase())))
  const failed = db.operations.filter((o) => o.kind === 'deploy' && o.result === 'failed')
  return (
    <div className="page">
      <PageHeader title="项目" sub="已部署到服务器上的服务。" actions={<Button variant="primary" icon="plus" onClick={() => setDeploy(true)}>部署项目</Button>} />
      <nav className="ds-tabs-list" aria-label="项目视图">
        <a className="ds-tab" href={href('/projects')} aria-current={tab === 'list' ? 'page' : undefined}>项目</a>
        <a className="ds-tab" href={href('/projects/failed')} aria-current={tab === 'failed' ? 'page' : undefined}>部署失败记录{failed.length ? <Badge tone="danger">{failed.length}</Badge> : null}</a>
      </nav>
      <LoadGate id={'projects-' + tab} skeleton>{() => tab === 'failed' ? (
        <Panel flush>
          {failed.length ? (
            <ul className="ds-list">{failed.map((o) => (
              <li key={o.id}><div className="main"><a className="ds-cell-title" href={href(`/operations/${o.id}`)}>{o.target.name}</a><span className="ds-cell-sub">{time(o.startedAt)} · {o.facts}</span></div>{o.cleaned ? <Status tone="ok">已清理</Status> : o.residue ? <Status tone="warn">有残留</Status> : null}<Button size="sm" onClick={() => go(`/operations/${o.id}`)}>{o.cleaned ? '查看' : '查看与清理'}</Button></li>
            ))}</ul>
          ) : <Empty icon="check" title="没有部署失败记录">部署失败时不会创建项目，失败记录和残留清理入口会出现在这里。</Empty>}
        </Panel>
      ) : (
        <>
          {db.projects.length > 0 && (
            <div className="toolbar" role="search">
              <SearchInput placeholder="搜索项目或服务器" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索项目" />
              <Select aria-label="按服务器筛选" value={server} onValueChange={setServer} options={[{ value: 'all', label: '全部服务器' }, ...db.servers.map((s) => ({ value: s.id, label: s.name }))]} />
              <Select aria-label="按运行状态筛选" value={state} onValueChange={setState} options={[{ value: 'all', label: '全部状态' }, { value: 'running', label: '运行中' }, { value: 'failed', label: '异常' }, { value: 'stopped', label: '已停止' }, { value: 'unobserved', label: '未观测' }]} />
            </div>
          )}
          <Panel flush footer={db.projects.length ? `共 ${rows.length} / ${db.projects.length} 个项目` : undefined}>
            {!db.projects.length ? (
              <Empty icon="project" title="还没有项目" actions={<Button variant="primary" onClick={() => setDeploy(true)}>部署项目</Button>}>选择服务器和部署配置，确认预览后即可部署第一个项目。</Empty>
            ) : !rows.length ? (
              <Empty icon="search" title="没有匹配的项目" actions={<Button onClick={() => { setQ(''); setServer('all'); setState('all') }}>清除筛选</Button>} />
            ) : (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>项目</th><th>服务器</th><th>运行状态</th><th>配置</th><th>待处理</th></tr></thead>
                <tbody>{rows.map((p) => {
                  const s = db.servers.find((x) => x.id === p.serverId)!
                  const c = db.configurations.find((x) => x.id === p.configurationId)
                  const unknown = db.operations.find((o) => o.target.id === p.id && o.result === 'unknown')
                  return (
                    <tr key={p.id}>
                      <td><a className="ds-cell-title" href={href(`/projects/${p.id}`)}>{p.name}</a><div className="ds-cell-sub">{typeText[p.type]}</div></td>
                      <td>{s.name}<div className="ds-cell-sub mono">{s.host}</div></td>
                      <td><Runtime p={p} /><div className="ds-cell-sub">{p.runtime.detail ?? time(p.runtime.observedAt)}</div></td>
                      <td>{c?.name ?? '—'}<div className="ds-cell-sub">已应用修订 {p.configRevision}{c && c.revision > p.configRevision ? ` · 最新 ${c.revision}` : ''}</div></td>
                      <td>{unknown ? <Status tone="warn">结果未知</Status> : p.draft ? <Badge>草稿未应用</Badge> : <span className="muted">—</span>}</td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
            )}
          </Panel>
        </>
      )}</LoadGate>
      <DeployDialog open={deploy} onOpenChange={setDeploy} />
    </div>
  )
}

const tabs = [['overview', '概览'], ['config', '配置'], ['monitoring', '巡检'], ['logs', '日志'], ['operations', '操作记录'], ['files', '文件核对']] as const
type Tab = (typeof tabs)[number][0]

export function ProjectDetail({ id, tab = 'overview' }: { id: string; tab?: string }) {
  const db = useDB((d) => d)
  const p = db.projects.find((x) => x.id === id)
  const toast = useToast()
  const [confirm, setConfirm] = useState<null | 'stop' | 'restart' | 'uninstall' | 'update'>(null)
  if (!p) return (
    <div className="page"><Empty icon="project" title="项目不存在" actions={<Button onClick={() => go('/projects')}>返回项目列表</Button>}>它可能已被卸载。卸载记录保留在操作记录中。</Empty></div>
  )
  const srv = db.servers.find((s) => s.id === p.serverId)!
  const cfg = db.configurations.find((c) => c.id === p.configurationId)
  const ops = db.operations.filter((o) => o.target.id === p.id)
  const unknown = ops.find((o) => o.result === 'unknown')
  const busy = ops.find((o) => o.result === 'running')
  const t = (tabs.find(([k]) => k === tab)?.[0] ?? 'overview') as Tab
  const act = (a: 'start' | 'stop' | 'restart') => { lifecycle(p, a); setConfirm(null); toast({ title: `已提交${{ start: '启动', stop: '停止', restart: '重启' }[a]}`, body: '结果会显示在操作记录中。', tone: 'info' }) }
  const blocked = !!busy || !!unknown || p.stage === 'uninstalling'

  return (
    <div className="page">
      <PageHeader title={p.name} badge={<Badge mono>{typeText[p.type]}</Badge>}
        sub={<><a href={href(`/servers/${srv.id}`)}>{srv.name}</a><span className="mono">{endpoint(srv)}</span></>}
        actions={<>
          <ButtonGroup label="服务操作">
            <Button icon="play" disabled={blocked || p.runtime.state === 'running'} onClick={() => act('start')}>启动</Button>
            <Button icon="stop" disabled={blocked || p.runtime.state === 'stopped'} onClick={() => setConfirm('stop')}>停止</Button>
            <Button icon="restart" disabled={blocked} onClick={() => setConfirm('restart')}>重启</Button>
          </ButtonGroup>
          {p.updatable && <Button variant="primary" icon="update" disabled={blocked} onClick={() => setConfirm('update')}>受控更新</Button>}
          <Menu label="更多操作" items={[
            { label: '核对受管文件', icon: 'search', onSelect: () => go(`/projects/${p.id}/files`), disabled: blocked },
            { label: '完整卸载…', icon: 'trash', tone: 'danger', separatorBefore: true, onSelect: () => setConfirm('uninstall'), disabled: blocked },
          ]} />
        </>} />

      {unknown && (
        <Callout tone="warn" title={`${unknown.label}结果未知`} live actions={<Button onClick={() => go(`/operations/${unknown.id}`)}>核对原操作</Button>}>
          {time(unknown.startedAt)} · {unknown.facts} 核对前，启停、更新和卸载暂不可用。
        </Callout>
      )}
      {busy && <Callout tone="info" title={`${busy.label}进行中`} live>完成后状态会自动更新。</Callout>}
      {p.stage === 'uninstalling' && <Callout tone="info" title="正在卸载" live>完成后项目会从列表中移除。</Callout>}

      <Facts label="项目状态摘要">
        <Fact k="实际运行" v={<Runtime p={p} />} s={p.runtime.detail ?? (p.runtime.observedAt ? `观测于 ${time(p.runtime.observedAt)}` : '巡检未开启')} />
        <Fact k="部署" v="已部署" s={time(p.createdAt) + ' 创建'} />
        <Fact k="配置" v={`修订 ${p.configRevision}`} s={cfg ? (cfg.revision > p.configRevision ? `${cfg.name} · 最新为修订 ${cfg.revision}` : cfg.name) : '—'} />
        <Fact k="巡检" v={p.monitor.enabled ? p.monitor.method : '未开启'} s={p.monitor.enabled ? `每 ${p.monitor.intervalMin} 分钟` : '不会发送异常通知'} />
        <Fact k="最近操作" wide v={ops[0] ? <OpStatus r={ops[0].result} /> : '—'} s={ops[0] ? `${ops[0].label} · ${time(ops[0].startedAt)}` : undefined} />
      </Facts>

      <nav className="ds-tabs-list" aria-label="项目详情分类">
        {tabs.map(([k, label]) => (
          <a key={k} className="ds-tab" href={href(`/projects/${p.id}${k === 'overview' ? '' : '/' + k}`)} aria-current={t === k ? 'page' : undefined}>
            {label}{k === 'operations' && unknown ? <span className="ds-count" aria-label="1 项结果未知">1</span> : null}{k === 'config' && p.draft ? <Badge>草稿</Badge> : null}
          </a>
        ))}
      </nav>

      <LoadGate id={`project-${p.id}-${t}`} skeleton>{() => (
        <>
          {t === 'overview' && <OverviewTab p={p} />}
          {t === 'config' && <ConfigTab p={p} onUpdate={() => setConfirm('update')} />}
          {t === 'monitoring' && <MonitoringTab p={p} />}
          {t === 'logs' && <LogsTab p={p} />}
          {t === 'operations' && <OpsTab p={p} />}
          {t === 'files' && <FilesTab p={p} blocked={blocked} />}
        </>
      )}</LoadGate>

      <ConfirmDialog open={confirm === 'stop'} onOpenChange={() => setConfirm(null)} title={`停止 ${p.name}？`} confirmLabel="停止服务" variant="danger" onConfirm={() => act('stop')}>
        <Consequences items={[{ text: '服务停止后不再对外提供访问。', tone: 'warn' }, { text: p.monitor.enabled ? '巡检会记录为已停止，不发送异常通知。' : '巡检未开启。' }]} />
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'restart'} onOpenChange={() => setConfirm(null)} title={`重启 ${p.name}？`} confirmLabel="重启服务" onConfirm={() => act('restart')}>
        <Consequences items={[{ text: '服务会短暂中断，重启后核验运行状态。', tone: 'warn' }]} />
      </ConfirmDialog>
      <UninstallDialog p={p} open={confirm === 'uninstall'} onOpenChange={() => setConfirm(null)} />
      <UpdateDialog p={p} open={confirm === 'update'} onOpenChange={() => setConfirm(null)} />
    </div>
  )
}

function OverviewTab({ p }: { p: Project }) {
  const db = useDB((d) => d)
  const srv = db.servers.find((s) => s.id === p.serverId)!
  const cfg = db.configurations.find((c) => c.id === p.configurationId)
  const ops = db.operations.filter((o) => o.target.id === p.id).slice(0, 4)
  return (
    <div className="split">
      <div className="stack">
        <Panel title="部署信息" actions={<Button variant="ghost" size="sm" onClick={() => go(`/projects/${p.id}/config`)}>查看配置</Button>}>
          <KeyValue items={[
            ['运行方式', p.type === 'compose' ? 'Docker Compose' : p.type === 'frp' ? 'FRP（systemd 常驻）' : 'systemd 常驻服务'],
            ['部署配置', cfg ? <a href={href(`/configurations/${cfg.id}`)}>{cfg.name}</a> : '—'],
            ['连接目标', endpoint(srv), { mono: true }],
            ['管理目录', p.dir, { mono: true }],
            ...(p.unit ? [['服务单元', p.unit, { mono: true }] as [string, string, { mono: boolean }]] : []),
            ['卸载范围', '专属文件与目录完整清理；公共和共享资源保留'],
          ]} />
        </Panel>
        {p.services && (
          <Panel title="服务" flush>
            <ul className="ds-list">{p.services.map((s) => <li key={s.name}><div className="main mono">{s.name}</div><Status tone={s.state === 'running' ? 'ok' : 'danger'}>{s.state === 'running' ? '运行中' : '已退出'}</Status></li>)}</ul>
          </Panel>
        )}
        <Panel title="最近日志" actions={<Button variant="ghost" size="sm" onClick={() => go(`/projects/${p.id}/logs`)}>全部日志</Button>}>
          <Code label="最近日志">{logLines(p).slice(-3).join('\n')}</Code>
        </Panel>
      </div>
      <Panel title="操作记录" flush actions={<Button variant="ghost" size="sm" onClick={() => go(`/projects/${p.id}/operations`)}>全部</Button>}>
        {ops.length ? <ul className="ds-list">{ops.map((o) => (
          <li key={o.id}><div className="main"><a className="ds-cell-title" href={href(`/operations/${o.id}`)}>{o.label}</a><span className="ds-cell-sub">{time(o.startedAt)} · {o.facts}</span></div><OpStatus r={o.result} /></li>
        ))}</ul> : <Empty title="还没有操作" />}
      </Panel>
    </div>
  )
}

function ConfigTab({ p, onUpdate }: { p: Project; onUpdate: () => void }) {
  const db = useDB((d) => d)
  const cfg = db.configurations.find((c) => c.id === p.configurationId)
  const toast = useToast()
  const [discard, setDiscard] = useState(false)
  if (!cfg) return <Empty title="部署配置已删除">项目继续使用部署时的固定快照。</Empty>
  const behind = cfg.revision > p.configRevision
  return (
    <div className="stack">
      {p.draft && (
        <Panel title="未应用的草稿" description={`${time(p.draft.changedAt)} 保存`} actions={<>
          <Button size="sm" onClick={() => setDiscard(true)}>丢弃草稿</Button>
          {p.updatable && <Button size="sm" variant="primary" onClick={onUpdate}>通过受控更新应用</Button>}
        </>}>
          <p>{p.draft.summary}。草稿只保存在管理端，服务器上仍是修订 {p.configRevision}。</p>
        </Panel>
      )}
      <Panel title={`已应用：${cfg.name} · 修订 ${p.configRevision}`} description={behind ? `部署配置已保存到修订 ${cfg.revision}；已有项目不会自动更新。` : '与部署配置最新修订一致。'}
        actions={<Button variant="ghost" size="sm" icon="external" onClick={() => go(`/configurations/${cfg.id}`)}>打开部署配置</Button>}>
        {behind && (
          <div className="stack" data-gap="sm" style={{ marginBottom: 16 }}>
            <SectionLabel>修订 {p.configRevision} → {cfg.revision}</SectionLabel>
            <Diff label="配置差异" lines={[{ sign: ' ', text: '[Service]' }, { sign: '-', text: 'ExecStart=/opt/stackpier/sample-agent/bin/sample-agent' }, { sign: '+', text: 'ExecStart=/opt/stackpier/sample-agent/bin/sample-agent --config /opt/stackpier/sample-agent/etc/sample-config.json' }, { sign: ' ', text: 'Restart=on-failure' }]} />
            {!p.updatable && <p className="ds-hint">此项目类型不支持受控更新。需要新配置时，卸载后重新部署。</p>}
          </div>
        )}
        {cfg.systemd && <Code label="服务单元正文">{cfg.systemd.unit}</Code>}
        {cfg.compose && <Code label="Compose 正文">{cfg.compose.yaml}</Code>}
        {cfg.frp && <KeyValue items={[['角色', cfg.frp.role === 'frps' ? '服务端 frps' : '客户端 frpc'], ['连接与映射', <a href={href('/frp')}>在 FRP 页面管理</a>]]} />}
      </Panel>
      <ConfirmDialog open={discard} onOpenChange={setDiscard} title="丢弃草稿？" confirmLabel="丢弃" variant="danger"
        onConfirm={() => { mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, draft: undefined } : x) })); setDiscard(false); toast({ title: '草稿已丢弃', tone: 'ok' }) }}>
        <p>服务器上的服务不受影响。丢弃后无法恢复这份草稿。</p>
      </ConfirmDialog>
    </div>
  )
}

function MonitoringTab({ p }: { p: Project }) {
  const events = useDB((d) => d.events.filter((e) => e.projectId === p.id))
  return (
    <div className="split">
      <Panel title="巡检设置">
        <div className="stack">
          <div className="row" data-justify="between"><span>定时巡检</span><Switch label="定时巡检" checked={p.monitor.enabled} onCheckedChange={(v) => mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, monitor: { ...x.monitor, enabled: v } } : x) }))} /></div>
          <KeyValue items={[['方式', p.monitor.method], ['周期', `每 ${p.monitor.intervalMin} 分钟`], ['通知', <a href={href('/monitoring')}>在巡检与通知中设置渠道</a>]]} />
        </div>
      </Panel>
      <Panel title="异常与恢复" flush>
        {events.length ? <ul className="ds-list">{events.map((e) => (
          <li key={e.id}><div className="main"><span className="ds-cell-title">{e.detail}</span><span className="ds-cell-sub">{time(e.at)} · {e.delivered ? '已通知' : '未通知'}</span></div><Status tone={e.kind === 'abnormal' ? 'danger' : 'ok'}>{e.kind === 'abnormal' ? '异常' : '恢复'}</Status></li>
        ))}</ul> : <Empty icon="monitor" title="没有异常记录" />}
      </Panel>
    </div>
  )
}

const logLines = (p: Project) => p.type === 'compose'
  ? ['10:24:02 web-1  | start worker process 31', '10:24:05 api-1  | connecting to database…', '10:24:06 api-1  | error: DATABASE_URL is empty', '10:24:06 api-1 exited with code 1']
  : [`10:29:58 systemd[1]: Starting ${p.unit}…`, `10:30:00 systemd[1]: Started ${p.unit}.`, `10:30:01 ${p.name}[2148]: config loaded`, `10:30:02 ${p.name}[2148]: listening on 0.0.0.0:18080`, `10:30:02 ${p.name}[2148]: token=[已脱敏]`]

function LogsTab({ p }: { p: Project }) {
  const [lines, setLines] = useState('200')
  return (
    <Panel title="日志" description="限量读取最近的输出；密钥类字段已脱敏。" actions={<>
      <Select aria-label="读取行数" value={lines} onValueChange={setLines} options={[{ value: '100', label: '最近 100 行' }, { value: '200', label: '最近 200 行' }, { value: '500', label: '最近 500 行' }]} />
      <Button icon="refresh" label="重新读取" />
    </>}>
      <Code label={`${p.name} 日志`}>{logLines(p).join('\n')}</Code>
    </Panel>
  )
}

function OpsTab({ p }: { p: Project }) {
  const ops = useDB((d) => d.operations.filter((o) => o.target.id === p.id))
  return (
    <Panel flush>
      {ops.length ? <div className="ds-table-wrap"><table className="ds-table">
        <thead><tr><th>操作</th><th>开始</th><th>结果</th><th>已知事实</th></tr></thead>
        <tbody>{ops.map((o) => <tr key={o.id}><td><a className="ds-cell-title" href={href(`/operations/${o.id}`)}>{o.label}</a><div className="ds-cell-sub mono">{o.id}</div></td><td className="nowrap">{time(o.startedAt)}</td><td><OpStatus r={o.result} /></td><td className="secondary">{o.facts}</td></tr>)}</tbody>
      </table></div> : <Empty title="还没有操作" />}
    </Panel>
  )
}

function FilesTab({ p, blocked }: { p: Project; blocked: boolean }) {
  const toast = useToast()
  const check = p.fileCheck ?? { state: 'unchecked' as const }
  const run = () => {
    runOperation({ kind: 'file-check', label: '文件核对', target: { type: 'project', id: p.id, name: p.name }, steps: ['读取远端摘要', '与部署快照比对'],
      onSuccess: (d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, fileCheck: { state: 'match', checkedAt: new Date().toISOString() } } : x) }) })
    toast({ title: '已开始核对', body: '只读取摘要，不修改服务器上的文件。', tone: 'info' })
  }
  return (
    <Panel title="受管文件核对" description="比对服务器上的程序、配置与服务单元是否仍与部署快照一致。只读，不修改文件。"
      actions={<Button icon="search" onClick={run} disabled={blocked}>开始核对</Button>}>
      <div className="stack">
        <div className="row"><Status tone={check.state === 'match' ? 'ok' : check.state === 'drift' ? 'warn' : 'unknown'}>{check.state === 'match' ? '一致' : check.state === 'drift' ? '有差异' : '未核对'}</Status>{check.checkedAt && <span className="muted">{time(check.checkedAt)}</span>}</div>
        <KeyValue items={(p.type === 'compose' ? [['compose.yaml', `${p.dir}/compose.yaml`]] : [['程序', `${p.dir}/bin/${p.name}`], ['配置', `${p.dir}/etc/`], ['服务单元', `/etc/systemd/system/${p.unit}`]]).map(([k, v]) => [k, v, { mono: true }] as [string, string, { mono: boolean }])} />
      </div>
    </Panel>
  )
}

function UninstallDialog({ p, open, onOpenChange }: { p: Project; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const toast = useToast()
  return (
    <Dialog open={open} onOpenChange={(v) => { setTyped(''); onOpenChange(v) }} size="sm" title={`完整卸载 ${p.name}？`} description="此操作不可撤销。"
      footer={<>
        <Button onClick={() => onOpenChange(false)}>取消</Button>
        <Button variant="danger-solid" disabled={typed !== p.name} onClick={() => { uninstallProject(p); onOpenChange(false); toast({ title: '已开始卸载', tone: 'info' }); go('/projects') }}>永久卸载</Button>
      </>}>
      <section><SectionLabel>将永久删除</SectionLabel>
        {p.type === 'compose'
          ? <Consequences items={[{ text: '停止并移除本项目的全部容器。', tone: 'danger' }, { text: '经核实归属本项目的命名卷数据与独占文件，无法恢复。', tone: 'danger' }, { text: <>项目目录 <span className="mono">{p.dir}</span></>, tone: 'danger' }]} />
          : <Consequences items={[{ text: <>服务{p.unit ? <> <span className="mono">{p.unit}</span></> : ''} 及其运行进程</>, tone: 'danger' }, { text: <>专属目录 <span className="mono">{p.dir}</span></>, tone: 'danger' }]} />}
      </section>
      <section><SectionLabel>保留</SectionLabel>
        <Consequences items={[{ text: '部署配置、文件版本与操作记录' }, { text: p.type === 'compose' ? '归属不明或被其他项目使用的卷与文件——存在时会阻止清理' : '与其他项目共享的资源（如 FRP 服务端）' }]} />
      </section>
      <Field label={<>输入项目名称 <span className="mono">{p.name}</span> 以确认</>}>
        <Input mono value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
    </Dialog>
  )
}

function UpdateDialog({ p, open, onOpenChange }: { p: Project; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDB((d) => d)
  const prog = db.files.find((f) => f.id === 'f-agent')!
  const [rev, setRev] = useState(String(prog.versions[0].revision))
  const toast = useToast()
  const current = useMemo(() => 2, [])
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`受控更新 ${p.name}`} description="替换程序版本，失败时按原快照恢复。"
      note="预览已固定所选版本" footer={<>
        <Button onClick={() => onOpenChange(false)}>取消</Button>
        <Button variant="primary" disabled={rev === String(current)} onClick={() => {
          runOperation({ kind: 'update', label: '受控更新', target: { type: 'project', id: p.id, name: p.name }, steps: ['核对远端文件与快照一致', '上传新版本', '替换并重启', '核验运行状态'], durationMs: 2000,
            onSuccess: (d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, draft: undefined, configRevision: d.configurations.find((c) => c.id === x.configurationId)!.revision } : x) }) })
          onOpenChange(false); toast({ title: '已提交受控更新', body: '进度见操作记录。', tone: 'info' })
        }}>确认更新</Button>
      </>}>
      <Field label="程序版本" hint="仅支持固定程序模式的 systemd 项目。">
        <Select value={rev} onValueChange={setRev} options={prog.versions.map((v) => ({ value: String(v.revision), label: `修订 ${v.revision}${v.revision === current ? '（当前）' : ''}`, hint: `${v.note ?? ''} ${time(v.createdAt)}` }))} />
      </Field>
      <section><SectionLabel>确认后</SectionLabel>
        <Consequences items={[
          { text: '先核对服务器上的受管文件仍与部署快照一致；不一致则停止，不覆盖。' },
          { text: '替换程序后重启服务，服务会短暂中断。', tone: 'warn' },
          { text: '核验失败时恢复原程序并重启。' },
        ]} />
      </section>
    </Dialog>
  )
}

