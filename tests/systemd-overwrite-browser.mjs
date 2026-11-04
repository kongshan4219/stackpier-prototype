// 正文覆盖原型：桌面/窄屏确认、取消和沿用项目身份。所有数据为浏览器模拟。
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.join(process.env.STACKPIER_PROTOTYPE_DEPS, 'package.json'))
const { chromium } = require('playwright-core')
const browser = await chromium.launch({executablePath:process.env.STACKPIER_CHROMIUM ?? '/usr/bin/google-chrome',args:['--no-sandbox']})
try {
  for (const width of [1440,320]) {
    const page = await browser.newPage({viewport:{width,height:1000}})
    const base=process.env.STACKPIER_APP_URL ?? 'http://127.0.0.1:18572/'
    await page.goto(base+'#/operations/op-7f3a')
    await page.getByRole('button',{name:'核对原操作',exact:true}).click()
    await page.getByText('已核对',{exact:true}).waitFor()
    await page.goto(base+'#/projects/p-agent')
    await page.getByRole('button',{name:'重新部署',exact:true}).click()
    await page.getByRole('button',{name:'检查并预览',exact:true}).click()
    await page.getByRole('button',{name:'确认部署',exact:true}).click()
    const confirm=page.getByRole('dialog',{name:'项目已部署，是否继续覆盖？',exact:true})
    await confirm.getByRole('button',{name:'继续并覆盖',exact:true}).click({trial:true})
    if(process.env.STACKPIER_SHOTS) await page.screenshot({path:path.join(process.env.STACKPIER_SHOTS,`overwrite-${width}.png`),animations:'disabled'})
    await confirm.getByRole('button',{name:'取消',exact:true}).click()
    await page.getByRole('button',{name:'确认部署',exact:true}).click()
    await confirm.getByRole('button',{name:'继续并覆盖',exact:true}).click()
    await page.getByRole('button',{name:'查看项目',exact:true}).waitFor()
    await page.getByRole('button',{name:'查看项目',exact:true}).click()
    if(!page.url().endsWith('/projects/p-agent')) throw Error('overwrite changed project identity')
    await page.close()
  }
  process.stdout.write('2 overwrite flows passed\n')
} finally {await browser.close()}
