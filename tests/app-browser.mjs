// Browser checks for the redesigned prototype (prototype/app). Fictional data only.
// Usage: STACKPIER_PROTOTYPE_DEPS=<deps> STACKPIER_APP_URL=http://127.0.0.1:<port>/ \
//        [STACKPIER_SHOTS=<dir outside repo>] [STACKPIER_CHROMIUM=/usr/bin/google-chrome] node tests/app-browser.mjs
import path from 'node:path'
import { createRequire } from 'node:module'
const req = createRequire(path.join(process.env.STACKPIER_PROTOTYPE_DEPS, 'package.json'))
const { chromium } = req('playwright-core')
const base = process.env.STACKPIER_APP_URL ?? 'http://127.0.0.1:18433/'
const shots = process.env.STACKPIER_SHOTS
const routes = ['projects/p-notes/files','overview','projects','projects/p-agent','projects/p-agent/config','projects/p-notes','projects/p-notes/logs','projects/failed','servers','servers/srv-nas','configurations','configurations/cfg-web','configurations/new?type=frp','files','frp','dns','firewall?server=srv-edge','monitoring','operations','operations/op-7f3a','settings','design-system']
const b = await chromium.launch({ executablePath: process.env.STACKPIER_CHROMIUM ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const errs = []
let pass = 0
const ok = (c, m) => { if (c) pass++; else errs.push('ASSERT ' + m) }

// 1. Every route renders an h1, no runtime errors, no horizontal page scroll — per width and theme.
for (const [w, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [320, 'dark']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: theme, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })).newPage()
  p.on('pageerror', (e) => errs.push(`pageerror ${w} ${e.message}`))
  for (const r of routes) {
    await p.goto(base + '#/' + r); await p.waitForTimeout(450)
    ok(await p.locator('h1').first().isVisible(), `h1 ${r} ${w}`)
    ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, `no overflow ${r} ${w}`)
    if (shots) await p.screenshot({ path: `${shots}/${r.replace(/[/?=]/g, '_')}-${w}-${theme}.png`, fullPage: true })
  }
  await p.context().close()
}

// 2. Interactive flows at desktop and phone width.
for (const w of [1440, 390]) {
const p = await (await b.newContext({ viewport: { width: w, height: 900 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' })).newPage()
p.on('pageerror', (e) => errs.push(`pageerror flow ${w} ${e.message}`))
const U = base + '#/'
const out = shots ?? null
// Deploy flow: validation → preview → unknown → verify
await p.goto(U + 'projects'); await p.waitForTimeout(300)
await p.getByRole('button', { name: '部署项目' }).first().click()
await p.getByRole('radio', { name: /Docker Compose/ }).click()
await p.getByRole('button', { name: '下一步' }).click()
await p.getByRole('button', { name: '检查并预览' }).click()
ok(await p.getByText('选择目标服务器。').isVisible(), 'deploy validation shows server error')
await p.getByRole('combobox').first().click(); await p.getByRole('option', { name: /边缘节点/ }).click()
await p.getByLabel('服务名称').fill('notes')
await p.getByRole('button', { name: '检查并预览' }).click()
ok(await p.getByText('边缘节点 上已有同名项目。').isVisible(), 'duplicate name rejected on same server')
await p.getByLabel('服务名称').fill('blog')
await p.getByRole('combobox').nth(1).click(); await p.getByRole('option', { name: /个人站点/ }).click()
await p.getByRole('button', { name: '检查并预览' }).click()
await p.waitForTimeout(200)
out && await p.screenshot({ path: `${out}/flow-deploy-preview-${w}.png` })
ok(await p.getByText('确认后').isVisible(), 'preview lists consequences')
await p.getByRole('radio', { name: '结果未知' }).click()
await p.getByRole('button', { name: '确认部署' }).click()
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
ok(await p.getByRole('dialog').isVisible(), 'dialog not dismissible while running')
await p.waitForTimeout(2600)
out && await p.screenshot({ path: `${out}/flow-deploy-unknown-${w}.png` })
await p.getByRole('button', { name: '核对原操作' }).click(); await p.waitForTimeout(300)
ok(/operations\/op-/.test(p.url()), 'unknown result routes to operation detail')
await p.getByRole('button', { name: '核对原操作' }).click(); await p.waitForTimeout(2000)
ok(await p.getByText('已核对', { exact: true }).isVisible(), 'verify resolves unknown')
// Escape and focus return on a confirm dialog
await p.goto(U + 'projects/p-frps'); await p.waitForTimeout(300)
const restart = p.getByRole('button', { name: '重启' })
await restart.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(150)
ok(await p.getByRole('dialog').isVisible(), 'restart confirm opens via keyboard')
await p.keyboard.press('Escape'); await p.waitForTimeout(200)
ok(await restart.evaluate((el) => el === document.activeElement), 'focus returns to trigger after Escape')
// Uninstall requires typing the name
await p.getByRole('button', { name: '更多操作' }).click(); await p.getByRole('menuitem', { name: /完整卸载/ }).click()
const perm = p.getByRole('button', { name: '永久卸载' })
ok(await perm.isDisabled(), 'uninstall disabled before name typed')
await p.getByLabel(/输入项目名称/).fill('frps'); ok(await perm.isEnabled(), 'uninstall enabled after name typed')
out && await p.screenshot({ path: `${out}/flow-uninstall-${w}.png` })
await p.keyboard.press('Escape')
// Failed deploy residue cleanup keeps history
await p.goto(U + 'projects/failed'); await p.waitForTimeout(300)
ok(await p.getByText('有残留').isVisible(), 'failed record shows residue')
await p.getByRole('button', { name: '查看与清理' }).first().click(); await p.waitForTimeout(300)
await p.getByRole('button', { name: '清理残留…' }).click(); await p.getByRole('button', { name: '永久删除残留' }).click()
await p.waitForTimeout(1800)
ok(await p.getByText('已完成清理，历史保留。').isVisible(), 'residue cleaned, record kept')
// Compose uninstall lists volume scope
await p.goto(U + 'projects/p-notes'); await p.waitForTimeout(300)
await p.getByRole('button', { name: '更多操作' }).click(); await p.getByRole('menuitem', { name: /完整卸载/ }).click()
ok(await p.getByText('经核实归属本项目的命名卷数据与独占文件，无法恢复。').isVisible(), 'compose uninstall scope')
await p.keyboard.press('Escape')
// DNS pagination
await p.goto(U + 'dns'); await p.waitForTimeout(300)
await p.getByLabel('Zone', { exact: true }).click(); await p.getByRole('option', { name: /lab.example.test/ }).click()
ok(await p.getByText('第 1 / 3 页 · 共 46 条').isVisible(), 'dns pagination summary')
await p.getByRole('button', { name: '下一页' }).click()
ok(await p.getByText('node-21.lab.example.test').isVisible(), 'dns page 2 rows')
// Firewall forward validation
await p.goto(U + 'firewall?server=srv-edge'); await p.waitForTimeout(400)
await p.getByRole('tab', { name: '端口转发' }).click()
ok(await p.getByText('10.0.0.12:22').isVisible(), 'forward rule listed')
await p.getByRole('button', { name: '添加转发' }).click(); await p.getByRole('dialog').getByRole('button', { name: '添加' }).click()
ok(await p.getByText('填写端口或端口范围。').isVisible(), 'forward validation')
await p.keyboard.press('Escape')
// Notification deliveries
await p.goto(U + 'monitoring'); await p.waitForTimeout(300)
await p.getByRole('tab', { name: '通知投递' }).click()
ok(await p.getByText('dlv-2b7e').isVisible() && await p.getByText(/有投递结果未知/).isVisible(), 'delivery history with unknown guidance')
// Scenarios: error + empty
await p.getByRole('button', { name: /原型模拟/ }).click(); await p.getByRole('menuitemradio', { name: '读取失败' }).click(); await p.waitForTimeout(400)
ok(await p.getByText('读取失败', { exact: true }).first().isVisible(), 'error scenario shows retry state')
out && await p.screenshot({ path: `${out}/flow-error-${w}.png` })
await p.getByRole('button', { name: /原型模拟/ }).click(); await p.getByRole('menuitemradio', { name: '空实例' }).click()
await p.goto(U + 'overview'); await p.waitForTimeout(400)
out && await p.screenshot({ path: `${out}/flow-empty-overview-${w}.png`, fullPage: true })
ok(await p.getByText('还没有服务器').isVisible(), 'empty overview guides to add server')

await p.context().close()
}
await b.close()
console.log(`${pass} checks passed`)
if (errs.length) { console.error(errs.join('\n')); process.exit(1) }
