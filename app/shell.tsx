import { useEffect, useState, type ReactNode } from 'react'
import { Dialog as RDialog, DropdownMenu } from 'radix-ui'
import { Button, Count, Icon, Logo, type IconName } from './ds'
import { href } from './lib'
import { useDB, useScenario, setScenario, resetData, type Scenario } from './data/store'

export const navGroups: { label: string; items: { path: string; label: string; icon: IconName }[] }[] = [
  { label: '工作空间', items: [{ path: '/overview', label: '总览', icon: 'overview' }, { path: '/projects', label: '项目', icon: 'project' }, { path: '/servers', label: '服务器', icon: 'server' }] },
  { label: '部署资源', items: [{ path: '/configurations', label: '部署配置', icon: 'config' }, { path: '/files', label: '文件', icon: 'file' }] },
  { label: '网络', items: [{ path: '/frp', label: 'FRP', icon: 'frp' }, { path: '/dns', label: 'DNS', icon: 'dns' }, { path: '/firewall', label: '防火墙', icon: 'firewall' }] },
  { label: '运行', items: [{ path: '/monitoring', label: '巡检与通知', icon: 'monitor' }, { path: '/operations', label: '操作记录', icon: 'operations' }, { path: '/settings', label: '设置', icon: 'settings' }] },
]

function useTheme() {
  const initial = () => {
    try { const v = localStorage.getItem('stackpier-proto-theme'); if (v === 'light' || v === 'dark') return v } catch { /* storage unavailable */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  const [theme, setTheme] = useState<'light' | 'dark'>(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('stackpier-proto-theme', theme) } catch { /* ignore */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

function NavContent({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const attention = useDB((d) => d.operations.filter((o) => o.result === 'unknown').length + d.projects.filter((p) => p.runtime.state === 'failed').length)
  return (
    <>
      <a className="nav-brand" href={href('/overview')} onClick={onNavigate}><Logo /><span>栈桥<small>STACKPIER</small></span></a>
      {navGroups.map((g) => (
        <nav className="nav-group" key={g.label} aria-label={g.label}>
          <h2>{g.label}</h2>
          {g.items.map((it) => (
            <a key={it.path} className="nav-link" href={href(it.path)} onClick={onNavigate} aria-current={path === it.path || path.startsWith(it.path + '/') ? 'page' : undefined}>
              <Icon name={it.icon} />{it.label}
              {it.path === '/projects' && <Count n={attention} label={`${attention} 项需要处理`} />}
            </a>
          ))}
        </nav>
      ))}
      <div className="nav-foot">
        <a className="nav-link" href={href('/design-system')} onClick={onNavigate} aria-current={path === '/design-system' ? 'page' : undefined}><Icon name="compose" />设计系统</a>
      </div>
    </>
  )
}

const scenarioText: Record<Scenario, string> = { normal: '示例数据', empty: '空实例', error: '读取失败', slow: '慢速读取' }

function PrototypeMenu() {
  const sc = useScenario()
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="proto-chip" data-active={sc !== 'normal' || undefined} aria-label={`原型模拟：${scenarioText[sc]}。打开场景菜单`}>
          <Icon name="info" size="sm" /><span className="desktop-only">原型模拟 · </span>{scenarioText[sc]}<Icon name="chevronDown" size="sm" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ds-menu" align="end" sideOffset={6}>
          <DropdownMenu.Label className="ds-menu-label">浏览器内模拟，不连接任何服务器</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={sc} onValueChange={(v) => setScenario(v as Scenario)}>
            {(Object.keys(scenarioText) as Scenario[]).map((k) => (
              <DropdownMenu.RadioItem key={k} value={k} className="ds-menu-item">
                <span style={{ width: 16 }}><DropdownMenu.ItemIndicator><Icon name="check" size="sm" /></DropdownMenu.ItemIndicator></span>{scenarioText[k]}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="ds-menu-sep" />
          <DropdownMenu.Item className="ds-menu-item" onSelect={resetData}><Icon name="refresh" />重置模拟数据</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Shell({ path, crumbs, children }: { path: string; crumbs: { label: string; path?: string }[]; children: ReactNode }) {
  const [theme, toggle] = useTheme()
  const [drawer, setDrawer] = useState(false)
  return (
    <div className="shell">
      <aside className="nav"><NavContent path={path} /></aside>
      <div className="main">
        <header className="topbar">
          <RDialog.Root open={drawer} onOpenChange={setDrawer}>
            <RDialog.Trigger asChild><span className="mobile-only"><Button variant="ghost" icon="menu" label="打开导航" /></span></RDialog.Trigger>
            <RDialog.Portal>
              <RDialog.Overlay className="ds-scrim" />
              <RDialog.Content className="drawer" aria-describedby={undefined}>
                <RDialog.Title className="sr-only">导航</RDialog.Title>
                <NavContent path={path} onNavigate={() => setDrawer(false)} />
              </RDialog.Content>
            </RDialog.Portal>
          </RDialog.Root>
          <nav className="crumbs" aria-label="位置">
            {crumbs.map((c, i) => (
              <span key={i} className="row" data-nowrap style={{ gap: 6, minWidth: 0 }}>
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.path && i < crumbs.length - 1 ? <a href={href(c.path)}>{c.label}</a> : <span className="truncate" aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
          <span className="spacer" />
          <PrototypeMenu />
          <Button variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? '切换到浅色' : '切换到深色'} onClick={toggle} />
        </header>
        <main id="content" tabIndex={-1} style={{ outline: 'none' }}>{children}</main>
      </div>
    </div>
  )
}

export function PageHeader({ title, sub, badge, actions }: { title: ReactNode; sub?: ReactNode; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-title">
        <div className="title-row"><h1>{title}</h1>{badge}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
