import type { ReactNode } from 'react'
import { Button, Callout, Loading, Status, SkeletonRows } from '../ds'
import { useLoad } from '../data/store'
import { opText, opTone, runtimeText, runtimeTone } from '../lib'
import type { OpResult, Project } from '../data/model'

/** Every page read goes through this: loading, failure with retry, then content. */
export function LoadGate({ id, children, skeleton }: { id: string; children: () => ReactNode; skeleton?: boolean }) {
  const { status, retry } = useLoad(id)
  if (status === 'loading') return skeleton ? <div className="ds-panel"><SkeletonRows rows={4} /></div> : <Loading />
  if (status === 'error')
    return (
      <Callout tone="danger" title="读取失败" live actions={<Button icon="refresh" onClick={retry}>重试</Button>}>
        管理端没有返回数据（模拟：连接被拒绝）。已保存的数据不受影响；可以重试，或检查管理端是否在运行。
      </Callout>
    )
  return <>{children()}</>
}

export const OpStatus = ({ r }: { r: OpResult }) => <Status tone={opTone[r]}>{opText[r]}</Status>
export const Runtime = ({ p }: { p: Project }) => <Status tone={runtimeTone[p.runtime.state]}>{runtimeText[p.runtime.state]}</Status>
