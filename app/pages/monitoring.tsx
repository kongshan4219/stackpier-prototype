import { useState } from 'react'
import { Badge, Button, Callout, Dialog, Empty, Field, Input, Menu, Panel, Status, Switch, Tabs, TabPanel, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, mutate } from '../data/store'
import type { Channel } from '../data/model'
import { href, time } from '../lib'
import { LoadGate, Runtime } from './common'

export function Monitoring() {
  const db = useDB((d) => d)
  const [tab, setTab] = useState('projects')
  const [channel, setChannel] = useState<Channel | 'new' | null>(null)
  const toast = useToast()
  const name = (id: string) => db.projects.find((p) => p.id === id)?.name ?? '已卸载的项目'
  return (
    <div className="page">
      <PageHeader title="巡检与通知" sub="定时观测受管服务；状态变为异常或恢复时通过 Webhook 通知。" />
      <LoadGate id="monitoring" skeleton>{() => (
        <Tabs label="巡检分类" value={tab} onValueChange={setTab} tabs={[{ value: 'projects', label: '项目巡检' }, { value: 'events', label: '异常与恢复' }, { value: 'channels', label: '通知渠道' }]}>
          <TabPanel value="projects">
            <Panel flush>
              {!db.projects.length ? <Empty icon="monitor" title="还没有项目">部署项目后可在这里开启巡检。</Empty> : (
                <div className="ds-table-wrap"><table className="ds-table">
                  <thead><tr><th>项目</th><th>最近观测</th><th>方式</th><th>周期</th><th>巡检</th></tr></thead>
                  <tbody>{db.projects.map((p) => (
                    <tr key={p.id}>
                      <td><a className="ds-cell-title" href={href(`/projects/${p.id}/monitoring`)}>{p.name}</a></td>
                      <td><Runtime p={p} /><div className="ds-cell-sub">{p.runtime.detail ?? time(p.runtime.observedAt)}</div></td>
                      <td>{p.monitor.method}</td>
                      <td>每 {p.monitor.intervalMin} 分钟</td>
                      <td><Switch label={`${p.name} 定时巡检`} checked={p.monitor.enabled} onCheckedChange={(v) => mutate((d) => ({ ...d, projects: d.projects.map((x) => x.id === p.id ? { ...x, monitor: { ...x.monitor, enabled: v } } : x) }))} /></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </Panel>
          </TabPanel>
          <TabPanel value="events">
            <Panel flush>
              {db.events.length ? <ul className="ds-list">{db.events.map((e) => (
                <li key={e.id}><Status tone={e.kind === 'abnormal' ? 'danger' : 'ok'}>{e.kind === 'abnormal' ? '异常' : '恢复'}</Status>
                  <div className="main"><span className="ds-cell-title">{name(e.projectId)} · {e.detail}</span><span className="ds-cell-sub">{time(e.at)}</span></div>
                  {e.delivered ? <Badge tone="ok">已送达</Badge> : <Badge tone="warn">未送达</Badge>}</li>
              ))}</ul> : <Empty icon="check" title="没有异常记录" />}
            </Panel>
          </TabPanel>
          <TabPanel value="channels">
            <div className="stack">
              <Callout tone="info">渠道收到 HTTP 2xx 即记为已送达；下游是否真正收到消息由接收方决定。</Callout>
              <Panel flush title="Webhook" actions={<Button size="sm" variant="primary" icon="plus" onClick={() => setChannel('new')}>添加渠道</Button>}>
                {db.channels.length ? <ul className="ds-list">{db.channels.map((c) => (
                  <li key={c.id}>
                    <div className="main"><span className="ds-cell-title">{c.name}</span><span className="ds-cell-sub mono">{c.url}</span>
                      {c.lastDelivery && <span className="ds-cell-sub">最近投递 {time(c.lastDelivery.at)} · {c.lastDelivery.status}</span>}</div>
                    <Switch label={`启用 ${c.name}`} checked={c.enabled} onCheckedChange={(v) => mutate((d) => ({ ...d, channels: d.channels.map((x) => x.id === c.id ? { ...x, enabled: v } : x) }))} />
                    <Menu label={`${c.name} 操作`} items={[
                      { label: '发送测试', icon: 'bell', onSelect: () => toast({ title: '测试消息已发送', body: '对方返回 HTTP 200（模拟）。', tone: 'ok' }) },
                      { label: '编辑', icon: 'edit', onSelect: () => setChannel(c) },
                      { label: '删除', icon: 'trash', tone: 'danger', separatorBefore: true, onSelect: () => mutate((d) => ({ ...d, channels: d.channels.filter((x) => x.id !== c.id) })) },
                    ]} />
                  </li>
                ))}</ul> : <Empty icon="bell" title="还没有通知渠道">异常和恢复只记录在历史中，不会发送通知。</Empty>}
              </Panel>
            </div>
          </TabPanel>
        </Tabs>
      )}</LoadGate>
      {channel && <ChannelDialog channel={channel === 'new' ? undefined : channel} onClose={() => setChannel(null)} />}
    </div>
  )
}

function ChannelDialog({ channel, onClose }: { channel?: Channel; onClose: () => void }) {
  const [name, setName] = useState(channel?.name ?? '')
  const [url, setUrl] = useState('')
  const [touched, setTouched] = useState(false)
  const err = { name: !name ? '填写名称。' : undefined, url: !channel && !url ? '填写地址。' : url && !/^https?:\/\/[^\s/]+\.[^\s]+/.test(url) ? '需要公网可访问的 http(s) 地址。' : undefined }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} size="sm" title={channel ? '编辑渠道' : '添加 Webhook 渠道'}
      footer={<><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={() => {
        setTouched(true); if (err.name || err.url) return
        mutate((d) => ({ ...d, channels: channel ? d.channels.map((x) => x.id === channel.id ? { ...x, name, url: url ? url.replace(/(\/\/[^/]+\/).*/, '$1…') : x.url } : x) : [...d.channels, { id: 'ch' + Date.now(), name, kind: 'webhook', url: url.replace(/(\/\/[^/]+\/).*/, '$1…'), enabled: true }] }))
        onClose()
      }}>保存</Button></>}>
      <Field label="名称" required error={touched ? err.name : undefined}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Webhook 地址" required={!channel} error={touched ? err.url : undefined} hint={channel ? '留空保留已保存的地址；地址含密钥，保存后不完整回显。' : '地址含密钥，保存后不完整回显。'}>
        <Input mono type="url" value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://hooks.example.test/…" autoComplete="off" />
      </Field>
    </Dialog>
  )
}
