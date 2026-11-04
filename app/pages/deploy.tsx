import { useEffect, useState } from 'react'
import { Button, Callout, ChoiceGroup, ConfirmDialog, Consequences, Dialog, Field, Input, KeyValue, SectionLabel, Segmented, Select, Steps } from '../ds'
import { useDB, deployProject } from '../data/store'
import type { DeployType } from '../data/model'
import { endpoint, href, shortHash, size, time, typeText } from '../lib'
import { OpStatus } from './common'

const steps = ['选择类型', '填写部署', '核对预览', '执行']
const NAME = /^[a-z][a-z0-9-]{1,30}$/

export function DeployDialog({ open, onOpenChange, preset }: {
  open: boolean; onOpenChange: (v: boolean) => void; preset?: { type?: DeployType; configurationId?: string; serverId?: string; name?: string }
}) {
  const db = useDB((d) => d)
  const [step, setStep] = useState(0)
  const [type, setType] = useState<DeployType | undefined>()
  const [serverId, setServerId] = useState('')
  const [name, setName] = useState('')
  const [configurationId, setConfigurationId] = useState('')
  const [touched, setTouched] = useState(false)
  const [outcome, setOutcome] = useState<'success' | 'failed' | 'unknown'>('success')
  const [opId, setOpId] = useState<string>()
  const [overwrite, setOverwrite] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(preset?.type ? 1 : 0); setType(preset?.type); setConfigurationId(preset?.configurationId ?? '')
    setServerId(preset?.serverId ?? ''); setName(preset?.name ?? ''); setOverwrite(false); setTouched(false); setOpId(undefined); setOutcome('success')
  }, [open, preset?.type, preset?.configurationId, preset?.serverId, preset?.name])

  const configs = db.configurations.filter((c) => c.type === type)
  const cfg = db.configurations.find((c) => c.id === configurationId)
  const srv = db.servers.find((s) => s.id === serverId)
  const op = db.operations.find((o) => o.id === opId)
  const nameError = !name ? '填写服务名称。' : !NAME.test(name) ? '以小写字母开头，只用小写字母、数字和连字符，2–31 个字符。'
    : db.projects.some((p) => p.serverId === serverId && p.name === name && (type !== 'systemd' || p.type !== 'systemd')) ? `${srv?.name} 上已有同名项目。` : undefined
  const errors = { server: !serverId ? '选择目标服务器。' : undefined, name: nameError, cfg: !configurationId ? '选择部署配置。' : undefined }
  const valid = !errors.server && !errors.name && !errors.cfg
  const existing = db.projects.find((p) => p.serverId === serverId && p.name === name && p.type === 'systemd')
  function execute() { setOverwrite(false); setOpId(deployProject({ type: type!, serverId, name, configurationId, outcome })); setStep(3) }
  const running = op?.result === 'running'

  const files = cfg?.systemd?.mappings ?? cfg?.compose?.mappings ?? []
  const footer = step === 0 ? <>
      <Button onClick={() => onOpenChange(false)}>取消</Button>
      <Button variant="primary" disabled={!type} onClick={() => setStep(1)}>下一步</Button>
    </> : step === 1 ? <>
      <Button onClick={() => setStep(0)}>上一步</Button>
      <Button variant="primary" icon="search" onClick={() => { setTouched(true); if (valid) setStep(2) }}>检查并预览</Button>
    </> : step === 2 ? <>
      <Button onClick={() => setStep(1)}>返回修改</Button>
      <Button variant="primary" onClick={() => existing && type === 'systemd' ? setOverwrite(true) : execute()}>确认部署</Button>
    </> : <>
      {op?.result === 'success' && <Button variant="primary" onClick={() => { onOpenChange(false); location.hash = `/projects/${existing?.id ?? `p-${name}`}` }}>查看项目</Button>}
      {op?.result === 'unknown' && <Button variant="primary" onClick={() => { onOpenChange(false); location.hash = `/operations/${op.id}` }}>核对原操作</Button>}
      {op?.result === 'failed' && <Button onClick={() => { onOpenChange(false); location.hash = `/operations/${op.id}` }}>查看操作详情</Button>}
      <Button onClick={() => onOpenChange(false)} disabled={running}>{running ? '执行中…' : '关闭'}</Button>
    </>

  return (
    <><ConfirmDialog open={overwrite} onOpenChange={setOverwrite} title="项目已部署，是否继续覆盖？" confirmLabel="继续并覆盖" variant="danger" onConfirm={execute}>继续后将停止服务，覆盖服务正文和映射，再启动并核验运行状态。目录映射会删除目标目录内多余内容；取消不会修改服务器。</ConfirmDialog>
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={!running} size="md"
      title={step === 3 ? `部署 ${name}` : '部署项目'}
      description={<Steps steps={steps} current={step} />}
      note={step === 2 ? `预览生成于 ${time(new Date().toISOString())}` : undefined}
      footer={footer}>
      {step === 0 && (
        <ChoiceGroup label="部署类型" value={type} onValueChange={(v) => { setType(v as DeployType); setConfigurationId('') }} options={[
          { value: 'systemd', icon: 'systemd', title: 'systemd 服务', description: '单个常驻程序，按服务单元正文与文件映射部署。' },
          { value: 'compose', icon: 'compose', title: 'Docker Compose', description: '多容器服务，按 YAML、变量与目录映射部署。' },
          { value: 'frp', icon: 'frp', title: 'FRP', description: '服务端或客户端程序；连接与端口映射在 FRP 页面管理。' },
        ]} />
      )}
      {step === 1 && type && (
        <>
          <Field label="目标服务器" required error={touched ? errors.server : undefined}>
            <Select value={serverId} onValueChange={setServerId} placeholder="选择服务器"
              options={db.servers.map((s) => ({ value: s.id, label: s.name, hint: endpoint(s) + (s.observation.state !== 'ok' ? ' · 最近检查异常' : ''), disabled: false }))} />
          </Field>
          <Field label="服务名称" required error={touched ? errors.name : undefined} hint="用于服务单元名与管理目录，部署后不可修改。">
            <Input mono value={name} onChange={(e) => setName(e.target.value.trim())} placeholder="例如 notes-api" autoComplete="off" />
          </Field>
          {configs.length ? (
            <Field label={`${typeText[type]} 部署配置`} required error={touched ? errors.cfg : undefined}
              hint={<>正文、变量和文件在部署配置中维护。<a href={href(configurationId ? `/configurations/${configurationId}` : `/configurations/new?type=${type}`)} onClick={() => onOpenChange(false)}>{configurationId ? '编辑所选配置' : '新建配置'}</a></>}>
              <Select value={configurationId} onValueChange={setConfigurationId} placeholder="选择配置"
                options={configs.map((c) => ({ value: c.id, label: c.name, hint: `修订 ${c.revision} · ${time(c.updatedAt)} 保存` }))} />
            </Field>
          ) : (
            <Callout tone="info" title={`还没有 ${typeText[type]} 配置`} actions={<Button onClick={() => { onOpenChange(false); location.hash = `/configurations/new?type=${type}` }}>新建配置</Button>}>
              先保存一份配置，再回到这里部署。
            </Callout>
          )}
          {srv && srv.observation.state !== 'ok' && <Callout tone="warn" title={`${srv.name} 最近一次检查：认证失败`}>可以继续预览，但执行很可能失败。建议先在服务器页更新凭据。</Callout>}
        </>
      )}
      {step === 2 && cfg && srv && (
        <>
          <section><SectionLabel>目标</SectionLabel>
            <KeyValue items={[
              ['服务器', <>{srv.name} · <span className="mono">{endpoint(srv)}</span></>],
              ['主机指纹', srv.fingerprint, { mono: true }],
              ['管理目录', `/opt/stackpier/${name}`, { mono: true }],
              ...(type !== 'compose' ? [['服务单元', `stackpier-${name}.service`, { mono: true }] as [string, string, { mono: boolean }]] : []),
            ]} />
          </section>
          <section><SectionLabel>配置 · {cfg.name} · 修订 {cfg.revision}</SectionLabel>
            {files.length ? (
              <ul className="ds-list" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                {files.map((m) => {
                  const f = db.files.find((x) => m.local.startsWith('files/' + x.name + '@'))
                  const v = f?.versions[0]
                  return (
                    <li key={m.remote}>
                      <div className="main"><span className="mono">{m.remote}</span><span className="ds-cell-sub">{f ? `${f.name} 修订 ${m.local.split('@')[1]}` : `本机 ${m.local}`}{m.kind === 'dir' ? ' · 目录完全同步' : ''}</span></div>
                      {v && <span className="ds-hash desktop-only">{shortHash(v.sha256)}</span>}
                      {v && <span className="muted nowrap">{size(v.size)}</span>}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="muted">此配置没有文件映射。</p>}
          </section>
          <section><SectionLabel>确认后</SectionLabel>
            <Consequences items={[
              { text: type === 'compose' ? '同步映射目录（远端多余文件会被删除），然后拉起全部服务。' : '上传文件并写入服务单元，启动后核验运行状态。' },
              { text: '全部核验成功后才创建项目；之后修改部署配置不会自动更新它。' },
              { text: '确认前若配置被再次保存，需要重新预览。', tone: 'warn' },
            ]} />
          </section>
          <div className="row" style={{ borderTop: '1px dashed var(--color-border-strong)', paddingTop: 12 }}>
            <span className="ds-hint grow">原型控制：选择模拟结果</span>
            <Segmented label="模拟结果" value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)} options={[{ value: 'success', label: '成功' }, { value: 'failed', label: '失败' }, { value: 'unknown', label: '结果未知' }]} />
          </div>
        </>
      )}
      {step === 3 && op && (
        <>
          <div className="row" data-justify="between"><span className="secondary">操作 <span className="mono">{op.id}</span></span><OpStatus r={op.result} /></div>
          <ol className="ds-list" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} aria-label="执行步骤">
            {op.steps.map((s) => (
              <li key={s.label}>
                <div className="main">{s.label}</div>
                <span className="ds-status" data-tone={{ done: 'ok', failed: 'danger', unknown: 'warn', running: 'progress', pending: 'neutral', skipped: 'neutral' }[s.state]}>
                  {{ done: '完成', failed: '失败', unknown: '未知', running: '进行中', pending: '等待', skipped: '跳过' }[s.state]}
                </span>
              </li>
            ))}
          </ol>
          {op.result === 'running' && <p className="ds-hint" role="status">执行中，关闭此窗口不会中断操作；进度在操作记录中可见。</p>}
          {op.result === 'success' && <Callout tone="ok" title="部署完成" live>项目已创建并处于运行中。</Callout>}
          {op.result === 'failed' && <Callout tone="danger" title="部署失败，未创建项目" live>{op.facts} 已上传的文件保留在管理目录，可在操作详情查看并清理。</Callout>}
          {op.result === 'unknown' && <Callout tone="warn" title="结果未知" live>{op.facts} 不要重新部署；先核对原操作，确认服务器上的实际结果。</Callout>}
        </>
      )}
    </Dialog></>
  )
}
