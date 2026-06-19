import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const distRoot = join(process.cwd(), 'dist')
const cssDir = join(distRoot, 'css')

rmSync(distRoot, { recursive: true, force: true })
mkdirSync(cssDir, { recursive: true })
writeFileSync(join(cssDir, 'app.css'), '')
