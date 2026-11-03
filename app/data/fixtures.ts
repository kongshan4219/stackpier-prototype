import type { DB } from './model'

const sha = (c: string) => c.repeat(64)

export function seed(): DB {
  return {
    credentials: [
      { id: 'cred-ops', name: '运维密钥', revision: 2, kind: 'key', usedBy: 2 },
      { id: 'cred-nas', name: 'NAS 管理密码', revision: 1, kind: 'password', usedBy: 1 },
    ],
    servers: [
      { id: 'srv-edge', name: '边缘节点', host: '192.0.2.24', port: 22, user: 'deploy', fingerprint: 'SHA256:Qm9vdC1lZGdlLWZpY3Rpb25hbC1rZXk', credentialId: 'cred-ops', credentialRevision: 2, sudo: true,
        observation: { state: 'ok', os: 'Debian 13', arch: 'x86_64', checkedAt: '2026-11-03T10:30:00+08:00' } },
      { id: 'srv-nas', name: '家庭 NAS', host: '198.51.100.7', port: 2222, user: 'admin', fingerprint: 'SHA256:TmFzLWZpY3Rpb25hbC1ob3N0LWtleQ', credentialId: 'cred-nas', credentialRevision: 1, sudo: false,
        observation: { state: 'auth_failed', os: 'Debian 13', arch: 'aarch64', checkedAt: '2026-11-03T10:28:00+08:00', message: 'SSH 已连接，但认证被拒绝。凭据可能已在服务器上更换。' } },
      { id: 'srv-relay', name: '中转节点', host: '203.0.113.90', port: 22, user: 'deploy', fingerprint: 'SHA256:UmVsYXktZmljdGlvbmFsLWtleQ', credentialId: 'cred-ops', credentialRevision: 2, sudo: true,
        observation: { state: 'ok', os: 'Debian 13', arch: 'x86_64', checkedAt: '2026-11-03T10:29:40+08:00' } },
    ],
    files: [
      { id: 'f-agent', name: 'sample-agent', kind: 'program', versions: [
        { revision: 3, sha256: sha('a'), size: 1474560, arch: 'x86_64', createdAt: '2026-10-30T09:12:00+08:00', note: '修复启动参数' },
        { revision: 2, sha256: sha('c'), size: 1470212, arch: 'x86_64', createdAt: '2026-10-12T15:40:00+08:00' },
      ] },
      { id: 'f-agent-conf', name: 'sample-config.json', kind: 'config', versions: [{ revision: 1, sha256: sha('b'), size: 512, createdAt: '2026-10-12T15:41:00+08:00' }] },
      { id: 'f-frps', name: 'frps', kind: 'program', versions: [{ revision: 1, sha256: sha('d'), size: 14_680_064, arch: 'x86_64', createdAt: '2026-10-08T11:00:00+08:00', note: 'FRP 0.71.0' }] },
      { id: 'f-frpc', name: 'frpc', kind: 'program', versions: [{ revision: 1, sha256: sha('e'), size: 13_107_200, arch: 'aarch64', createdAt: '2026-10-08T11:02:00+08:00', note: 'FRP 0.71.0' }] },
    ],
    configurations: [
      { id: 'cfg-agent', name: '服务标准配置', type: 'systemd', revision: 3, updatedAt: '2026-10-30T09:15:00+08:00',
        systemd: {
          unit: '[Unit]\nDescription=sample agent\nAfter=network-online.target\n\n[Service]\nExecStart=/opt/stackpier/sample-agent/bin/sample-agent --config /opt/stackpier/sample-agent/etc/sample-config.json\nRestart=on-failure\nUser=deploy\n\n[Install]\nWantedBy=multi-user.target',
          mappings: [
            { local: 'files/sample-agent@3', remote: '/opt/stackpier/sample-agent/bin/sample-agent', kind: 'file' },
            { local: 'files/sample-config.json@1', remote: '/opt/stackpier/sample-agent/etc/sample-config.json', kind: 'file' },
          ] } },
      { id: 'cfg-web', name: '个人站点', type: 'compose', revision: 5, updatedAt: '2026-10-28T20:02:00+08:00',
        compose: {
          yaml: 'services:\n  web:\n    image: nginx:1.29-alpine\n    ports:\n      - "${WEB_PORT}:80"\n    volumes:\n      - ./site:/usr/share/nginx/html:ro\n  api:\n    image: registry.example.test/notes-api:2.4\n    environment:\n      DATABASE_URL: ${DATABASE_URL}',
          variables: [{ key: 'WEB_PORT', value: '8080' }, { key: 'DATABASE_URL', value: '', secret: true }],
          mappings: [{ local: '~/sites/notes/public/', remote: 'site/', kind: 'dir' }] } },
      { id: 'cfg-frps', name: 'FRP 服务端', type: 'frp', revision: 1, updatedAt: '2026-10-08T11:10:00+08:00', frp: { role: 'frps', programId: 'f-frps', bindPort: 7000 } },
      { id: 'cfg-frpc', name: 'FRP 客户端（NAS）', type: 'frp', revision: 2, updatedAt: '2026-10-09T08:20:00+08:00', frp: { role: 'frpc', programId: 'f-frpc', serverAddr: '203.0.113.90:7000' } },
    ],
    projects: [
      { id: 'p-agent', name: 'sample-agent', type: 'systemd', serverId: 'srv-edge', configurationId: 'cfg-agent', configRevision: 2, stage: 'deployed',
        runtime: { state: 'running', observedAt: '2026-11-03T10:30:00+08:00' }, monitor: { method: 'systemd 状态', intervalMin: 5, enabled: true },
        dir: '/opt/stackpier/sample-agent', unit: 'stackpier-sample-agent.service', updatable: true,
        draft: { changedAt: '2026-11-02T21:40:00+08:00', summary: '程序 sample-agent 改用修订 3' },
        fileCheck: { state: 'match', checkedAt: '2026-11-02T08:00:00+08:00' }, createdAt: '2026-10-12T16:00:00+08:00' },
      { id: 'p-notes', name: 'notes', type: 'compose', serverId: 'srv-edge', configurationId: 'cfg-web', configRevision: 5, stage: 'deployed',
        runtime: { state: 'failed', observedAt: '2026-11-03T10:25:00+08:00', detail: 'api 容器已退出（exit 1）' }, monitor: { method: 'Compose 服务状态', intervalMin: 5, enabled: true },
        dir: '/opt/stackpier/notes', services: [{ name: 'web', state: 'running' }, { name: 'api', state: 'exited' }], updatable: false, createdAt: '2026-10-20T19:00:00+08:00' },
      { id: 'p-frps', name: 'frps', type: 'frp', serverId: 'srv-relay', configurationId: 'cfg-frps', configRevision: 1, stage: 'deployed',
        runtime: { state: 'running', observedAt: '2026-11-03T10:29:00+08:00' }, monitor: { method: 'systemd 状态', intervalMin: 10, enabled: true },
        dir: '/opt/stackpier/frps', unit: 'stackpier-frps.service', updatable: false, createdAt: '2026-10-08T11:30:00+08:00' },
      { id: 'p-frpc', name: 'frpc-nas', type: 'frp', serverId: 'srv-nas', configurationId: 'cfg-frpc', configRevision: 2, stage: 'deployed',
        runtime: { state: 'unobserved' }, monitor: { method: 'systemd 状态', intervalMin: 10, enabled: false },
        dir: '/opt/stackpier/frpc-nas', unit: 'stackpier-frpc-nas.service', updatable: false, createdAt: '2026-10-09T08:40:00+08:00' },
    ],
    operations: [
      { id: 'op-7f3a', kind: 'deploy', label: '部署', target: { type: 'project', id: 'p-agent', name: 'sample-agent' }, startedAt: '2026-11-03T10:30:00+08:00', result: 'unknown',
        facts: '文件已上传，写入服务单元后连接中断，未收到启动结果。',
        steps: [{ label: '核对目标与快照', state: 'done' }, { label: '上传文件', state: 'done' }, { label: '写入服务单元', state: 'unknown' }, { label: '启动并核验', state: 'pending' }],
        snapshot: [['配置', '服务标准配置 · 修订 3'], ['服务器', 'deploy@192.0.2.24:22'], ['服务单元', 'stackpier-sample-agent.service']] },
      { id: 'op-6c21', kind: 'start', label: '启动', target: { type: 'project', id: 'p-notes', name: 'notes' }, startedAt: '2026-11-03T10:24:00+08:00', finishedAt: '2026-11-03T10:24:20+08:00', result: 'failed',
        facts: 'web 已启动；api 启动后退出（exit 1）。', steps: [{ label: '启动 web', state: 'done' }, { label: '启动 api', state: 'failed' }] },
      { id: 'op-5b10', kind: 'restart', label: '重启', target: { type: 'project', id: 'p-agent', name: 'sample-agent' }, startedAt: '2026-11-02T22:04:00+08:00', finishedAt: '2026-11-02T22:04:08+08:00', result: 'success',
        facts: '服务已重启并处于运行中。', steps: [{ label: '重启服务', state: 'done' }, { label: '核验运行状态', state: 'done' }] },
      { id: 'op-4e02', kind: 'dns', label: 'DNS 修改', target: { type: 'dns', id: 'zone-1', name: 'notes.example.test' }, startedAt: '2026-11-01T13:10:00+08:00', finishedAt: '2026-11-01T13:10:02+08:00', result: 'success',
        facts: 'A 记录 notes → 192.0.2.24。', steps: [{ label: '提交变更', state: 'done' }, { label: '读回核对', state: 'done' }] },
      { id: 'op-3d77', kind: 'frp', label: 'FRP 映射变更', target: { type: 'frp', id: 'frp-nas', name: 'NAS 穿透' }, startedAt: '2026-10-30T18:00:00+08:00', finishedAt: '2026-10-30T18:00:15+08:00', result: 'success',
        facts: '新增 TCP 映射 nas-web，两端配置已应用。', steps: [{ label: '更新服务端', state: 'done' }, { label: '更新客户端', state: 'done' }, { label: '探测连通', state: 'done' }] },
    ],
    frp: [
      { id: 'frp-nas', name: 'NAS 穿透', serverProjectId: 'p-frps', clientProjectId: 'p-frpc', state: 'applied',
        mappings: [{ id: 'm1', name: 'nas-web', kind: 'tcp', localPort: 5000, remotePort: 15000 }, { id: 'm2', name: 'nas-ssh', kind: 'stcp', localPort: 22, visitorPort: 16022 }] },
    ],
    cloudflare: { account: 'personal@example.test', tokenHint: '…9f2c', connectedAt: '2026-10-15T09:00:00+08:00' },
    zones: [
      { id: 'zone-1', name: 'example.test', records: [
        { id: 'r1', type: 'A', name: 'notes.example.test', content: '192.0.2.24', proxied: true, ttl: 1 },
        { id: 'r2', type: 'A', name: 'relay.example.test', content: '203.0.113.90', proxied: false, ttl: 300 },
        { id: 'r3', type: 'CNAME', name: 'www.example.test', content: 'notes.example.test', proxied: true, ttl: 1 },
        { id: 'r4', type: 'TXT', name: 'example.test', content: '"v=spf1 -all"', proxied: false, ttl: 3600 },
      ] },
      { id: 'zone-2', name: 'lab.example.test', records: [] },
    ],
    firewall: [
      { serverId: 'srv-edge', manager: 'firewalld', running: true, pingBlocked: false,
        rules: [
          { id: 'fw1', port: '22', protocol: 'tcp', source: '全部', action: 'accept', note: 'SSH' },
          { id: 'fw2', port: '8080', protocol: 'tcp', source: '全部', action: 'accept', note: 'notes web', usedBy: 'notes' },
          { id: 'fw3', port: '18080', protocol: 'tcp', source: '198.51.100.0/24', action: 'accept', note: 'agent 管理端口', usedBy: 'sample-agent' },
        ],
        docker: [{ container: 'notes-web-1', ports: '0.0.0.0:8080→80/tcp' }],
        forwards: [] },
      { serverId: 'srv-relay', manager: 'firewalld', running: true, pingBlocked: true,
        rules: [{ id: 'fw4', port: '7000', protocol: 'tcp', source: '全部', action: 'accept', note: 'FRP 服务端', usedBy: 'frps' }, { id: 'fw5', port: '15000', protocol: 'tcp', source: '全部', action: 'accept', note: 'nas-web' }],
        docker: [], forwards: [] },
    ],
    channels: [
      { id: 'ch1', name: '个人通知', kind: 'webhook', url: 'https://hooks.example.test/notify/…', enabled: true, lastDelivery: { at: '2026-11-03T10:26:00+08:00', ok: true, status: 'HTTP 200' } },
    ],
    events: [
      { id: 'e1', projectId: 'p-notes', at: '2026-11-03T10:25:00+08:00', kind: 'abnormal', detail: 'api 容器已退出', delivered: true },
      { id: 'e2', projectId: 'p-agent', at: '2026-11-01T03:10:00+08:00', kind: 'recovered', detail: '服务恢复运行', delivered: true },
      { id: 'e3', projectId: 'p-agent', at: '2026-11-01T03:05:00+08:00', kind: 'abnormal', detail: '服务未运行（inactive）', delivered: true },
    ],
    settings: { notifyOn: { abnormal: true, recovered: true }, instance: { version: 'dev-20261103（原型）', dataDir: '/var/lib/stackpier', listen: '127.0.0.1:8080' } },
  }
}

export function emptyDB(): DB {
  const s = seed()
  return { ...s, servers: [], credentials: [], configurations: [], files: [], projects: [], operations: [], frp: [], cloudflare: null, zones: [], firewall: [], channels: [], events: [] }
}
