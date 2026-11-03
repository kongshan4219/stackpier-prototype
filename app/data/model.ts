// Domain shapes mirror the production API concepts (see designs/stackpier-redesign/capability-map.md).
// All instances are fictional; addresses use RFC 5737 ranges and *.example.test.

export type DeployType = 'systemd' | 'compose' | 'frp'
export type OpResult = 'running' | 'success' | 'failed' | 'unknown'

export interface Credential { id: string; name: string; revision: number; kind: 'key' | 'password'; usedBy: number }

export interface Server {
  id: string; name: string; host: string; port: number; user: string; fingerprint: string
  credentialId: string; credentialRevision: number; sudo: boolean
  observation: { state: 'ok' | 'auth_failed' | 'unreachable' | 'unchecked'; os?: string; arch?: string; checkedAt?: string; message?: string }
}

export interface Mapping { local: string; remote: string; kind: 'file' | 'dir' }

export interface Configuration {
  id: string; name: string; type: DeployType; revision: number; updatedAt: string
  systemd?: { unit: string; mappings: Mapping[] }
  compose?: { yaml: string; variables: { key: string; value: string; secret?: boolean }[]; mappings: Mapping[] }
  frp?: { role: 'frps' | 'frpc'; programId: string; bindPort?: number; serverAddr?: string }
}

export interface FileVersion { revision: number; sha256: string; size: number; arch?: string; createdAt: string; note?: string }
export interface FileAsset { id: string; name: string; kind: 'program' | 'config' | 'other'; versions: FileVersion[] }

export interface Project {
  id: string; name: string; type: DeployType; serverId: string; configurationId: string; configRevision: number
  stage: 'deployed' | 'uninstalling'
  runtime: { state: 'running' | 'stopped' | 'failed' | 'unobserved'; observedAt?: string; detail?: string }
  monitor: { method: string; intervalMin: number; enabled: boolean }
  dir: string; unit?: string; services?: { name: string; state: 'running' | 'exited' }[]
  draft?: { changedAt: string; summary: string }
  fileCheck?: { state: 'match' | 'drift' | 'unchecked'; checkedAt?: string; drifted?: string[] }
  updatable: boolean
  createdAt: string
}

export interface OpStep { label: string; state: 'done' | 'failed' | 'unknown' | 'running' | 'pending' | 'skipped' }
export interface Operation {
  id: string; kind: string; label: string
  target: { type: 'project' | 'server' | 'frp' | 'dns' | 'firewall' | 'monitoring'; id: string; name: string }
  startedAt: string; finishedAt?: string; result: OpResult
  facts: string; steps: OpStep[]; snapshot?: [string, string][]; recovered?: boolean
}

export interface FrpConnection {
  id: string; name: string; serverProjectId: string; clientProjectId: string; state: 'applied' | 'pending' | 'unknown'
  mappings: { id: string; name: string; kind: 'tcp' | 'stcp'; localPort: number; remotePort?: number; visitorPort?: number }[]
}

export interface DnsRecord { id: string; type: 'A' | 'AAAA' | 'CNAME' | 'TXT'; name: string; content: string; proxied: boolean; ttl: number }
export interface DnsZone { id: string; name: string; records: DnsRecord[] }

export interface FirewallRule { id: string; port: string; protocol: 'tcp' | 'udp' | 'tcp/udp'; source: string; action: 'accept' | 'drop'; note: string; usedBy?: string }
export interface FirewallHost { serverId: string; manager: 'firewalld' | 'ufw' | 'none'; running: boolean; pingBlocked: boolean; rules: FirewallRule[]; docker: { container: string; ports: string }[]; forwards: { from: string; to: string; protocol: string }[] }

export interface Channel { id: string; name: string; kind: 'webhook'; url: string; enabled: boolean; lastDelivery?: { at: string; ok: boolean; status: string } }
export interface MonitorEvent { id: string; projectId: string; at: string; kind: 'abnormal' | 'recovered'; detail: string; delivered: boolean }

export interface DB {
  servers: Server[]; credentials: Credential[]; configurations: Configuration[]; files: FileAsset[]
  projects: Project[]; operations: Operation[]; frp: FrpConnection[]
  cloudflare: { account: string; tokenHint: string; connectedAt: string } | null; zones: DnsZone[]
  firewall: FirewallHost[]; channels: Channel[]; events: MonitorEvent[]
  settings: { notifyOn: { abnormal: boolean; recovered: boolean }; instance: { version: string; dataDir: string; listen: string } }
}
