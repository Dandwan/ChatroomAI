import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const gradleArgs = process.argv.slice(2)

if (gradleArgs.length === 0) {
  console.error('Usage: node scripts/run-android-gradle.mjs <gradle-task> [...args]')
  process.exit(1)
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const androidDir = resolve(currentDir, '..', 'android')
const bundledJavaHome = '/opt/android-studio/jbr'
const env = { ...process.env }

if (!env.JAVA_HOME && existsSync(resolve(bundledJavaHome, 'bin', 'java'))) {
  env.JAVA_HOME = bundledJavaHome
  env.PATH = `${resolve(bundledJavaHome, 'bin')}:${env.PATH ?? ''}`
}

const command =
  process.platform === 'win32'
    ? {
        bin: 'cmd.exe',
        args: ['/d', '/s', '/c', 'gradlew.bat', ...gradleArgs],
      }
    : {
        bin: 'sh',
        args: ['./gradlew', ...gradleArgs],
      }

const child = spawn(command.bin, command.args, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
