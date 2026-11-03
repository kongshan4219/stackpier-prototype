import { useState, type ReactNode } from 'react'
import {
  Badge, Button, ButtonGroup, Callout, Checkbox, ChoiceGroup, Code, ConfirmDialog, Consequences, Count, Dialog, Diff, Empty, Fact, Facts, Field, Input,
  KeyValue, Loading, Menu, Panel, SearchInput, Segmented, Select, SkeletonRows, Spinner, Status, Steps, Switch, Tabs, TabPanel, Textarea, Tooltip, useToast,
} from '../ds'
import { PageHeader } from '../shell'

const colors = ['bg', 'bg-subtle', 'surface', 'surface-sunken', 'hover', 'selected', 'border', 'border-strong', 'text', 'text-secondary', 'text-tertiary', 'accent', 'accent-subtle', 'ok', 'ok-bg', 'warn', 'warn-bg', 'danger', 'danger-bg', 'info', 'neutral']

function Spec({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return <Panel title={title} description={note}><div className="stack">{children}</div></Panel>
}

export function DesignSystem() {
  const [dialog, setDialog] = useState<null | 'form' | 'confirm'>(null)
  const [tab, setTab] = useState('a')
  const [seg, setSeg] = useState('list')
  const [choice, setChoice] = useState('systemd')
  const [chk, setChk] = useState(true)
  const [sel, setSel] = useState('')
  const toast = useToast()
  return (
    <div className="page">
      <PageHeader title="设计系统 · 精密控制台" sub="栈桥原型使用的 Token 与组件。切换右上角主题检查深色。" />
      <Spec title="原则">
        <Consequences items={[
          { text: '对象身份（名称 + 地址 / 路径 / 修订）始终可见，标识用等宽。' },
          { text: '状态 = 颜色 + 形状 + 文字；结果未知用菱形，与成功 / 失败区分。' },
          { text: '有后果的操作先展示影响、再确认；危险操作与普通操作分开。' },
          { text: '需要核对的结果留在页面上（Callout），只有短暂确认用 Toast。' },
          { text: '高密度：13px 正文、30px 控件、细线分隔、无投影；窄屏控件至少 40px。' },
        ]} />
      </Spec>
      <Spec title="颜色" note="语义 Token，组件不使用原始色值。">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
          {colors.map((c) => <div key={c} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ height: 32, background: `var(--color-${c})` }} /><div className="mono" style={{ padding: '4px 8px', fontSize: 11 }}>--color-{c}</div></div>)}
        </div>
      </Spec>
      <Spec title="字体与间距">
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>页面标题 20 / 600</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>弹窗标题 15 / 600</div>
        <div style={{ fontWeight: 600 }}>分区标题 13 / 600</div>
        <div>正文 13 / 1.5：先核对原操作，确认服务器上的实际结果后再决定下一步。</div>
        <div className="muted" style={{ fontSize: 12 }}>辅助 12：观测于 11-03 10:30</div>
        <div className="mono">等宽：SHA256:Qm9vdC1lZGdl · /opt/stackpier/sample-agent</div>
        <div className="row">{[4, 8, 12, 16, 24, 32].map((s) => <div key={s} style={{ width: s, height: s, background: 'var(--color-accent)' }} title={`${s}px`} />)}<span className="muted">4px 网格</span></div>
      </Spec>
      <Spec title="Button">
        <div className="row"><Button variant="primary">检查并预览</Button><Button>取消</Button><Button variant="ghost">查看配置</Button><Button variant="danger">完整卸载…</Button><Button variant="danger-solid">永久卸载</Button><Button disabled>不可用</Button><Button busy>保存中</Button></div>
        <div className="row"><Button size="sm" icon="plus">小号</Button><Button icon="refresh" label="刷新" /><Button size="lg" variant="primary">大号</Button>
          <ButtonGroup label="服务操作"><Button icon="play">启动</Button><Button icon="stop">停止</Button><Button icon="restart">重启</Button></ButtonGroup>
          <Menu label="更多操作" items={[{ label: '核对文件', icon: 'search', onSelect: () => {} }, { label: '完整卸载…', icon: 'trash', tone: 'danger', separatorBefore: true, onSelect: () => {} }]} />
          <Tooltip content="提示文字"><Button variant="ghost" icon="info" label="带提示" /></Tooltip></div>
      </Spec>
      <Spec title="Status · Badge · Count">
        <div className="row" style={{ gap: 18 }}><Status tone="ok">运行中</Status><Status tone="warn">结果未知</Status><Status tone="danger">失败</Status><Status tone="progress">进行中</Status><Status tone="neutral">已停止</Status><Status tone="unknown">未观测</Status></div>
        <div className="row"><Badge mono>systemd</Badge><Badge tone="accent">已代理</Badge><Badge tone="warn">草稿</Badge><Badge tone="danger">2</Badge><Badge tone="ok">已送达</Badge><Count n={3} label="3 项" /><Spinner label="读取中" /></div>
      </Spec>
      <Spec title="表单">
        <div className="split">
          <div className="stack">
            <Field label="服务名称" required hint="部署后不可修改。"><Input mono defaultValue="notes-api" /></Field>
            <Field label="服务端公开端口" required error="端口 15000 已被映射 nas-web 使用。"><Input mono defaultValue="15000" /></Field>
            <Field label="目标服务器"><Select value={sel} onValueChange={setSel} placeholder="选择服务器" options={[{ value: 'a', label: '边缘节点', hint: 'deploy@192.0.2.24:22' }, { value: 'b', label: '家庭 NAS', hint: '最近检查异常' }]} /></Field>
            <SearchInput placeholder="搜索" aria-label="搜索示例" />
          </div>
          <div className="stack">
            <Field label="正文"><Textarea mono rows={4} defaultValue={'[Service]\nExecStart=/opt/app/bin/app'} /></Field>
            <Checkbox checked={chk} onCheckedChange={setChk}>通过 sudo 执行</Checkbox>
            <div className="row"><Switch label="定时巡检" checked={chk} onCheckedChange={setChk} /><span>定时巡检</span></div>
            <Segmented label="视图" value={seg} onValueChange={setSeg} options={[{ value: 'list', label: '列表' }, { value: 'card', label: '卡片' }]} />
          </div>
        </div>
        <ChoiceGroup label="部署类型" value={choice} onValueChange={setChoice} options={[{ value: 'systemd', icon: 'systemd', title: 'systemd 服务', description: '单个常驻程序。' }, { value: 'compose', icon: 'compose', title: 'Docker Compose', description: '多容器服务。' }]} />
      </Spec>
      <Spec title="Callout · Toast">
        <Callout tone="warn" title="部署结果未知" actions={<Button>核对原操作</Button>}>连接中断，未收到最后一步的结果。不要直接重试。</Callout>
        <Callout tone="danger" title="读取失败" actions={<Button icon="refresh">重试</Button>}>管理端没有返回数据。</Callout>
        <Callout tone="info">保存不会更新已部署的项目。</Callout>
        <Callout tone="ok" title="部署完成">项目已创建并处于运行中。</Callout>
        <div><Button onClick={() => toast({ title: '已提交重启', body: '结果会显示在操作记录中。', tone: 'info' })}>显示 Toast</Button></div>
      </Spec>
      <Spec title="Facts · KeyValue · Steps">
        <Facts label="示例"><Fact k="实际运行" v={<Status tone="ok">运行中</Status>} s="观测于 10:30" /><Fact k="配置" v="修订 3" s="服务标准配置" /><Fact k="服务器" v="3" large s="1 台异常" /><Fact k="巡检" v="每 5 分钟" /><Fact k="最近操作" wide v={<Status tone="warn">结果未知</Status>} s="部署" /></Facts>
        <KeyValue items={[['连接目标', 'deploy@192.0.2.24:22', { mono: true }], ['卸载范围', '专属文件完整清理；共享资源保留']]} />
        <Steps steps={['选择类型', '填写部署', '核对预览', '执行']} current={2} />
      </Spec>
      <Spec title="Table · List">
        <Panel flush><div className="ds-table-wrap"><table className="ds-table"><thead><tr><th>服务器</th><th>连接</th><th>项目</th></tr></thead><tbody>
          <tr><td><span className="ds-cell-title">边缘节点</span><div className="ds-cell-sub mono">deploy@192.0.2.24:22</div></td><td><Status tone="ok">连接正常</Status></td><td data-num>2</td></tr>
          <tr><td><span className="ds-cell-title">备用节点（名称很长用于检查换行与截断行为的服务器）</span><div className="ds-cell-sub mono">ops@203.0.113.90:22</div></td><td><Status tone="danger">认证失败</Status></td><td data-num>0</td></tr>
        </tbody></table></div></Panel>
      </Spec>
      <Spec title="Code · Diff">
        <Code label="日志">{'10:30:00 systemd[1]: Started stackpier-sample-agent.service.\n10:30:02 sample-agent[2148]: listening on 0.0.0.0:18080'}</Code>
        <Diff label="差异" lines={[{ sign: ' ', text: '[[proxies]]' }, { sign: '-', text: 'remotePort = 15000' }, { sign: '+', text: 'remotePort = 15080' }]} />
      </Spec>
      <Spec title="Tabs · 空 / 读取中 / 骨架">
        <Tabs label="示例" value={tab} onValueChange={setTab} tabs={[{ value: 'a', label: '空状态' }, { value: 'b', label: '读取中' }, { value: 'c', label: '骨架' }]}>
          <TabPanel value="a"><Empty icon="project" title="还没有项目" actions={<Button variant="primary">部署项目</Button>}>选择服务器和部署配置即可部署。</Empty></TabPanel>
          <TabPanel value="b"><Loading /></TabPanel>
          <TabPanel value="c"><SkeletonRows rows={4} /></TabPanel>
        </Tabs>
      </Spec>
      <Spec title="Dialog">
        <div className="row"><Button onClick={() => setDialog('form')}>表单弹窗</Button><Button variant="danger" onClick={() => setDialog('confirm')}>确认弹窗</Button></div>
      </Spec>
      <Dialog open={dialog === 'form'} onOpenChange={() => setDialog(null)} title="添加记录" description="example.test" note="说明文字" footer={<><Button onClick={() => setDialog(null)}>取消</Button><Button variant="primary">预览变更</Button></>}>
        <Field label="名称" required><Input mono /></Field>
        <Field label="内容" required error="A 记录需为 IPv4 地址。"><Input mono defaultValue="abc" /></Field>
      </Dialog>
      <ConfirmDialog open={dialog === 'confirm'} onOpenChange={() => setDialog(null)} title="停止 sample-agent？" confirmLabel="停止服务" variant="danger" onConfirm={() => setDialog(null)}>
        <Consequences items={[{ text: '服务停止后不再对外提供访问。', tone: 'warn' }, { text: '巡检记录为已停止，不发送异常通知。' }]} />
      </ConfirmDialog>
    </div>
  )
}
