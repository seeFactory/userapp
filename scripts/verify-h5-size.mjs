import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'

const distRoot = join(process.cwd(), 'dist')
const kib = 1024
const budgets = {
  maxJsAssetBytes: 620 * kib,
  maxEntrypointBytes: 390 * kib,
  // H5 pages are split into lazy chunks; keep the raw total budget aligned with the current multi-runtime page set.
  maxTotalJsBytes: 4200 * kib,
  maxLogoCopies: 1
}

function collectFiles(dir) {
  if (!existsSync(dir)) return []
  const files = []
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        visit(fullPath)
      } else {
        files.push({
          path: fullPath,
          relativePath: relative(distRoot, fullPath).split(sep).join('/'),
          size: stat.size
        })
      }
    }
  }
  visit(dir)
  return files
}

function formatBytes(value) {
  return `${(value / kib).toFixed(1)} KiB`
}

const files = collectFiles(distRoot)
const jsFiles = files.filter((file) => file.relativePath.endsWith('.js'))
const logoFiles = files.filter((file) => file.relativePath.endsWith('/logo.png') || file.relativePath === 'static/logo.png')
const indexHtml = join(distRoot, 'index.html')
const entrypointPaths = existsSync(indexHtml)
  ? Array.from(readFileSync(indexHtml, 'utf8').matchAll(/(?:src|href)=["']\/?([^"']+\.(?:js|css))["']/g)).map((match) => match[1])
  : []
const entrypointFiles = (entrypointPaths.length ? entrypointPaths : ['js/771.js', 'css/app.css', 'js/app.js'])
  .map((path) => files.find((file) => file.relativePath === path))
  .filter(Boolean)

const largestJs = [...jsFiles].sort((left, right) => right.size - left.size)[0]
const totalJsBytes = jsFiles.reduce((sum, file) => sum + file.size, 0)
const entrypointBytes = entrypointFiles.reduce((sum, file) => sum + file.size, 0)
const totalGzipJsBytes = jsFiles.reduce((sum, file) => sum + gzipSync(readFileSync(file.path)).length, 0)

const failures = []
if (largestJs && largestJs.size > budgets.maxJsAssetBytes) {
  failures.push(`largest js asset ${largestJs.relativePath} is ${formatBytes(largestJs.size)}, budget ${formatBytes(budgets.maxJsAssetBytes)}`)
}
if (entrypointBytes > budgets.maxEntrypointBytes) {
  failures.push(`entrypoint is ${formatBytes(entrypointBytes)}, budget ${formatBytes(budgets.maxEntrypointBytes)}`)
}
if (totalJsBytes > budgets.maxTotalJsBytes) {
  failures.push(`total js is ${formatBytes(totalJsBytes)}, budget ${formatBytes(budgets.maxTotalJsBytes)}`)
}
if (logoFiles.length > budgets.maxLogoCopies) {
  failures.push(`logo copies ${logoFiles.length}, budget ${budgets.maxLogoCopies}`)
}

const summary = {
  largestJs: largestJs ? `${largestJs.relativePath} ${formatBytes(largestJs.size)}` : 'none',
  entrypoint: formatBytes(entrypointBytes),
  totalJs: formatBytes(totalJsBytes),
  totalGzipJs: formatBytes(totalGzipJsBytes),
  logoCopies: logoFiles.map((file) => file.relativePath),
  budgets: Object.fromEntries(Object.entries(budgets).map(([key, value]) => [
    key,
    key === 'maxLogoCopies' ? value : formatBytes(value)
  ]))
}

console.log(JSON.stringify(summary, null, 2))

if (failures.length) {
  console.error(`H5 size budget failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
