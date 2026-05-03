const { basename } = require('node:path')
const { main } = require('./lib/union-search.cjs')

const explicitScriptName = process.argv[2]
const hasExplicitScriptName =
  typeof explicitScriptName === 'string' && explicitScriptName.endsWith('.internal')

const scriptName = hasExplicitScriptName ? explicitScriptName : basename(process.argv[1] || '')
const argv = hasExplicitScriptName ? process.argv.slice(3) : process.argv.slice(2)

main(scriptName, argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
