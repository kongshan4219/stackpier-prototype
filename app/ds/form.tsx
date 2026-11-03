import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, cloneElement, isValidElement, type ReactElement } from 'react'
import { Select as RSelect, Checkbox as RCheckbox, Switch as RSwitch, RadioGroup, ToggleGroup } from 'radix-ui'
import { Icon, type IconName } from './icons'

/** Wires label, hint and error to its single control via id / aria-describedby / aria-invalid. */
export function Field({ label, hint, error, required, children }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactElement<Record<string, unknown>>
}) {
  const id = useId()
  const hintId = hint ? id + '-h' : undefined
  const errId = error ? id + '-e' : undefined
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': [errId, hintId].filter(Boolean).join(' ') || undefined, 'aria-required': required || undefined })
    : children
  return (
    <div className="ds-field">
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>
      {control}
      {error && <span className="ds-error" id={errId}><Icon name="close" size="sm" />{error}</span>}
      {hint && <span className="ds-hint" id={hintId}>{hint}</span>}
    </div>
  )
}

export function Input({ mono, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className="ds-input" data-mono={mono || undefined} {...rest} />
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <div className="ds-input-wrap"><Icon name="search" /><input type="search" className="ds-input" {...props} /></div>
}

export function Textarea({ mono, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return <textarea className="ds-textarea" data-mono={mono || undefined} spellCheck={mono ? false : undefined} {...rest} />
}

export interface Option { value: string; label: ReactNode; hint?: ReactNode; disabled?: boolean }

export function Select({ value, onValueChange, options, placeholder, id, disabled, ...aria }: {
  value?: string; onValueChange: (v: string) => void; options: Option[]; placeholder?: string; id?: string; disabled?: boolean
  'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-label'?: string
}) {
  return (
    <RSelect.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger className="ds-select-trigger" id={id} {...aria}>
        <span className="truncate"><RSelect.Value placeholder={placeholder} /></span>
        <RSelect.Icon><Icon name="chevronDown" size="sm" /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="ds-select-content" position="popper" sideOffset={4}>
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} disabled={o.disabled} className="ds-select-item">
                <span className="grow" style={{ display: 'grid' }}>
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  {o.hint && <span className="ds-hint">{o.hint}</span>}
                </span>
                <RSelect.ItemIndicator><Icon name="check" size="sm" /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

export function Checkbox({ checked, onCheckedChange, children, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; children: ReactNode; id?: string }) {
  const auto = useId()
  const cid = id ?? auto
  return (
    <span className="ds-check">
      <RCheckbox.Root id={cid} className="ds-check-box" checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)}>
        <RCheckbox.Indicator><Icon name="check" /></RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={cid}>{children}</label>
    </span>
  )
}

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <RSwitch.Root className="ds-switch" checked={checked} onCheckedChange={onCheckedChange} aria-label={label}>
      <RSwitch.Thumb className="ds-switch-thumb" />
    </RSwitch.Root>
  )
}

/** Large radio cards for consequential choices (deployment type, record type). */
export function ChoiceGroup({ value, onValueChange, options, label }: {
  value?: string; onValueChange: (v: string) => void; label: string
  options: { value: string; title: string; description: string; icon: IconName; disabled?: boolean }[]
}) {
  return (
    <RadioGroup.Root className="ds-radio-group" value={value} onValueChange={onValueChange} aria-label={label}>
      {options.map((o) => (
        <RadioGroup.Item key={o.value} value={o.value} className="ds-choice" disabled={o.disabled}>
          <Icon name={o.icon} /><strong>{o.title}</strong><span>{o.description}</span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}

export function Segmented({ value, onValueChange, options, label }: {
  value: string; onValueChange: (v: string) => void; label: string; options: { value: string; label: ReactNode }[]
}) {
  return (
    <ToggleGroup.Root type="single" className="ds-segmented" value={value} onValueChange={(v) => v && onValueChange(v)} aria-label={label}>
      {options.map((o) => <ToggleGroup.Item key={o.value} value={o.value}>{o.label}</ToggleGroup.Item>)}
    </ToggleGroup.Root>
  )
}
