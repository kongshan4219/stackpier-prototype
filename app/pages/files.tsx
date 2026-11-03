import { useState } from 'react'
import { Badge, Button, Callout, Dialog, Empty, Field, Input, KeyValue, Panel, SearchInput, Segmented, useToast } from '../ds'
import { PageHeader } from '../shell'
import { useDB, mutate } from '../data/store'
import type { FileAsset } from '../data/model'
import { href, shortHash, size, time } from '../lib'
import { LoadGate } from './common'

const kindText = { program: '程序', config: '配置文件', other: '其他' }

export function Files() {
  const db = useDB((d) => d)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [upload, setUpload] = useState<FileAsset | 'new' | null>(null)
  const [detail, setDetail] = useState<FileAsset | null>(null)
  const rows = db.files.filter((f) => (kind === 'all' || f.kind === kind) && (!q || f.name.includes(q)))
  const refs = (f: FileAsset) => db.configurations.filter((c) => (c.systemd?.mappings ?? c.compose?.mappings ?? []).some((m) => m.local.startsWith(`files/${f.name}@`)) || c.frp?.programId === f.id)
  return (
    <div className="page">
      <PageHeader title="文件" sub="上传的程序与配置文件。每次上传生成不可修改的新版本；已有项目不会自动更新。" actions={<Button variant="primary" icon="upload" onClick={() => setUpload('new')}>上传文件</Button>} />
      <LoadGate id="files" skeleton>{() => (
        <>
          <div className="toolbar">
            <Segmented label="按类型筛选" value={kind} onValueChange={setKind} options={[{ value: 'all', label: '全部' }, { value: 'program', label: '程序' }, { value: 'config', label: '配置文件' }]} />
            <SearchInput placeholder="搜索文件名" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜索文件" />
          </div>
          <Panel flush>
            {!db.files.length ? <Empty icon="file" title="还没有文件" actions={<Button variant="primary" onClick={() => setUpload('new')}>上传文件</Button>}>上传程序或配置文件后，可在部署配置中引用指定版本。</Empty>
              : !rows.length ? <Empty icon="search" title="没有匹配的文件" /> : (
              <div className="ds-table-wrap"><table className="ds-table">
                <thead><tr><th>文件</th><th>最新版本</th><th>摘要</th><th>大小</th><th>被引用</th><th data-align="end"><span className="sr-only">操作</span></th></tr></thead>
                <tbody>{rows.map((f) => {
                  const v = f.versions[0]; const r = refs(f)
                  return (
                    <tr key={f.id}>
                      <td><button className="ds-cell-title mono" style={{ all: 'unset', cursor: 'pointer', fontWeight: 500 }} onClick={() => setDetail(f)}>{f.name}</button><div className="ds-cell-sub">{kindText[f.kind]}{v.arch ? ` · ${v.arch}` : ''}</div></td>
                      <td>修订 {v.revision}<div className="ds-cell-sub">{time(v.createdAt)}{f.versions.length > 1 ? ` · 共 ${f.versions.length} 个版本` : ''}</div></td>
                      <td className="ds-hash">{shortHash(v.sha256)}</td>
                      <td data-num className="nowrap">{size(v.size)}</td>
                      <td>{r.length ? r.map((c) => <div key={c.id}><a href={href(`/configurations/${c.id}`)}>{c.name}</a></div>) : <span className="muted">—</span>}</td>
                      <td data-align="end"><Button size="sm" onClick={() => setUpload(f)}>上传新版本</Button></td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
            )}
          </Panel>
        </>
      )}</LoadGate>
      <UploadDialog target={upload} onClose={() => setUpload(null)} />
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)} title={detail?.name ?? ''} description={detail ? kindText[detail.kind] : ''} size="lg">
        {detail && <div className="ds-table-wrap" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}><table className="ds-table">
          <thead><tr><th>修订</th><th>SHA-256</th><th>大小</th><th>上传</th><th>说明</th></tr></thead>
          <tbody>{detail.versions.map((v) => <tr key={v.revision}><td>{v.revision}</td><td className="ds-hash" style={{ wordBreak: 'break-all', minWidth: 240 }}>{v.sha256}</td><td className="nowrap">{size(v.size)}</td><td className="nowrap">{time(v.createdAt)}</td><td>{v.note ?? '—'}</td></tr>)}</tbody>
        </table></div>}
      </Dialog>
    </div>
  )
}

function UploadDialog({ target, onClose }: { target: FileAsset | 'new' | null; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const existing = target && target !== 'new' ? target : null
  const nameMismatch = existing && file && file.name !== existing.name
  const submit = () => {
    if (!file) return
    setBusy(true)
    setTimeout(() => {
      mutate((d) => {
        const v = { revision: (existing?.versions[0].revision ?? 0) + 1, sha256: 'f'.repeat(64), size: file.size, arch: /\.(json|ya?ml|conf|toml)$/.test(file.name) ? undefined : 'x86_64', createdAt: new Date().toISOString(), note: note || undefined }
        return existing
          ? { ...d, files: d.files.map((f) => (f.id === existing.id ? { ...f, versions: [v, ...f.versions] } : f)) }
          : { ...d, files: [...d.files, { id: 'f-' + Date.now(), name: file.name, kind: v.arch ? 'program' : 'config', versions: [v] }] }
      })
      setBusy(false); setFile(null); setNote(''); onClose()
      toast({ title: `已上传 ${file.name}`, body: '读取的是本地文件大小；摘要为模拟值。', tone: 'ok' })
    }, 900)
  }
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()} dismissible={!busy} title={existing ? `上传 ${existing.name} 的新版本` : '上传文件'}
      description={existing ? `将成为修订 ${existing.versions[0].revision + 1}；引用旧版本的配置不变。` : '上传后生成修订 1。'}
      footer={<><Button onClick={onClose} disabled={busy}>取消</Button><Button variant="primary" busy={busy} disabled={!file} onClick={submit}>上传</Button></>}>
      <Field label="文件" required hint="在浏览器内读取，原型不会发送到任何地方。"><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      {file && <KeyValue items={[['文件名', file.name, { mono: true }], ['大小', size(file.size)]]} />}
      {nameMismatch && <Callout tone="warn">所选文件名为 <span className="mono">{file!.name}</span>，与 <span className="mono">{existing!.name}</span> 不同。仍会作为 {existing!.name} 的新版本保存。</Callout>}
      <Field label="版本说明"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选，例如 修复启动参数" /></Field>
      <Badge>原型：摘要为模拟值</Badge>
    </Dialog>
  )
}
