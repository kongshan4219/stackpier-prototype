import { Badge, Button, Empty, KeyValue, Panel, Switch } from '../ds'
import { PageHeader } from '../shell'
import { useDB, mutate } from '../data/store'
import { go, href } from '../lib'
import { LoadGate } from './common'

export function Settings() {
  const db = useDB((d) => d)
  return (
    <div className="page">
      <PageHeader title="设置" sub="通知行为、外部连接、SSH 凭据与实例信息。" />
      <LoadGate id="settings">{() => (
        <div className="split">
          <div className="stack">
            <Panel title="通知行为">
              <div className="stack">
                <div className="row" data-justify="between"><span>项目变为异常时通知</span><Switch label="异常时通知" checked={db.settings.notifyOn.abnormal} onCheckedChange={(v) => mutate((d) => ({ ...d, settings: { ...d.settings, notifyOn: { ...d.settings.notifyOn, abnormal: v } } }))} /></div>
                <div className="row" data-justify="between"><span>从异常恢复时通知</span><Switch label="恢复时通知" checked={db.settings.notifyOn.recovered} onCheckedChange={(v) => mutate((d) => ({ ...d, settings: { ...d.settings, notifyOn: { ...d.settings.notifyOn, recovered: v } } }))} /></div>
                <a href={href('/monitoring')}>管理通知渠道</a>
              </div>
            </Panel>
            <Panel title="Cloudflare" actions={<Button size="sm" onClick={() => go('/dns')}>{db.cloudflare ? '管理连接' : '连接'}</Button>}>
              {db.cloudflare ? <KeyValue items={[['账号', db.cloudflare.account], ['Token', db.cloudflare.tokenHint, { mono: true }]]} /> : <p className="muted">未连接。</p>}
            </Panel>
            <Panel title="实例">
              <KeyValue items={[['版本', db.settings.instance.version], ['监听地址', db.settings.instance.listen, { mono: true }], ['数据目录', db.settings.instance.dataDir, { mono: true }]]} />
            </Panel>
          </div>
          <Panel title="SSH 凭据" flush description="正文保存在管理端数据库，不回显。">
            {db.credentials.length ? <ul className="ds-list">{db.credentials.map((c) => (
              <li key={c.id}><div className="main"><span className="ds-cell-title">{c.name}</span><span className="ds-cell-sub">{c.kind === 'key' ? '私钥' : '密码'} · 修订 {c.revision}</span></div><Badge>{c.usedBy} 台服务器</Badge></li>
            ))}</ul> : <Empty icon="key" title="还没有凭据">接入服务器时创建。</Empty>}
          </Panel>
        </div>
      )}</LoadGate>
    </div>
  )
}
