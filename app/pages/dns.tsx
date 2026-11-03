import { useState } from 'react'
import { Badge, Button, Callout, ConfirmDialog, Dialog, Diff, Empty, Field, Input, KeyValue, Menu, Panel, SearchInput, SectionLabel, Select, Switch, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, mutate, runOperation } from '../data/store'
import type { DnsRecord } from '../data/model'
import { go, time } from '../lib'
import { LoadGate } from './common'

const PAGE = 20

export function Dns() {
  const db = useDB((d) => d)
  const [zoneId, setZoneId] = useState(db.zones[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<DnsRecord | 'new' | null>(null)
  const [del, setDel] = useState<DnsRecord | null>(null)
  const [connect, setConnect] = useState(false)
  const zone = db.zones.find((z) => z.id === zoneId)
  const records = (zone?.records ?? []).filter((r) => !q || (r.name + r.content).includes(q))
  const busy = db.operations.some((o) => o.target.type === 'dns' && o.result === 'running')
  return (
    <div className="page">
      <PageHeader title="DNS" sub={db.cloudflare ? <>Cloudflare · {db.cloudflare.account}</> : '连接 Cloudflare 后管理 Zone 记录。'}
        actions={db.cloudflare ? <Button onClick={() => setConnect(true)} icon="key">连接设置</Button> : undefined} />
      <LoadGate id="dns" skeleton>{() => !db.cloudflare ? (
        <Panel><Empty icon="dns" title="尚未连接 Cloudflare" actions={<Button variant="primary" onClick={() => setConnect(true)}>连接 Cloudflare</Button>}>需要一个具有 Zone 读取与 DNS 编辑权限的 API Token。</Empty></Panel>
      ) : (
        <>
          <div className="toolbar">
            <Select aria-label="Zone" value={zoneId} onValueChange={setZoneId} placeholder="选择 Zone" options={db.zones.map((z) => ({ value: z.id, label: z.name, hint: `${z.records.length} 条记录` }))} />
            <SearchInput placeholder="搜索名称或内容" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索记录" />
            <span className="grow" />
            <Button variant="primary" icon="plus" disabled={!zone || busy} onClick={() => setEdit('new')}>添加记录</Button>
          </div>
          {busy && <Callout tone="info" title="DNS 变更进行中" live>完成前不能提交新的变更。</Callout>}
          <Panel flush footer={zone ? `第 1 页 · 每页 ${PAGE} 条 · 共 ${zone.records.length} 条` : undefined}>
            {!zone ? <Empty title="选择一个 Zone" /> : !zone.records.length ? <Empty icon="dns" title="此 Zone 没有记录" actions={<Button onClick={() => setEdit('new')}>添加记录</Button>} /> : !records.length ? <Empty icon="search" title="没有匹配的记录" /> : (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>类型</th><th>名称</th><th>内容</th><th>代理</th><th>TTL</th><th data-align="end"><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{records.slice(0, PAGE).map((r) => (
                  <tr key={r.id}>
                    <td><Badge mono>{r.type}</Badge></td>
                    <td className="mono">{r.name}</td>
                    <td className="mono" style={{ wordBreak: 'break-all' }}>{r.content}</td>
                    <td>{r.proxied ? <Badge tone="accent">已代理</Badge> : <span className="muted">仅 DNS</span>}</td>
                    <td className="nowrap">{r.ttl === 1 ? '自动' : `${r.ttl} 秒`}</td>
                    <td data-align="end"><Menu label={`${r.name} 操作`} items={[{ label: '编辑', icon: 'edit', onSelect: () => setEdit(r), disabled: busy }, { label: '删除…', icon: 'trash', tone: 'danger', separatorBefore: true, onSelect: () => setDel(r), disabled: busy }]} /></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Panel>
        </>
      )}</LoadGate>
      {edit && zone && <RecordDialog key={edit === 'new' ? 'new' : edit.id} zoneId={zone.id} zoneName={zone.name} record={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!del} onOpenChange={() => setDel(null)} title={`删除 ${del?.type} 记录？`} confirmLabel="删除记录" variant="danger-solid"
        onConfirm={() => { const r = del!; runOperation({ kind: 'dns', label: 'DNS 删除', target: { type: 'dns', id: zoneId, name: r.name }, steps: ['提交删除', '读回核对'], onSuccess: (d) => ({ ...d, zones: d.zones.map((z) => z.id === zoneId ? { ...z, records: z.records.filter((x) => x.id !== r.id) } : z) }) }); setDel(null) }}>
        {del && <><KeyValue items={[['名称', del.name, { mono: true }], ['内容', del.content, { mono: true }]]} /><p className="secondary" style={{ marginTop: 12 }}>删除后解析立即失效，依赖此名称的访问会中断。</p></>}
      </ConfirmDialog>
      <ConnectDialog open={connect} onOpenChange={setConnect} />
    </div>
  )
}

function RecordDialog({ zoneId, zoneName, record, onClose }: { zoneId: string; zoneName: string; record?: DnsRecord; onClose: () => void }) {
  const [r, setR] = useState<DnsRecord>(record ?? { id: 'r' + Date.now(), type: 'A', name: '', content: '', proxied: false, ttl: 1 })
  const [step, setStep] = useState<'form' | 'preview'>('form')
  const [touched, setTouched] = useState(false)
  const toast = useToast()
  const fqdn = r.name.endsWith(zoneName) ? r.name : r.name ? `${r.name}.${zoneName}` : ''
  const err = {
    name: !r.name ? '填写名称。' : undefined,
    content: !r.content ? '填写内容。' : r.type === 'A' && !/^(\d{1,3}\.){3}\d{1,3}$/.test(r.content) ? 'A 记录需为 IPv4 地址。' : r.type === 'AAAA' && !r.content.includes(':') ? 'AAAA 记录需为 IPv6 地址。' : undefined,
  }
  const ok = !err.name && !err.content
  const lines = [
    ...(record ? [{ sign: '-' as const, text: `${record.type}  ${record.name}  ${record.content}  ${record.proxied ? 'proxied' : 'dns-only'}` }] : []),
    { sign: '+' as const, text: `${r.type}  ${fqdn}  ${r.content}  ${r.proxied ? 'proxied' : 'dns-only'}` },
  ]
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={record ? '编辑记录' : '添加记录'} description={zoneName}
      footer={step === 'form' ? <><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => { setTouched(true); if (ok) setStep('preview') }}>预览变更</Button></> : <>
        <Button onClick={() => setStep('form')}>返回修改</Button>
        <Button variant="primary" onClick={() => {
          runOperation({ kind: 'dns', label: record ? 'DNS 修改' : 'DNS 添加', target: { type: 'dns', id: zoneId, name: fqdn }, steps: ['提交变更', '读回核对'],
            onSuccess: (d) => ({ ...d, zones: d.zones.map((z) => z.id !== zoneId ? z : { ...z, records: record ? z.records.map((x) => (x.id === r.id ? { ...r, name: fqdn } : x)) : [...z.records, { ...r, name: fqdn }] }) }) })
          onClose(); toast({ title: '已提交 DNS 变更', body: '完成后自动读回核对。', tone: 'info' })
        }}>确认提交</Button>
      </>}>
      {step === 'form' ? (
        <>
          <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)' }}>
            <Field label="类型"><Select value={r.type} onValueChange={(v) => setR({ ...r, type: v as DnsRecord['type'] })} disabled={!!record} options={['A', 'AAAA', 'CNAME', 'TXT'].map((t) => ({ value: t, label: t }))} /></Field>
            <Field label="名称" required error={touched ? err.name : undefined} hint={fqdn ? <>完整名称 <span className="mono">{fqdn}</span></> : undefined}><Input mono value={r.name} onChange={(e) => setR({ ...r, name: e.target.value.trim() })} placeholder="notes" /></Field>
          </div>
          <Field label="内容" required error={touched ? err.content : undefined}><Input mono value={r.content} onChange={(e) => setR({ ...r, content: e.target.value.trim() })} placeholder={r.type === 'A' ? '192.0.2.24' : ''} /></Field>
          {(r.type === 'A' || r.type === 'AAAA' || r.type === 'CNAME') && <div className="row" data-justify="between"><span>经 Cloudflare 代理<span className="ds-hint" style={{ display: 'block' }}>代理后源站地址不对外暴露。</span></span><Switch label="经 Cloudflare 代理" checked={r.proxied} onCheckedChange={(v) => setR({ ...r, proxied: v })} /></div>}
        </>
      ) : (
        <section><SectionLabel>将提交</SectionLabel><Diff label="记录差异" lines={lines} /><p className="ds-hint" style={{ marginTop: 8 }}>提交使用这份固定内容；若 Cloudflare 上记录已被他处修改，会停止并提示。</p></section>
      )}
    </Dialog>
  )
}

function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const cf = useDB((d) => d.cloudflare)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={!busy} size="sm" title="Cloudflare 连接" description={cf ? `已连接 ${cf.account} · ${time(cf.connectedAt)}` : '保存前会用 Token 读取可见的 Zone。'}
      footer={<>
        {cf && <Button variant="danger" onClick={() => { mutate((d) => ({ ...d, cloudflare: null })); onOpenChange(false) }}>断开连接</Button>}
        <Button onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
        <Button variant="primary" busy={busy} disabled={!token} onClick={() => { setBusy(true); setTimeout(() => { mutate((d) => ({ ...d, cloudflare: { account: 'personal@example.test', tokenHint: '…' + token.slice(-4), connectedAt: new Date().toISOString() } })); setBusy(false); setToken(''); onOpenChange(false); go('/dns') }, 1000) }}>{cf ? '验证并替换' : '验证并连接'}</Button>
      </>}>
      {cf && <KeyValue items={[['当前 Token', cf.tokenHint, { mono: true }]]} />}
      <Field label="API Token" hint="只保存在管理端；之后不会回显。"><Input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" /></Field>
    </Dialog>
  )
}
