import { StrictMode, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders, Empty, Button } from './ds'
import { Shell } from './shell'
import { useRoute, go } from './lib'
import { useDB } from './data/store'
import { Overview } from './pages/overview'
import { Projects, ProjectDetail } from './pages/projects'
import { Servers, ServerDetail } from './pages/servers'
import { Operations, OperationDetail } from './pages/operations'
import { Configurations, ConfigurationEditor } from './pages/configurations'
import { Files } from './pages/files'
import { Frp } from './pages/frp'
import { Dns } from './pages/dns'
import { Firewall } from './pages/firewall'
import { Monitoring } from './pages/monitoring'
import { Settings } from './pages/settings'
import { DesignSystem } from './pages/design-system'

type Crumb = { label: string; path?: string }

function resolve(path: string, names: (kind: string, id: string) => string): { el: ReactNode; crumbs: Crumb[]; title: string } {
  const [, a, b, c] = path.split('/')
  const one = (label: string, el: ReactNode) => ({ el, crumbs: [{ label }], title: label })
  switch (a) {
    case 'overview': return one('总览', <Overview />)
    case 'projects':
      if (!b) return one('项目', <Projects tab="list" />)
      if (b === 'failed') return { el: <Projects tab="failed" />, crumbs: [{ label: '项目', path: '/projects' }, { label: '部署失败记录' }], title: '部署失败记录' }
      return { el: <ProjectDetail key={b} id={b} tab={c} />, crumbs: [{ label: '项目', path: '/projects' }, { label: names('project', b) }], title: names('project', b) }
    case 'servers':
      if (!b) return one('服务器', <Servers />)
      return { el: <ServerDetail id={b} />, crumbs: [{ label: '服务器', path: '/servers' }, { label: names('server', b) }], title: names('server', b) }
    case 'operations':
      if (!b) return one('操作记录', <Operations />)
      return { el: <OperationDetail id={b} />, crumbs: [{ label: '操作记录', path: '/operations' }, { label: b }], title: b }
    case 'configurations':
      if (!b) return one('部署配置', <Configurations />)
      return { el: <ConfigurationEditor key={b} id={b} />, crumbs: [{ label: '部署配置', path: '/configurations' }, { label: b === 'new' ? '新建' : names('configuration', b) }], title: '部署配置' }
    case 'files': return one('文件', <Files />)
    case 'frp': return one('FRP', <Frp />)
    case 'dns': return one('DNS', <Dns />)
    case 'firewall': return one('防火墙', <Firewall />)
    case 'monitoring': return one('巡检与通知', <Monitoring />)
    case 'settings': return one('设置', <Settings />)
    case 'design-system': return one('设计系统', <DesignSystem />)
    default: return one('未找到', <div className="page"><Empty title="页面不存在" actions={<Button onClick={() => go('/overview')}>返回总览</Button>} /></div>)
  }
}

function App() {
  const path = useRoute()
  const db = useDB((d) => d)
  const names = (kind: string, id: string) =>
    (kind === 'project' ? db.projects : kind === 'server' ? db.servers : db.configurations).find((x) => x.id === id)?.name ?? id
  const { el, crumbs, title } = resolve(path, names)
  useEffect(() => {
    document.title = `${title} · 栈桥原型`
  }, [title])
  useEffect(() => {
    // Route changes move focus to the page heading region for screen-reader and keyboard users.
    const h = document.querySelector<HTMLElement>('#content h1')
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }) }
    scrollTo(0, 0)
  }, [path])
  return <Shell path={path} crumbs={crumbs}>{el}</Shell>
}

createRoot(document.getElementById('root')!).render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>)
