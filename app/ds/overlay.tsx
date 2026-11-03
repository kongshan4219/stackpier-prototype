import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Dialog as RDialog, DropdownMenu, Tooltip as RTooltip, Toast as RToast, Tabs as RTabs } from 'radix-ui'
import { Button, type ButtonVariant } from './controls'
import { Icon, type IconName } from './icons'

/** Modal dialog. Radix handles focus trap, Escape, scroll lock and focus return. */
export function Dialog({ open, onOpenChange, title, description, size, children, footer, note, dismissible = true }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode
  size?: 'sm' | 'md' | 'lg'; children: ReactNode; footer?: ReactNode; note?: ReactNode
  /** False while a request is in flight: Escape and outside click do nothing. */
  dismissible?: boolean
}) {
  // Dialogs here are opened programmatically (no Radix Trigger), so remember and restore focus ourselves.
  const returnTo = useRef<HTMLElement | null>(null)
  if (open && !returnTo.current && typeof document !== 'undefined') returnTo.current = document.activeElement as HTMLElement | null
  return (
    <RDialog.Root open={open} onOpenChange={(v) => (dismissible || v) && onOpenChange(v)}>
      <RDialog.Portal>
        <RDialog.Overlay className="ds-scrim" />
        <RDialog.Content className="ds-dialog" data-size={size === 'md' ? undefined : size}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onCloseAutoFocus={(e) => {
            const el = returnTo.current
            returnTo.current = null
            e.preventDefault()
            const target = el && el.isConnected && !el.closest('[inert]') && !(el as HTMLButtonElement).disabled ? el : document.getElementById('content')
            target?.focus()
          }}>
          <header className="ds-dialog-head">
            <div className="grow">
              <RDialog.Title asChild><h2>{title}</h2></RDialog.Title>
              {description ? <RDialog.Description asChild><p>{description}</p></RDialog.Description> : <RDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RDialog.Description>}
            </div>
            <RDialog.Close asChild><Button variant="ghost" icon="close" label="关闭" disabled={!dismissible} /></RDialog.Close>
          </header>
          <div className="ds-dialog-body">{children}</div>
          {footer && <footer className="ds-dialog-foot">{note && <span className="note">{note}</span>}{footer}</footer>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** Confirmation for consequential actions: states what happens, then asks. */
export function ConfirmDialog({ open, onOpenChange, title, description, children, confirmLabel, variant = 'primary', onConfirm, busy, confirmDisabled }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode
  confirmLabel: string; variant?: ButtonVariant; onConfirm: () => void; busy?: boolean; confirmDisabled?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="sm" dismissible={!busy}
      footer={<>
        <Button onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
        <Button variant={variant} onClick={onConfirm} busy={busy} disabled={confirmDisabled}>{confirmLabel}</Button>
      </>}>
      {children}
    </Dialog>
  )
}

export interface MenuItem { label: string; icon?: IconName; onSelect: () => void; tone?: 'danger'; disabled?: boolean; separatorBefore?: boolean }

export function Menu({ label, items, trigger }: { label: string; items: MenuItem[]; trigger?: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger ?? <Button icon="more" label={label} />}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ds-menu" align="end" sideOffset={4}>
          {items.map((it) => [
            it.separatorBefore && <DropdownMenu.Separator key={it.label + '-s'} className="ds-menu-sep" />,
            <DropdownMenu.Item key={it.label} className="ds-menu-item" data-tone={it.tone} disabled={it.disabled} onSelect={it.onSelect}>
              {it.icon && <Icon name={it.icon} />}{it.label}
            </DropdownMenu.Item>,
          ])}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <RTooltip.Root delayDuration={300}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal><RTooltip.Content className="ds-tooltip" sideOffset={4}>{content}</RTooltip.Content></RTooltip.Portal>
    </RTooltip.Root>
  )
}

/** Controlled tabs within a page (not routed). */
export function Tabs({ value, onValueChange, tabs, label, children }: {
  value: string; onValueChange: (v: string) => void; label: string
  tabs: { value: string; label: ReactNode }[]; children?: ReactNode
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className="stack">
      <RTabs.List className="ds-tabs-list" aria-label={label}>
        {tabs.map((t) => <RTabs.Trigger key={t.value} value={t.value} className="ds-tab">{t.label}</RTabs.Trigger>)}
      </RTabs.List>
      {children}
    </RTabs.Root>
  )
}
export const TabPanel = RTabs.Content

/* ---------- Toast: transient confirmation only; results needing review stay on the page ---------- */
interface ToastMsg { id: number; title: string; body?: string; tone?: 'ok' | 'info' }
const ToastCtx = createContext<(t: Omit<ToastMsg, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function AppProviders({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((t: Omit<ToastMsg, 'id'>) => setToasts((all) => [...all, { ...t, id: Date.now() + Math.random() }]), [])
  return (
    <RTooltip.Provider>
      <RToast.Provider duration={4000} label="通知">
        <ToastCtx.Provider value={push}>{children}</ToastCtx.Provider>
        {toasts.map((t) => (
          <RToast.Root key={t.id} className="ds-toast" onOpenChange={(o) => !o && setToasts((all) => all.filter((x) => x.id !== t.id))}>
            <span style={{ color: t.tone === 'ok' ? 'var(--color-ok)' : 'var(--color-info)' }}><Icon name={t.tone === 'ok' ? 'check' : 'info'} /></span>
            <div className="grow"><RToast.Title className="title">{t.title}</RToast.Title>{t.body && <RToast.Description className="body">{t.body}</RToast.Description>}</div>
            <RToast.Close asChild><Button variant="ghost" size="sm" icon="close" label="关闭通知" /></RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="ds-toast-viewport" />
      </RToast.Provider>
    </RTooltip.Provider>
  )
}
