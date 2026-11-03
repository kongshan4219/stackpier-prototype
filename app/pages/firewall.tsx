import { useState } from 'react'
import { Badge, Button, Callout, Checkbox, ConfirmDialog, Consequences, Dialog, Empty, Field, Input, KeyValue, Panel, Segmented, Select, Status, Tabs, TabPanel, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, runOperation } from '../data/store'
import type { FirewallForward, FirewallHost, FirewallRule } from '../data/model'
import { endpoint, go } from '../lib'
import { LoadGate } from './common'

export function Firewall() {
  const db = useDB((d) => d)
  const initial = new URLSearchParams(location.hash.split('?')[1]).get('server') ?? ''
  const [serverId, setServerId] = useState(initial)
  const [tab, setTab] = useState('rules')
  const host = db.firewall.find((f) => f.serverId === serverId)
  const srv = db.servers.find((s) => s.id === serverId)
  const busy = db.operations.some((o) => o.target.type === 'firewall' && o.target.id === serverId && o.result === 'running')
  return (
    <div className="page">
      <PageHeader title="防火墙" sub="系统入站规则、Docker 发布端口与端口转发。" />
      <div className="toolbar">
        <Select aria-label="目标服务器" value={serverId} onValueChange={(v) => { setServerId(v); history.replaceState(null, '', `#/firewall?server=${v}`) }} placeholder="选择服务器" options={db.servers.map((s) => ({ value: s.id, label: s.name, hint: endpoint(s) }))} />
        {host && <><Status tone={host.running ? 'ok' : 'neutral'}>{host.manager} {host.running ? '运行中' : '已停止'}</Status></>}
      </div>
      {!serverId ? <Panel><Empty icon="firewall" title="选择一台服务器" >防火墙规则按服务器读取和修改。</Empty></Panel> : (
        <LoadGate id={'firewall-' + serverId} skeleton>{() => !host ? (
          <Panel><Empty icon="firewall" title={`${srv?.name} 上没有识别到防火墙`}>原型示例只为部分服务器提供数据。</Empty></Panel>
        ) : (
          <>
            {busy && <Callout tone="info" title="任务进行中" live>完成前不能提交新的防火墙变更。</Callout>}
            <Tabs label="防火墙分类" value={tab} onValueChange={setTab} tabs={[{ value: 'rules', label: `系统规则 ${host.rules.length}` }, { value: 'docker', label: 'Docker' }, { value: 'forward', label: '端口转发' }, { value: 'settings', label: '设置' }]}>
              <TabPanel value="rules"><Rules host={host} busy={busy} name={srv!.name} /></TabPanel>
              <TabPanel value="docker">
                <Panel flush description="由 Docker 发布的端口不经过系统规则；在容器配置中修改。" title="Docker 发布端口">
                  {host.docker.length ? <div className="ds-table-wrap"><table className="ds-table"><thead><tr><th>容器</th><th>端口</th></tr></thead><tbody>{host.docker.map((d) => <tr key={d.container}><td className="mono">{d.container}</td><td className="mono">{d.ports}</td></tr>)}</tbody></table></div> : <Empty title="没有 Docker 发布端口" />}
                </Panel>
              </TabPanel>
              <TabPanel value="forward"><Forwards host={host} busy={busy} name={srv!.name} /></TabPanel>
              <TabPanel value="settings"><Settings host={host} busy={busy} name={srv!.name} /></TabPanel>
            </Tabs>
          </>
        )}</LoadGate>
      )}
    </div>
  )
}

function Rules({ host, busy, name }: { host: FirewallHost; busy: boolean; name: string }) {
  const [sel, setSel] = useState<string[]>([])
  const [add, setAdd] = useState(false)
  const [del, setDel] = useState(false)
  const [imp, setImp] = useState(false)
  const chosen = host.rules.filter((r) => sel.includes(r.id))
  const task = (label: string, apply: (rules: FirewallRule[]) => FirewallRule[]) => {
    runOperation({ kind: 'firewall', label, target: { type: 'firewall', id: host.serverId, name }, steps: ['提交任务', '读取任务结果'], durationMs: 1600,
      onSuccess: (d) => ({ ...d, firewall: d.firewall.map((f) => f.serverId === host.serverId ? { ...f, rules: apply(f.rules) } : f) }) })
  }
  return (
    <Panel flush title="入站规则" actions={<>
      {sel.length > 0 && <Button size="sm" variant="danger" icon="trash" disabled={busy} onClick={() => setDel(true)}>删除所选 {sel.length}</Button>}
      <Button size="sm" icon="upload" disabled={busy} onClick={() => setImp(true)}>导入</Button>
      <Button size="sm" icon="download" onClick={() => exportJSON(`${name}-system-rules.json`, host.rules)}>导出</Button>
      <Button size="sm" variant="primary" icon="plus" disabled={busy} onClick={() => setAdd(true)}>添加规则</Button>
    </>}>
      {host.rules.length ? <div className="ds-table-wrap"><table className="ds-table">
        <thead><tr><th style={{ width: 36 }}><span className="sr-only">选择</span></th><th>端口</th><th>协议</th><th>来源</th><th>策略</th><th>说明</th></tr></thead>
        <tbody>{host.rules.map((r) => (
          <tr key={r.id}>
            <td><Checkbox checked={sel.includes(r.id)} onCheckedChange={(v) => setSel(v ? [...sel, r.id] : sel.filter((x) => x !== r.id))}><span className="sr-only">选择端口 {r.port}</span></Checkbox></td>
            <td className="mono">{r.port}</td><td className="mono">{r.protocol}</td><td className="mono">{r.source}</td>
            <td>{r.action === 'accept' ? <Status tone="ok">放行</Status> : <Status tone="danger">拒绝</Status>}</td>
            <td>{r.note}{r.usedBy && <div className="ds-cell-sub">被 {r.usedBy} 使用</div>}</td>
          </tr>
        ))}</tbody>
      </table></div> : <Empty title="没有入站规则" />}
      <ImportDialog open={imp} onOpenChange={setImp} limit="64 MiB" onImport={(n) => task(`防火墙导入 ${n} 条规则`, (rs) => [...rs, ...Array.from({ length: n }, (_, i) => ({ id: 'imp' + Date.now() + i, port: String(9000 + i), protocol: 'tcp' as const, source: '全部', action: 'accept' as const, note: '导入' }))])} />
      <RuleDialog open={add} onOpenChange={setAdd} existing={host.rules} onSubmit={(r) => { task('防火墙添加规则', (rs) => [...rs, r]); setAdd(false) }} />
      <ConfirmDialog open={del} onOpenChange={setDel} title={`删除 ${chosen.length} 条规则？`} confirmLabel="删除规则" variant="danger-solid"
        onConfirm={() => { task('防火墙删除规则', (rs) => rs.filter((x) => !sel.includes(x.id))); setSel([]); setDel(false) }}>
        <Consequences items={chosen.map((r) => ({ text: <><span className="mono">{r.port}/{r.protocol}</span> {r.note}{r.usedBy ? `（${r.usedBy} 正在使用，删除后外部无法访问）` : ''}</>, tone: r.usedBy || r.port === '22' ? 'danger' as const : undefined }))} />
        {chosen.some((r) => r.port === '22') && <Callout tone="danger" title="包含 SSH 端口">删除后栈桥可能无法再连接这台服务器。</Callout>}
      </ConfirmDialog>
    </Panel>
  )
}

function exportJSON(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ImportDialog({ open, onOpenChange, limit, onImport }: { open: boolean; onOpenChange: (v: boolean) => void; limit: string; onImport: (n: number) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  const read = async (f: File | null) => {
    setFile(f); setCount(null); setError(undefined)
    if (!f) return
    try {
      const v = JSON.parse(await f.text())
      if (!Array.isArray(v)) throw new Error('not array')
      setCount(v.length)
    } catch { setError('无法解析为 1Panel 规则 JSON；旧 stackpier-port-rules 格式不受支持。') }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setFile(null); setCount(null); setError(undefined) } onOpenChange(v) }} size="sm" title="导入规则" description={`1Panel 规则格式，文件上限 ${limit}。`}
      footer={<><Button onClick={() => onOpenChange(false)}>取消</Button><Button variant="primary" disabled={!count} onClick={() => { onImport(count!); onOpenChange(false) }}>{count ? `导入 ${count} 条` : '导入'}</Button></>}>
      <Field label="JSON 文件" error={error} hint="在浏览器内读取并核对条目，确认后才提交。"><Input type="file" accept="application/json,.json" onChange={(e) => read(e.target.files?.[0] ?? null)} /></Field>
      {file && count !== null && <Callout tone="info">读取到 {count} 条规则。与现有规则相同的条目会被跳过。</Callout>}
    </Dialog>
  )
}

function Forwards({ host, busy, name }: { host: FirewallHost; busy: boolean; name: string }) {
  const [add, setAdd] = useState(false)
  const [del, setDel] = useState<FirewallForward | null>(null)
  const task = (label: string, apply: (f: FirewallForward[]) => FirewallForward[]) =>
    runOperation({ kind: 'firewall', label, target: { type: 'firewall', id: host.serverId, name }, steps: ['提交任务', '读取任务结果'], durationMs: 1600,
      onSuccess: (d) => ({ ...d, firewall: d.firewall.map((f) => (f.serverId === host.serverId ? { ...f, forwards: apply(f.forwards) } : f)) }) })
  return (
    <Panel flush title="端口转发" description="把本机端口转发到另一地址与端口。" actions={<>
      <Button size="sm" icon="download" disabled={!host.forwards.length} onClick={() => exportJSON(`${name}-forwarding.json`, host.forwards)}>导出</Button>
      <Button size="sm" variant="primary" icon="plus" disabled={busy} onClick={() => setAdd(true)}>添加转发</Button>
    </>}>
      {host.forwards.length ? <div className="ds-table-wrap"><table className="ds-table">
        <thead><tr><th>协议</th><th>本机端口</th><th>目标</th><th>网卡</th><th data-align="end"><span className="sr-only">操作</span></th></tr></thead>
        <tbody>{host.forwards.map((f) => (
          <tr key={f.id}><td className="mono">{f.family} · {f.protocol}</td><td className="mono">{f.port}</td><td className="mono">{f.targetIP || '本机'}:{f.targetPort}</td><td>{f.iface || '全部'}</td>
            <td data-align="end"><Button size="sm" variant="ghost" icon="trash" label={`删除转发 ${f.port}`} disabled={busy} onClick={() => setDel(f)} /></td></tr>
        ))}</tbody>
      </table></div> : <Empty icon="frp" title="没有转发规则" />}
      <ForwardDialog open={add} onOpenChange={setAdd} onSubmit={(f) => { task('防火墙添加转发', (fs) => [...fs, f]); setAdd(false) }} />
      <ConfirmDialog open={!!del} onOpenChange={() => setDel(null)} title="删除端口转发？" confirmLabel="删除转发" variant="danger-solid" onConfirm={() => { task('防火墙删除转发', (fs) => fs.filter((x) => x.id !== del!.id)); setDel(null) }}>
        {del && <p>本机 <span className="mono">{del.port}/{del.protocol}</span> → <span className="mono">{del.targetIP || '本机'}:{del.targetPort}</span> 的流量将不再转发。</p>}
      </ConfirmDialog>
    </Panel>
  )
}

function ForwardDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (f: FirewallForward) => void }) {
  const [f, setF] = useState<Omit<FirewallForward, 'id'>>({ family: 'ipv4', protocol: 'tcp', port: '', targetIP: '', targetPort: '', iface: '' })
  const [touched, setTouched] = useState(false)
  const range = /^\d+(-\d+)?$/
  const err = {
    port: !range.test(f.port) ? '填写端口或端口范围。' : undefined,
    targetPort: !range.test(f.targetPort) ? '填写目标端口或端口范围。' : undefined,
    targetIP: f.targetIP && !(f.family === 'ipv4' ? /^(\d{1,3}\.){3}\d{1,3}$/ : /:/).test(f.targetIP) ? `需为 ${f.family === 'ipv4' ? 'IPv4' : 'IPv6'} 地址。` : undefined,
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title="添加端口转发"
      footer={<><Button onClick={() => onOpenChange(false)}>取消</Button><Button variant="primary" onClick={() => { setTouched(true); if (!err.port && !err.targetPort && !err.targetIP) onSubmit({ id: 'fwd' + Date.now(), ...f }) }}>添加</Button></>}>
      <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="地址族"><Segmented label="地址族" value={f.family} onValueChange={(v) => setF({ ...f, family: v as FirewallForward['family'] })} options={[{ value: 'ipv4', label: 'IPv4' }, { value: 'ipv6', label: 'IPv6' }]} /></Field>
        <Field label="协议"><Select value={f.protocol} onValueChange={(v) => setF({ ...f, protocol: v as FirewallForward['protocol'] })} options={['tcp', 'udp', 'tcp/udp'].map((v) => ({ value: v, label: v.toUpperCase() }))} /></Field>
      </div>
      {f.family === 'ipv6' && <Callout tone="warn">IPv6 转发存在断网风险；提交时会检查网络配置，风险未排除会被阻止。</Callout>}
      <Field label="本机端口" required error={touched ? err.port : undefined}><Input mono value={f.port} onChange={(e) => setF({ ...f, port: e.target.value.trim() })} /></Field>
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <Field label="目标地址" error={touched ? err.targetIP : undefined} hint="留空表示本机。"><Input mono value={f.targetIP} onChange={(e) => setF({ ...f, targetIP: e.target.value.trim() })} /></Field>
        <Field label="目标端口" required error={touched ? err.targetPort : undefined}><Input mono value={f.targetPort} onChange={(e) => setF({ ...f, targetPort: e.target.value.trim() })} /></Field>
      </div>
      <Field label="网卡"><Select value={f.iface || 'all'} onValueChange={(v) => setF({ ...f, iface: v === 'all' ? '' : v })} options={[{ value: 'all', label: '全部' }, { value: 'eth0', label: 'eth0' }, { value: 'docker0', label: 'docker0' }]} /></Field>
    </Dialog>
  )
}

function RuleDialog({ open, onOpenChange, existing, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; existing: FirewallRule[]; onSubmit: (r: FirewallRule) => void }) {
  const [r, setR] = useState({ port: '', protocol: 'tcp' as FirewallRule['protocol'], source: '', action: 'accept' as FirewallRule['action'], note: '' })
  const [touched, setTouched] = useState(false)
  const err = {
    port: !/^\d+(-\d+)?$/.test(r.port) ? '填写端口或端口范围，例如 8080 或 8000-8100。' : existing.some((x) => x.port === r.port && x.protocol === r.protocol) ? '已有相同端口与协议的规则。' : undefined,
    source: r.source && !/^[\d./:a-f]+$/i.test(r.source) ? '填写 IP 或 CIDR，留空表示全部来源。' : undefined,
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title="添加入站规则"
      footer={<><Button onClick={() => onOpenChange(false)}>取消</Button><Button variant="primary" onClick={() => { setTouched(true); if (!err.port && !err.source) onSubmit({ id: 'fw' + Date.now(), ...r, source: r.source || '全部' }) }}>添加</Button></>}>
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <Field label="端口" required error={touched ? err.port : undefined}><Input mono value={r.port} onChange={(e) => setR({ ...r, port: e.target.value.trim() })} /></Field>
        <Field label="协议"><Select value={r.protocol} onValueChange={(v) => setR({ ...r, protocol: v as FirewallRule['protocol'] })} options={['tcp', 'udp', 'tcp/udp'].map((v) => ({ value: v, label: v }))} /></Field>
      </div>
      <Field label="来源" error={touched ? err.source : undefined} hint="留空表示全部来源。"><Input mono value={r.source} onChange={(e) => setR({ ...r, source: e.target.value.trim() })} placeholder="198.51.100.0/24" /></Field>
      <Field label="策略"><Segmented label="策略" value={r.action} onValueChange={(v) => setR({ ...r, action: v as FirewallRule['action'] })} options={[{ value: 'accept', label: '放行' }, { value: 'drop', label: '拒绝' }]} /></Field>
      <Field label="说明"><Input value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} /></Field>
    </Dialog>
  )
}

function Settings({ host, busy, name }: { host: FirewallHost; busy: boolean; name: string }) {
  const [reset, setReset] = useState(false)
  const toast = useToast()
  const toggle = (label: string, patch: Partial<FirewallHost>) => {
    runOperation({ kind: 'firewall', label, target: { type: 'firewall', id: host.serverId, name }, steps: ['提交任务', '读取任务结果'], onSuccess: (d) => ({ ...d, firewall: d.firewall.map((f) => (f.serverId === host.serverId ? { ...f, ...patch } : f)) }) })
    toast({ title: `已提交：${label}`, tone: 'info' })
  }
  return (
    <div className="stack">
      <Panel title="状态">
        <KeyValue items={[
          ['防火墙', <span className="row"><Status tone={host.running ? 'ok' : 'neutral'}>{host.running ? '运行中' : '已停止'}</Status><Button size="sm" disabled={busy} onClick={() => toggle(host.running ? '停止防火墙' : '启动防火墙', { running: !host.running })}>{host.running ? '停止' : '启动'}</Button></span>],
          ['禁 Ping', <span className="row"><Badge>{host.pingBlocked ? '已开启' : '未开启'}</Badge><Button size="sm" disabled={busy} onClick={() => toggle(host.pingBlocked ? '允许 Ping' : '禁止 Ping', { pingBlocked: !host.pingBlocked })}>{host.pingBlocked ? '允许' : '禁止'}</Button></span>],
        ]} />
      </Panel>
      <Panel title="旧版端口规则记录" description="统一防火墙方案时期的操作记录，仅供查询，不能再执行或恢复。">
        <Button size="sm" onClick={() => go('/operations')}>在操作记录中查看</Button>
      </Panel>
      <Panel title="重置为默认配置" description="恢复管理器默认规则；当前配置会先备份到服务器。">
        <Button variant="danger" disabled={busy} onClick={() => setReset(true)}>重置…</Button>
      </Panel>
      <ConfirmDialog open={reset} onOpenChange={setReset} title={`重置 ${name} 的防火墙？`} confirmLabel="备份并重置" variant="danger-solid"
        onConfirm={() => { toggle('重置防火墙', {}); setReset(false); go('/operations') }}>
        <Consequences items={[{ text: '当前全部规则会被默认配置替换。', tone: 'danger' }, { text: '重置前在服务器上备份当前配置。' }]} />
      </ConfirmDialog>
    </div>
  )
}
