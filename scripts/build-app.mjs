// Builds the redesigned prototype (prototype/app) into an isolated output directory.
// STACKPIER_PROTOTYPE_DEPS: directory holding node_modules installed from this package-lock.json.
// STACKPIER_PROTOTYPE_OUTPUT: output directory outside the repository.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const deps = process.env.STACKPIER_PROTOTYPE_DEPS
const output = process.env.STACKPIER_PROTOTYPE_OUTPUT
if (!deps || !output || ![deps, output].every(path.isAbsolute) || output === root || output.startsWith(root + '/'))
  throw Error('Set isolated absolute STACKPIER_PROTOTYPE_DEPS and STACKPIER_PROTOTYPE_OUTPUT directories')
const req = createRequire(path.join(deps, 'package.json'))
const { build } = req('esbuild')
const app = path.join(root, 'app')

if (!process.argv.includes('--no-check')) {
  // Dependencies live outside the repository, so point the checker at them through a generated config.
  await fs.mkdir(output, { recursive: true })
  const nm = path.join(deps, 'node_modules')
  const check = path.join(output, 'tsconfig.check.json')
  await fs.writeFile(check, JSON.stringify({
    extends: path.join(app, 'tsconfig.json'),
    compilerOptions: { typeRoots: [path.join(nm, '@types')], paths: { '*': [nm + '/@types/*', nm + '/*'] } },
    include: [app + '/**/*.ts', app + '/**/*.tsx'],
  }))
  execFileSync(process.execPath, [req.resolve('typescript/bin/tsc'), '-p', check], { stdio: 'inherit' })
}

await fs.mkdir(output, { recursive: true })
const css = (await Promise.all(['ds/tokens.css', 'ds/components.css', 'shell.css', 'pages/pages.css'].map((f) => fs.readFile(path.join(app, f), 'utf8')))).join('\n')
await fs.writeFile(path.join(output, 'app.css'), css)
await fs.copyFile(path.join(app, 'index.html'), path.join(output, 'index.html'))
const result = await build({
  entryPoints: [path.join(app, 'main.tsx')], bundle: true, format: 'iife', minify: true, sourcemap: 'linked',
  target: ['chrome111', 'safari16.4', 'firefox128'], outfile: path.join(output, 'app.js'), jsx: 'automatic',
  nodePaths: [path.join(deps, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, metafile: true, logLevel: 'warning',
})
const inputs = Object.keys(result.metafile.inputs)
if (inputs.some((n) => /\/(antd|tailwindcss)\//.test(n))) throw Error('Unexpected legacy UI dependency in bundle')
await fs.writeFile(path.join(output, 'build-manifest.json'), JSON.stringify({ designSystem: 'StackPier Console (Radix Primitives + CSS tokens)', sources: inputs.filter((n) => !n.includes('node_modules')) }, null, 2) + '\n')
console.log('Prototype app output: ' + output)
