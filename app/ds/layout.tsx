import type { ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export function Panel({ title, description, actions, footer, flush, children, id }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; footer?: ReactNode; flush?: boolean; children: ReactNode; id?: string
}) {
  const hid = id ? id + '-title' : undefined
  return (
    <section className="ds-panel" aria-labelledby={hid}>
      {(title || actions) && (
        <header className="ds-panel-head">
          <div className="grow" style={{ display: 'grid' }}>
            {title && <h2 id={hid}>{title}</h2>}
            {description && <span className="desc">{description}</span>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </header>
      )}
      <div className="ds-panel-body" data-flush={flush || undefined}>{children}</div>
      {footer && <footer className="ds-panel-foot">{footer}</footer>}
    </section>
  )
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode, { mono?: boolean }?][] }) {
  return (
    <dl className="ds-kv">
      {items.map(([k, v, o], i) => [<dt key={'k' + i}>{k}</dt>, <dd key={'v' + i} className={o?.mono ? 'mono' : undefined}>{v}</dd>])}
    </dl>
  )
}

export function Facts({ children, cols, label }: { children: ReactNode; cols?: number; label: string }) {
  return <div className="ds-facts" style={cols ? ({ '--cols': cols } as React.CSSProperties) : undefined} role="group" aria-label={label}>{children}</div>
}

export function Fact({ k, v, s, large, wide, href }: { k: ReactNode; v: ReactNode; s?: ReactNode; large?: boolean; wide?: boolean; href?: string }) {
  const inner = <><span className="k">{k}</span><span className="v" data-size={large ? 'lg' : undefined}>{v}</span>{s && <span className="s">{s}</span>}</>
  return href
    ? <a className="ds-fact" href={href} data-wide={wide || undefined}>{inner}</a>
    : <div className="ds-fact" data-wide={wide || undefined}>{inner}</div>
}

const calloutIcons: Record<string, IconName> = { warn: 'alert', danger: 'alert', info: 'info', ok: 'check', neutral: 'info' }

export function Callout({ tone = 'neutral', title, children, actions, live }: {
  tone?: 'warn' | 'danger' | 'info' | 'ok' | 'neutral'; title?: ReactNode; children?: ReactNode; actions?: ReactNode; live?: boolean
}) {
  return (
    <div className="ds-callout" data-tone={tone} role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}>
      <Icon name={calloutIcons[tone]} />
      <div className="content">{title && <div className="title">{title}</div>}{children && <div className="body">{children}</div>}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Empty({ icon = 'inbox', title, children, actions }: { icon?: IconName; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return <div className="ds-empty"><Icon name={icon} /><strong>{title}</strong>{children && <span className="ds-hint">{children}</span>}{actions && <div className="actions">{actions}</div>}</div>
}

export function Loading({ children = '正在读取…' }: { children?: ReactNode }) {
  return <div className="ds-loading" role="status"><span className="ds-spinner" aria-hidden="true" />{children}</div>
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" data-gap="sm" style={{ padding: 14 }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="ds-skeleton" style={{ width: `${90 - i * 17}%` }} />)}
    </div>
  )
}

export function Code({ children, wrap, label }: { children: ReactNode; wrap?: boolean; label?: string }) {
  return <pre className="ds-code" data-wrap={wrap || undefined} tabIndex={0} aria-label={label}>{children}</pre>
}

export function Diff({ lines, label }: { lines: { sign: '+' | '-' | ' '; text: string }[]; label: string }) {
  return (
    <div className="ds-diff" role="group" aria-label={label} tabIndex={0}>
      {lines.map((l, i) => (
        <div key={i} data-sign={l.sign}>
          <span className="sr-only">{l.sign === '+' ? '新增：' : l.sign === '-' ? '删除：' : ''}</span>{l.text}
        </div>
      ))}
    </div>
  )
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="ds-steps" aria-label="步骤">
      {steps.map((s, i) => (
        <li key={s} data-state={i < current ? 'done' : i === current ? 'current' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="n">{i < current ? <Icon name="check" size="sm" /> : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  )
}

export function Consequences({ items }: { items: { text: ReactNode; tone?: 'warn' | 'danger' }[] }) {
  return (
    <ul className="ds-consequences">
      {items.map((it, i) => (
        <li key={i} data-tone={it.tone}><Icon name={it.tone ? 'alert' : 'check'} /><span>{it.text}</span></li>
      ))}
    </ul>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="ds-section-label">{children}</h3>
}
