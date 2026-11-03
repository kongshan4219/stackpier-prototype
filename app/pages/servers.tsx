import { useEffect, useState } from 'react'
import { Badge, Button, Callout, Checkbox, Consequences, Dialog, Empty, Field, Input, KeyValue, Panel, SearchInput, SectionLabel, Select, Status, Textarea, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, checkServer, mutate } from '../data/store'
import { endpoint, go, href, serverText, serverTone, time } from '../lib'
import { LoadGate, Runtime } from './common'

/** Page-scoped polling: runs only while the servers page is open, like production. */
function usePolling() {
  const [last, setLast] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setLast(Date.now()), 30_000); return () => clearInterval(t) }, [])
  return last
}

export function Servers() {
  const db = useDB((d) => d)
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(location.hash.includes('?add'))
  usePolling()
  const rows = db.servers.filter((s) => !q || (s.name + s.host).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="page">
      <PageHeader title="服务器" sub="停留在此页时每 30 秒检查一次 SSH 连接；离开后停止。" actions={<Button variant="primary" icon="plus" onClick={() => setAdd(true)}>接入服务器</Button>} />
      <LoadGate id="servers" skeleton>{() => (
        <>
          {db.servers.length > 0 && <div className="toolbar" role="search"><SearchInput placeholder="搜索名称或地址" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索服务器" /></div>}
          <Panel flush>
            {!db.servers.length ? <Empty icon="server" title="还没有服务器" actions={<Button variant="primary" onClick={() => setAdd(true)}>接入服务器</Button>}>需要一台可通过 SSH 密钥或密码登录的 Linux 服务器。</Empty>
              : !rows.length ? <Empty icon="search" title="没有匹配的服务器" />
              : <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>服务器</th><th>连接</th><th>系统</th><th>凭据</th><th>项目</th><th data-align="end"><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{rows.map((s) => {
                  const cred = db.credentials.find((c) => c.id === s.credentialId)
                  return (
                    <tr key={s.id}>
                      <td><a className="ds-cell-title" href={href(`/servers/${s.id}`)}>{s.name}</a><div className="ds-cell-sub mono">{endpoint(s)}</div></td>
                      <td><Status tone={serverTone[s.observation.state]}>{serverText[s.observation.state]}</Status><div className="ds-cell-sub">{time(s.observation.checkedAt)}</div></td>
                      <td>{s.observation.os ?? '—'}<div className="ds-cell-sub">{s.observation.arch}</div></td>
                      <td>{cred?.name ?? '—'}<div className="ds-cell-sub">修订 {s.credentialRevision}{s.sudo ? ' · sudo' : ''}</div></td>
                      <td data-num>{db.projects.filter((p) => p.serverId === s.id).length}</td>
                      <td data-align="end"><Button size="sm" icon="refresh" label={`立即检查 ${s.name}`} onClick={() => checkServer(s.id)} /></td>
                    </tr>
                  )
                })}</tbody>
              </table></div>}
          </Panel>
        </>
      )}</LoadGate>
      <AddServerDialog open={add} onOpenChange={(v) => { setAdd(v); if (!v && location.hash.includes('?add')) history.replaceState(null, '', '#/servers') }} />
    </div>
  )
}

function AddServerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const creds = useDB((d) => d.credentials)
  const [step, setStep] = useState<'form' | 'trust'>('form')
  const [f, setF] = useState({ name: '', host: '', port: '22', user: '', cred: creds[0]?.id ?? 'new', key: '', sudo: false })
  const [touched, setTouched] = useState(false)
  const toast = useToast()
  useEffect(() => { if (open) { setStep('form'); setTouched(false) } }, [open])
  const err = {
    name: !f.name ? '填写名称。' : undefined,
    host: !f.host ? '填写地址。' : !/^[\w.-]+$/.test(f.host) ? '只填主机名或 IP，不含协议和端口。' : undefined,
    port: !/^\d+$/.test(f.port) || +f.port < 1 || +f.port > 65535 ? '端口为 1–65535。' : undefined,
    user: !f.user ? '填写登录用户。' : undefined,
    key: f.cred === 'new' && !f.key ? '粘贴私钥正文。' : undefined,
  }
  const ok = Object.values(err).every((x) => !x)
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="接入服务器" description={step === 'form' ? '连接后会读取系统信息与主机指纹。' : '确认这是你的服务器。'}
      footer={step === 'form' ? <>
        <Button onClick={() => onOpenChange(false)}>取消</Button>
        <Button variant="primary" onClick={() => { setTouched(true); if (ok) setStep('trust') }}>连接并读取指纹</Button>
      </> : <>
        <Button onClick={() => setStep('form')}>返回修改</Button>
        <Button variant="primary" onClick={() => {
          mutate((d) => ({ ...d, servers: [...d.servers, { id: 'srv-' + Date.now(), name: f.name, host: f.host, port: +f.port, user: f.user, fingerprint: 'SHA256:TmV3LWZpY3Rpb25hbC1ob3N0', credentialId: f.cred === 'new' ? 'cred-ops' : f.cred, credentialRevision: 1, sudo: f.sudo, observation: { state: 'ok', os: 'Debian 13', arch: 'x86_64', checkedAt: new Date().toISOString() } }] }))
          onOpenChange(false); toast({ title: `已接入 ${f.name}`, tone: 'ok' })
        }}>信任并保存</Button>
      </>}>
      {step === 'form' ? (
        <>
          <Field label="名称" required error={touched ? err.name : undefined}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例如 边缘节点" /></Field>
          <div className="split" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
            <Field label="地址" required error={touched ? err.host : undefined}><Input mono value={f.host} onChange={(e) => setF({ ...f, host: e.target.value.trim() })} placeholder="192.0.2.10" /></Field>
            <Field label="SSH 端口" required error={touched ? err.port : undefined}><Input mono inputMode="numeric" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} /></Field>
          </div>
          <Field label="登录用户" required error={touched ? err.user : undefined}><Input mono value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.trim() })} placeholder="deploy" autoComplete="off" /></Field>
          <Field label="SSH 凭据">
            <Select value={f.cred} onValueChange={(v) => setF({ ...f, cred: v })} options={[...creds.map((c) => ({ value: c.id, label: c.name, hint: `${c.kind === 'key' ? '私钥' : '密码'} · 修订 ${c.revision} · ${c.usedBy} 台使用` })), { value: 'new', label: '新建私钥凭据…' }]} />
          </Field>
          {f.cred === 'new' && <Field label="私钥正文" required error={touched ? err.key : undefined} hint="保存在管理端数据库，不会回显。"><Textarea mono rows={4} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" /></Field>}
          <Checkbox checked={f.sudo} onCheckedChange={(v) => setF({ ...f, sudo: v })}>此用户通过 sudo 执行部署（非 root 登录时需要）</Checkbox>
        </>
      ) : (
        <>
          <KeyValue items={[['服务器', `${f.user}@${f.host}:${f.port}`, { mono: true }], ['主机指纹', 'SHA256:TmV3LWZpY3Rpb25hbC1ob3N0', { mono: true }], ['系统', 'Debian 13 · x86_64']]} />
          <Callout tone="info">与服务器控制台中 <span className="mono">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span> 的输出比对。之后指纹变化会拒绝连接。</Callout>
        </>
      )}
    </Dialog>
  )
}

export function ServerDetail({ id }: { id: string }) {
  const db = useDB((d) => d)
  const s = db.servers.find((x) => x.id === id)
  const [rotate, setRotate] = useState(false)
  usePolling()
  if (!s) return <div className="page"><Empty icon="server" title="服务器不存在" actions={<Button onClick={() => go('/servers')}>返回服务器</Button>} /></div>
  const cred = db.credentials.find((c) => c.id === s.credentialId)
  const projects = db.projects.filter((p) => p.serverId === s.id)
  const fw = db.firewall.find((f) => f.serverId === s.id)
  return (
    <div className="page">
      <PageHeader title={s.name} sub={<span className="mono">{endpoint(s)}</span>}
        actions={<><Button icon="refresh" onClick={() => checkServer(s.id)}>立即检查</Button><Button icon="key" onClick={() => setRotate(true)}>更换凭据</Button></>} />
      {s.observation.state !== 'ok' && (
        <Callout tone="danger" title={serverText[s.observation.state]} actions={<Button onClick={() => setRotate(true)}>更换凭据</Button>}>{s.observation.message}</Callout>
      )}
      <LoadGate id={'server-' + s.id}>{() => (
        <div className="split">
          <div className="stack">
            <Panel title="连接">
              <KeyValue items={[
                ['状态', <><Status tone={serverTone[s.observation.state]}>{serverText[s.observation.state]}</Status> <span className="muted">· {time(s.observation.checkedAt)}</span></>],
                ['地址', endpoint(s), { mono: true }],
                ['主机指纹', s.fingerprint, { mono: true }],
                ['凭据', <>{cred?.name} · 修订 {s.credentialRevision}</>],
                ['提权', s.sudo ? 'sudo' : '直接执行'],
                ['系统', `${s.observation.os ?? '—'} · ${s.observation.arch ?? '—'}`],
              ]} />
            </Panel>
            <Panel title="防火墙" actions={<Button variant="ghost" size="sm" onClick={() => go(`/firewall?server=${s.id}`)}>管理</Button>}>
              {fw ? <KeyValue items={[['管理器', fw.manager], ['状态', fw.running ? <Status tone="ok">运行中</Status> : <Status tone="neutral">已停止</Status>], ['入站规则', `${fw.rules.length} 条`]]} /> : <p className="muted">尚未读取。</p>}
            </Panel>
          </div>
          <Panel title="项目" flush>
            {projects.length ? <ul className="ds-list">{projects.map((p) => <li key={p.id}><div className="main"><a className="ds-cell-title" href={href(`/projects/${p.id}`)}>{p.name}</a><span className="ds-cell-sub">{p.type}</span></div><Runtime p={p} /></li>)}</ul>
              : <Empty icon="project" title="这台服务器上还没有项目" />}
          </Panel>
        </div>
      )}</LoadGate>
      <Dialog open={rotate} onOpenChange={setRotate} size="sm" title="更换 SSH 凭据" description={s.name}
        footer={<><Button onClick={() => setRotate(false)}>取消</Button><Button variant="primary" onClick={() => {
          mutate((d) => ({ ...d, servers: d.servers.map((x) => x.id === s.id ? { ...x, credentialRevision: x.credentialRevision + 1, observation: { ...x.observation, state: 'ok', message: undefined, checkedAt: new Date().toISOString() } } : x) }))
          setRotate(false)
        }}>验证并切换</Button></>}>
        <Field label="新私钥正文" hint="先用新凭据登录验证，成功后才切换；失败时继续使用当前凭据。"><Textarea mono rows={5} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" /></Field>
        <SectionLabel>影响</SectionLabel>
        <Consequences items={[{ text: `“${cred?.name}” 被 ${cred?.usedBy ?? 1} 台服务器使用；只更新这一台。` }, { text: '已在进行中的操作继续使用原凭据。' }]} />
        <Badge>原型：不校验正文</Badge>
      </Dialog>
    </div>
  )
}
