import { useState } from 'react'
import { Badge, Button, Callout, Dialog, Diff, Empty, Field, Input, KeyValue, Menu, Panel, SectionLabel, Segmented, Status, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, runOperation } from '../data/store'
import type { FrpConnection } from '../data/model'
import { go, href } from '../lib'
import { LoadGate, Runtime } from './common'

type MappingDraft = { name: string; kind: 'tcp' | 'stcp'; localPort: string; remotePort: string }

export function Frp() {
  const db = useDB((d) => d)
  const [edit, setEdit] = useState<{ conn: FrpConnection; remove?: string } | null>(null)
  const toast = useToast()
  return (
    <div className="page">
      <PageHeader title="FRP" sub="连接与 TCP / STCP 映射。服务端与客户端的启停在项目页管理。" />
      <LoadGate id="frp" skeleton>{() => !db.frp.length ? (
        <Panel><Empty icon="frp" title="还没有 FRP 连接" actions={<Button onClick={() => go('/projects')}>前往项目部署 FRP</Button>}>先分别部署 FRP 服务端与客户端项目，再在这里建立连接和映射。</Empty></Panel>
      ) : <>{db.frp.map((c) => {
        const s = db.projects.find((p) => p.id === c.serverProjectId)
        const cl = db.projects.find((p) => p.id === c.clientProjectId)
        const busy = db.operations.some((o) => o.target.id === c.id && o.result === 'running')
        return (
          <Panel key={c.id} title={c.name} description={busy ? '变更进行中…' : '两端配置已应用'} flush
            actions={<>
              <Button size="sm" icon="search" disabled={busy} onClick={() => { runOperation({ kind: 'frp-probe', label: 'FRP 探测', target: { type: 'frp', id: c.id, name: c.name }, steps: ['探测服务端端口', '探测客户端连接'] }); toast({ title: '已开始探测', body: '只做连通性检查，不修改配置。', tone: 'info' }) }}>探测</Button>
              <Button size="sm" variant="primary" icon="plus" disabled={busy} onClick={() => setEdit({ conn: c })}>添加映射</Button>
            </>}>
            <div style={{ padding: 14, borderBottom: '1px solid var(--color-border)' }}>
              <KeyValue items={[
                ['服务端', s ? <span className="row" style={{ gap: 8 }}><a href={href(`/projects/${s.id}`)}>{s.name}</a><Runtime p={s} /></span> : '—'],
                ['客户端', cl ? <span className="row" style={{ gap: 8 }}><a href={href(`/projects/${cl.id}`)}>{cl.name}</a><Runtime p={cl} /></span> : '—'],
              ]} />
            </div>
            {c.mappings.length ? (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>映射</th><th>类型</th><th>本地端口</th><th>对外</th><th data-align="end"><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{c.mappings.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{m.name}</td>
                    <td><Badge mono>{m.kind.toUpperCase()}</Badge></td>
                    <td className="mono">{m.localPort}</td>
                    <td className="mono">{m.kind === 'tcp' ? `服务端 :${m.remotePort}` : <>visitor 127.0.0.1:{m.visitorPort}<div className="ds-cell-sub">仅服务端本机回环</div></>}</td>
                    <td data-align="end"><Menu label={`${m.name} 操作`} items={[{ label: '解除映射…', icon: 'trash', tone: 'danger', onSelect: () => setEdit({ conn: c, remove: m.id }) }]} /></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <Empty title="还没有映射" />}
          </Panel>
        )
      })}</>}</LoadGate>
      {edit && <MappingDialog key={edit.conn.id + edit.remove} conn={edit.conn} removeId={edit.remove} onClose={() => setEdit(null)} />}
    </div>
  )
}

function MappingDialog({ conn, removeId, onClose }: { conn: FrpConnection; removeId?: string; onClose: () => void }) {
  const firewall = useDB((d) => d.firewall)
  const [m, setM] = useState<MappingDraft>({ name: '', kind: 'tcp', localPort: '', remotePort: '' })
  const [step, setStep] = useState<'form' | 'preview'>(removeId ? 'preview' : 'form')
  const [touched, setTouched] = useState(false)
  const [outcome, setOutcome] = useState<'success' | 'unknown'>('success')
  const removing = conn.mappings.find((x) => x.id === removeId)
  const port = (v: string) => /^\d+$/.test(v) && +v > 0 && +v < 65536
  const err = {
    name: !/^[a-z][a-z0-9-]{1,30}$/.test(m.name) ? '小写字母开头，只用小写字母、数字和连字符。' : conn.mappings.some((x) => x.name === m.name) ? '名称已被使用。' : undefined,
    local: !port(m.localPort) ? '端口为 1–65535。' : undefined,
    remote: m.kind === 'tcp' && !port(m.remotePort) ? '端口为 1–65535。' : m.kind === 'tcp' && conn.mappings.some((x) => String(x.remotePort) === m.remotePort) ? `端口 ${m.remotePort} 已被映射使用。` : undefined,
  }
  const ok = !err.name && !err.local && !err.remote
  const fwOpen = firewall.some((f) => f.rules.some((r) => r.port === m.remotePort))
  const lines = removing
    ? [{ sign: ' ' as const, text: `[[proxies]]` }, { sign: '-' as const, text: `name = "${removing.name}"` }, { sign: '-' as const, text: `type = "${removing.kind}"` }, { sign: '-' as const, text: `localPort = ${removing.localPort}` }]
    : [{ sign: '+' as const, text: '[[proxies]]' }, { sign: '+' as const, text: `name = "${m.name}"` }, { sign: '+' as const, text: `type = "${m.kind}"` }, { sign: '+' as const, text: `localPort = ${m.localPort}` }, ...(m.kind === 'tcp' ? [{ sign: '+' as const, text: `remotePort = ${m.remotePort}` }] : [])]
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={removing ? `解除映射 ${removing.name}` : `为 ${conn.name} 添加映射`}
      footer={step === 'form' ? <><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => { setTouched(true); if (ok) setStep('preview') }}>预览变更</Button></> : <>
        <Button onClick={() => (removing ? onClose() : setStep('form'))}>{removing ? '取消' : '返回修改'}</Button>
        <Button variant={removing ? 'danger-solid' : 'primary'} onClick={() => {
          runOperation({ kind: 'frp', label: removing ? 'FRP 解除映射' : 'FRP 映射变更', target: { type: 'frp', id: conn.id, name: conn.name }, steps: ['写入服务端配置', '写入客户端配置', '重载并探测'], outcome, durationMs: 1800,
            onSuccess: (d) => ({ ...d, frp: d.frp.map((x) => x.id !== conn.id ? x : { ...x, mappings: removing ? x.mappings.filter((y) => y.id !== removing.id) : [...x.mappings, { id: 'm' + Date.now(), name: m.name, kind: m.kind, localPort: +m.localPort, remotePort: m.kind === 'tcp' ? +m.remotePort : undefined, visitorPort: m.kind === 'stcp' ? 16000 + x.mappings.length : undefined }] }) }) })
          onClose(); go('/operations')
        }}>{removing ? '解除映射' : '确认变更'}</Button>
      </>}>
      {step === 'form' ? (
        <>
          <Field label="映射类型"><Segmented label="映射类型" value={m.kind} onValueChange={(v) => setM({ ...m, kind: v as 'tcp' | 'stcp' })} options={[{ value: 'tcp', label: 'TCP（公开端口）' }, { value: 'stcp', label: 'STCP（仅 visitor）' }]} /></Field>
          <Field label="名称" required error={touched ? err.name : undefined}><Input mono value={m.name} onChange={(e) => setM({ ...m, name: e.target.value.trim() })} placeholder="nas-web" /></Field>
          <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="客户端本地端口" required error={touched ? err.local : undefined}><Input mono inputMode="numeric" value={m.localPort} onChange={(e) => setM({ ...m, localPort: e.target.value })} /></Field>
            {m.kind === 'tcp' ? <Field label="服务端公开端口" required error={touched ? err.remote : undefined}><Input mono inputMode="numeric" value={m.remotePort} onChange={(e) => setM({ ...m, remotePort: e.target.value })} /></Field>
              : <Field label="visitor 端口" hint="自动分配，仅服务端本机 127.0.0.1 可访问。"><Input mono disabled value="自动" /></Field>}
          </div>
        </>
      ) : (
        <>
          <section><SectionLabel>客户端配置差异</SectionLabel><Diff label="配置差异" lines={lines} /></section>
          <Callout tone="warn">两端会重载 FRP，现有连接可能短暂中断。</Callout>
          {!removing && m.kind === 'tcp' && !fwOpen && <Callout tone="info">服务端防火墙尚未放行 {m.remotePort}/tcp；映射生效后外部仍无法访问。<a href={href('/firewall')}>前往防火墙</a></Callout>}
          <div className="row" style={{ borderTop: '1px dashed var(--color-border-strong)', paddingTop: 12 }}>
            <span className="ds-hint grow">原型控制：模拟结果</span>
            <Segmented label="模拟结果" value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)} options={[{ value: 'success', label: '成功' }, { value: 'unknown', label: '结果未知' }]} />
          </div>
          <Status tone="neutral">执行后可在操作记录查看进度</Status>
        </>
      )}
    </Dialog>
  )
}
