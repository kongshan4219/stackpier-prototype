import { useMemo, useState } from 'react'
import { Badge, Button, Callout, ConfirmDialog, Empty, Field, Input, Menu, Panel, SearchInput, Segmented, Select, Textarea, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, mutate } from '../data/store'
import type { Configuration, DeployType, Mapping } from '../data/model'
import { go, href, time, typeText } from '../lib'
import { LoadGate } from './common'
import { DeployDialog } from './deploy'

export function Configurations() {
  const db = useDB((d) => d)
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const [deploy, setDeploy] = useState<Configuration | null>(null)
  const rows = db.configurations.filter((c) => (type === 'all' || c.type === type) && (!q || c.name.includes(q)))
  return (
    <div className="page">
      <PageHeader title="部署配置" sub="部署时选用的正文、变量与文件映射。保存会生成新修订，已部署的项目不会自动更新。"
        actions={<Menu label="新建配置" trigger={<Button variant="primary" icon="plus">新建配置</Button>} items={(['systemd', 'compose', 'frp'] as DeployType[]).map((t) => ({ label: `${typeText[t]} 配置`, onSelect: () => go(`/configurations/new?type=${t}`) }))} />} />
      <LoadGate id="configurations" skeleton>{() => (
        <>
          <div className="toolbar">
            <Segmented label="按类型筛选" value={type} onValueChange={setType} options={[{ value: 'all', label: '全部' }, { value: 'systemd', label: 'systemd' }, { value: 'compose', label: 'Compose' }, { value: 'frp', label: 'FRP' }]} />
            <SearchInput placeholder="搜索配置" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索配置" />
          </div>
          <Panel flush>
            {!db.configurations.length ? <Empty icon="config" title="还没有部署配置" actions={<Button variant="primary" onClick={() => go('/configurations/new?type=systemd')}>新建 systemd 配置</Button>}>部署前先保存一份配置：服务正文、变量与需要同步的文件。</Empty>
              : !rows.length ? <Empty icon="search" title="没有匹配的配置" /> : (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>配置</th><th>类型</th><th>修订</th><th>内容</th><th>使用中的项目</th><th data-align="end"><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{rows.map((c) => {
                  const ps = db.projects.filter((p) => p.configurationId === c.id)
                  return (
                    <tr key={c.id}>
                      <td><a className="ds-cell-title" href={href(`/configurations/${c.id}`)}>{c.name}</a><div className="ds-cell-sub">{time(c.updatedAt)} 保存</div></td>
                      <td><Badge mono>{typeText[c.type]}</Badge></td>
                      <td data-num>{c.revision}</td>
                      <td className="secondary">{summary(c)}</td>
                      <td>{ps.length ? ps.map((p) => <div key={p.id}><a href={href(`/projects/${p.id}`)}>{p.name}</a>{p.configRevision < c.revision && <span className="ds-cell-sub"> · 修订 {p.configRevision}</span>}</div>) : <span className="muted">—</span>}</td>
                      <td data-align="end"><Button size="sm" onClick={() => setDeploy(c)}>使用此配置部署</Button></td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
            )}
          </Panel>
        </>
      )}</LoadGate>
      <DeployDialog open={!!deploy} onOpenChange={() => setDeploy(null)} preset={deploy ? { type: deploy.type, configurationId: deploy.id } : undefined} />
    </div>
  )
}

const summary = (c: Configuration) =>
  c.systemd ? `服务正文 · ${c.systemd.mappings.length} 项映射` : c.compose ? `${(c.compose.yaml.match(/^ {2}\w[\w-]*:/gm) ?? []).length} 个服务 · ${c.compose.variables.length} 个变量 · ${c.compose.mappings.length} 项映射` : c.frp ? (c.frp.role === 'frps' ? `服务端 · 监听 ${c.frp.bindPort}` : `客户端 → ${c.frp.serverAddr}`) : ''

const blank = (type: DeployType): Configuration => ({
  id: 'new', name: '', type, revision: 0, updatedAt: '',
  systemd: type === 'systemd' ? { unit: '[Unit]\nDescription=\n\n[Service]\nExecStart=\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target', mappings: [] } : undefined,
  compose: type === 'compose' ? { yaml: 'services:\n', variables: [], mappings: [] } : undefined,
  frp: type === 'frp' ? { role: 'frps', programId: '', bindPort: 7000 } : undefined,
})

export function ConfigurationEditor({ id }: { id: string }) {
  const db = useDB((d) => d)
  const toast = useToast()
  const qType = (new URLSearchParams(location.hash.split('?')[1]).get('type') ?? 'systemd') as DeployType
  const original = useMemo(() => (id === 'new' ? blank(qType) : db.configurations.find((c) => c.id === id)), [id]) // eslint-disable-line
  const [c, setC] = useState<Configuration | undefined>(original)
  const [touched, setTouched] = useState(false)
  const [leave, setLeave] = useState(false)
  const [token, setToken] = useState('')
  if (!c || !original) return <div className="page"><Empty icon="config" title="配置不存在" actions={<Button onClick={() => go('/configurations')}>返回部署配置</Button>} /></div>
  const dirty = JSON.stringify(c) !== JSON.stringify(original) || !!token
  const users = db.projects.filter((p) => p.configurationId === c.id)
  const mappings = c.systemd?.mappings ?? c.compose?.mappings ?? []
  const err = {
    name: !c.name.trim() ? '填写配置名称。' : db.configurations.some((x) => x.name === c.name.trim() && x.id !== c.id) ? '已有同名配置。' : undefined,
    unit: c.systemd && !/^\[Service\][\s\S]*^ExecStart=\S+/m.test(c.systemd.unit) ? '正文需要 [Service] 段和非空的 ExecStart。' : undefined,
    yaml: c.compose && !/^services:\s*\n\s+\S/m.test(c.compose.yaml) ? '至少定义一个服务（services: 下的条目）。' : undefined,
    program: c.frp && !c.frp.programId ? '选择 FRP 程序。' : undefined,
    mappings: mappings.map((m) => (!m.remote.startsWith('/') && c.type === 'systemd' ? '远端路径需为绝对路径。' : !m.local ? '选择本地来源。' : undefined)),
  }
  const valid = !err.name && !err.unit && !err.yaml && !err.program && err.mappings.every((x) => !x)
  const setMappings = (ms: Mapping[]) => setC(c.systemd ? { ...c, systemd: { ...c.systemd, mappings: ms } } : c.compose ? { ...c, compose: { ...c.compose, mappings: ms } } : c)
  const save = () => {
    setTouched(true)
    if (!valid) return
    const saved = { ...c, name: c.name.trim(), id: c.id === 'new' ? 'cfg-' + Date.now() : c.id, revision: c.revision + 1, updatedAt: new Date().toISOString() }
    mutate((d) => ({ ...d, configurations: c.id === 'new' ? [...d.configurations, saved] : d.configurations.map((x) => (x.id === c.id ? saved : x)) }))
    toast({ title: `已保存为修订 ${saved.revision}`, body: users.length ? `${users.length} 个已部署项目不会自动更新。` : undefined, tone: 'ok' })
    go('/configurations')
  }
  return (
    <div className="page">
      <PageHeader title={c.id === 'new' ? `新建 ${typeText[c.type]} 配置` : c.name} badge={<Badge mono>{typeText[c.type]}</Badge>}
        sub={c.id === 'new' ? '保存后生成修订 1。' : `当前修订 ${c.revision} · ${time(c.updatedAt)} 保存`}
        actions={<>
          <Button onClick={() => (dirty ? setLeave(true) : go('/configurations'))}>取消</Button>
          <Button variant="primary" onClick={save} disabled={!dirty && c.id !== 'new'}>{c.id === 'new' ? '保存' : `保存为修订 ${c.revision + 1}`}</Button>
        </>} />
      {users.length > 0 && <Callout tone="info">{users.map((u) => u.name).join('、')} 使用此配置。保存不会更新它们{users.some((u) => u.updatable) ? '；支持受控更新的项目可在项目页应用新修订' : '；需要新配置时卸载后重新部署'}。</Callout>}
      {touched && !valid && <Callout tone="danger" title="有需要修改的字段" live>按下方标出的错误修改后再保存。</Callout>}
      <Panel title="基本信息">
        <Field label="配置名称" required error={touched ? err.name : undefined}><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="例如 服务标准配置" /></Field>
      </Panel>
      {c.systemd && (
        <Panel title="服务单元正文" description="按原样写入以服务名称命名的 .service 文件；路径使用服务器上的实际位置。">
          <Field label="正文" error={touched ? err.unit : undefined}><Textarea mono rows={14} value={c.systemd.unit} onChange={(e) => setC({ ...c, systemd: { ...c.systemd!, unit: e.target.value } })} /></Field>
        </Panel>
      )}
      {c.compose && (
        <>
          <Panel title="Compose 正文">
            <Field label="compose.yaml" error={touched ? err.yaml : undefined}><Textarea mono rows={14} value={c.compose.yaml} onChange={(e) => setC({ ...c, compose: { ...c.compose!, yaml: e.target.value } })} /></Field>
          </Panel>
          <Panel title="变量" description="写入同目录 .env；标为保密的值保存后不回显。" actions={<Button size="sm" icon="plus" onClick={() => setC({ ...c, compose: { ...c.compose!, variables: [...c.compose!.variables, { key: '', value: '' }] } })}>添加变量</Button>}>
            {c.compose.variables.length ? <div className="stack" data-gap="sm">{c.compose.variables.map((v, i) => (
              <div key={i} className="row" data-nowrap>
                <Input mono aria-label={`变量 ${i + 1} 名称`} value={v.key} placeholder="NAME" onChange={(e) => { const vs = [...c.compose!.variables]; vs[i] = { ...v, key: e.target.value }; setC({ ...c, compose: { ...c.compose!, variables: vs } }) }} />
                <Input mono aria-label={`变量 ${i + 1} 值`} type={v.secret ? 'password' : 'text'} value={v.value} placeholder={v.secret ? '留空则保留已保存的值' : '值'} onChange={(e) => { const vs = [...c.compose!.variables]; vs[i] = { ...v, value: e.target.value }; setC({ ...c, compose: { ...c.compose!, variables: vs } }) }} />
                <Button variant="ghost" icon="trash" label={`删除变量 ${v.key || i + 1}`} onClick={() => setC({ ...c, compose: { ...c.compose!, variables: c.compose!.variables.filter((_, j) => j !== i) } })} />
              </div>
            ))}</div> : <p className="muted">没有变量。</p>}
          </Panel>
        </>
      )}
      {(c.systemd || c.compose) && (
        <Panel title="文件与目录映射" description={c.type === 'compose' ? '目录完全同步：远端多余文件会被删除。' : '文件版本固定在部署快照中。'}
          actions={<Button size="sm" icon="plus" onClick={() => setMappings([...mappings, { local: '', remote: c.type === 'compose' ? '' : '/opt/stackpier/', kind: 'file' }])}>添加映射</Button>}>
          {mappings.length ? <div className="stack">{mappings.map((m, i) => (
            <div key={i} className="ds-panel" style={{ padding: 12 }}>
              <div className="row" data-justify="between" style={{ marginBottom: 8 }}><span className="ds-section-label" style={{ margin: 0 }}>映射 {i + 1}</span><Button variant="ghost" size="sm" icon="trash" label={`删除映射 ${i + 1}`} onClick={() => setMappings(mappings.filter((_, j) => j !== i))} /></div>
              <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
                <Field label="本地来源" error={touched && err.mappings[i]?.startsWith('选择') ? err.mappings[i] : undefined}>
                  <Select value={m.local} onValueChange={(v) => { const ms = [...mappings]; ms[i] = { ...m, local: v }; setMappings(ms) }} placeholder="选择文件版本"
                    options={[...db.files.flatMap((f) => f.versions.map((v) => ({ value: `files/${f.name}@${v.revision}`, label: `${f.name} · 修订 ${v.revision}`, hint: f.kind === 'program' ? `程序 ${v.arch ?? ''}` : '配置文件' }))), ...(m.local && !m.local.startsWith('files/') ? [{ value: m.local, label: m.local, hint: '本机目录' }] : [])]} />
                </Field>
                <Field label="远端路径" error={touched && err.mappings[i]?.startsWith('远端') ? err.mappings[i] : undefined}>
                  <Input mono value={m.remote} onChange={(e) => { const ms = [...mappings]; ms[i] = { ...m, remote: e.target.value }; setMappings(ms) }} />
                </Field>
              </div>
            </div>
          ))}</div> : <Empty icon="file" title="没有映射">程序与配置文件通过映射上传到服务器。</Empty>}
        </Panel>
      )}
      {c.frp && (
        <Panel title="FRP 角色">
          <div className="stack">
            <Field label="角色"><Segmented label="角色" value={c.frp.role} onValueChange={(v) => setC({ ...c, frp: { ...c.frp!, role: v as 'frps' | 'frpc' } })} options={[{ value: 'frps', label: '服务端 frps' }, { value: 'frpc', label: '客户端 frpc' }]} /></Field>
            <Field label="程序" required error={touched ? err.program : undefined}>
              <Select value={c.frp.programId} onValueChange={(v) => setC({ ...c, frp: { ...c.frp!, programId: v } })} placeholder="选择程序文件" options={db.files.filter((f) => f.kind === 'program').map((f) => ({ value: f.id, label: f.name, hint: `${f.versions[0].arch} · ${f.versions[0].note ?? ''}` }))} />
            </Field>
            {c.frp.role === 'frps'
              ? <Field label="监听端口"><Input mono inputMode="numeric" value={String(c.frp.bindPort ?? '')} onChange={(e) => setC({ ...c, frp: { ...c.frp!, bindPort: +e.target.value || undefined } })} /></Field>
              : <Field label="服务端地址"><Input mono value={c.frp.serverAddr ?? ''} onChange={(e) => setC({ ...c, frp: { ...c.frp!, serverAddr: e.target.value } })} placeholder="203.0.113.90:7000" /></Field>}
            <Field label="认证 Token" hint="留空保留已保存的 Token；离开此页即清空输入，不进入草稿。"><Input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="new-password" /></Field>
            <p className="ds-hint">连接与 TCP / STCP 映射在 <a href={href('/frp')}>FRP 页面</a>管理。</p>
          </div>
        </Panel>
      )}
      <ConfirmDialog open={leave} onOpenChange={setLeave} title="放弃未保存的修改？" confirmLabel="放弃修改" variant="danger" onConfirm={() => go('/configurations')}>
        <p>已保存的修订 {c.revision || '—'} 不受影响。</p>
      </ConfirmDialog>
    </div>
  )
}
