import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'danger-solid' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  /** Shows a spinner, keeps the label, and blocks repeat submission. */
  busy?: boolean
  /** Icon-only buttons must pass an accessible label. */
  label?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, busy, label, children, disabled, type = 'button', ...rest }, ref,
) {
  const iconOnly = !children && !!label
  return (
    <button
      ref={ref} type={type} className="ds-btn" data-variant={variant} data-size={size === 'md' ? undefined : size}
      data-icon-only={iconOnly || undefined} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}
      aria-busy={busy || undefined} disabled={disabled || busy} {...rest}
    >
      {busy ? <span className="ds-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 'sm' : undefined} />}
      {children}
    </button>
  )
})

export function ButtonGroup({ children, label }: { children: ReactNode; label: string }) {
  return <div className="ds-btn-group" role="group" aria-label={label}>{children}</div>
}

/** Status vocabulary shared by every domain. Tone is never conveyed by color alone. */
export type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'unknown' | 'progress'

export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="ds-status" data-tone={tone}>{children}</span>
}

export function Badge({ tone, mono, children }: { tone?: 'accent' | 'warn' | 'danger' | 'ok'; mono?: boolean; children: ReactNode }) {
  return <span className="ds-badge" data-tone={tone} data-mono={mono || undefined}>{children}</span>
}

export function Count({ n, label }: { n: number; label: string }) {
  if (!n) return null
  return <span className="ds-count" aria-label={label}>{n}</span>
}

export function Spinner({ label }: { label?: string }) {
  return <span className="ds-spinner" role={label ? 'status' : undefined} aria-label={label} />
}
