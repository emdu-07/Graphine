import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { parseAlightXml } from '../src/alight/parser.ts'
import { inspectProject, inspectTimeline } from '../src/alight/inspect.ts'

import { CONSERVATIVE_TIMING, LAYER_RELATIVE_TIMING, resolveTimeline } from '../src/alight/timeline.ts'

const file = process.argv[2]
const policyName = process.argv[4]
const validOptions = process.argv.length === 3 || (process.argv.length === 5 && process.argv[3] === '--timing-policy' && ['source-only', 'layer-relative-v1'].includes(policyName))
const policy = policyName === 'layer-relative-v1' ? LAYER_RELATIVE_TIMING : CONSERVATIVE_TIMING
if (!file || !validOptions) {
  console.error('Usage: npm run alight:inspect -- <xml-file> [--timing-policy source-only|layer-relative-v1]')
  process.exitCode = 1
} else {
  try {
    const result = parseAlightXml(await readFile(file, 'utf8'))
    console.log(JSON.stringify({
      project: result.project ? inspectProject(result.project) : null,
      warnings: result.warnings, errors: result.errors,
      timing: result.project ? inspectTimeline(resolveTimeline(result.project, policy)) : null,
    }, null, 2))
    if (result.errors.length) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
