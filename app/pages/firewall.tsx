import { useState } from 'react'
import { Badge, Button, Callout, Checkbox, ConfirmDialog, Consequences, Dialog, Empty, Field, Input, KeyValue, Panel, Segmented, Select, Status, Tabs, TabPanel, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, runOperation } from '../data/store'
import type { FirewallHost, FirewallRule } from '../data/model'
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
              <TabPanel value="forward"><Panel title="端口转发"><Empty icon="frp" title="没有转发规则" actions={<Button disabled={busy}>添加转发</Button>}>把本机端口转发到另一地址与端口。</Empty></Panel></TabPanel>
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
  const chosen = host.rules.filter((r) => sel.includes(r.id))
  const task = (label: string, apply: (rules: FirewallRule[]) => FirewallRule[]) => {
    runOperation({ kind: 'firewall', label, target: { type: 'firewall', id: host.serverId, name }, steps: ['提交任务', '读取任务结果'], durationMs: 1600,
      onSuccess: (d) => ({ ...d, firewall: d.firewall.map((f) => f.serverId === host.serverId ? { ...f, rules: apply(f.rules) } : f) }) })
  }
  return (
    <Panel flush title="入站规则" actions={<>
      {sel.length > 0 && <Button size="sm" variant="danger" icon="trash" disabled={busy} onClick={() => setDel(true)}>删除所选 {sel.length}</Button>}
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
      <RuleDialog open={add} onOpenChange={setAdd} existing={host.rules} onSubmit={(r) => { task('防火墙添加规则', (rs) => [...rs, r]); setAdd(false) }} />
      <ConfirmDialog open={del} onOpenChange={setDel} title={`删除 ${chosen.length} 条规则？`} confirmLabel="删除规则" variant="danger-solid"
        onConfirm={() => { task('防火墙删除规则', (rs) => rs.filter((x) => !sel.includes(x.id))); setSel([]); setDel(false) }}>
        <Consequences items={chosen.map((r) => ({ text: <><span className="mono">{r.port}/{r.protocol}</span> {r.note}{r.usedBy ? `（${r.usedBy} 正在使用，删除后外部无法访问）` : ''}</>, tone: r.usedBy || r.port === '22' ? 'danger' as const : undefined }))} />
        {chosen.some((r) => r.port === '22') && <Callout tone="danger" title="包含 SSH 端口">删除后栈桥可能无法再连接这台服务器。</Callout>}
      </ConfirmDialog>
    </Panel>
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
