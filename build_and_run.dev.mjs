import { spawn } from 'child_process'

const processes = []
let shuttingDown = false

function prefixLines(prefix, data) {
  const text = data.toString()
  const lines = text.split(/\r?\n/)
  const formatted = lines
    .filter((line, index) => line.length > 0 || index < lines.length - 1)
    .map(line => `[${prefix}] ${line}`)
    .join('\n')

  if (formatted) {
    return `${formatted}\n`
  }

  return ''
}

function startProcess(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false
  })

  processes.push({ name, child })

  child.stdout.on('data', data => {
    process.stdout.write(prefixLines(name, data))
  })

  child.stderr.on('data', data => {
    process.stderr.write(prefixLines(name, data))
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    const humanSignal = signal ? ` signal ${signal}` : ''
    console.log(`\n${name} process exited with code ${code}${humanSignal}`)
    stopAll()

    const exitCode = Number.isInteger(code) ? code : (signal ? 1 : 0)
    process.exit(exitCode)
  })

  child.on('error', error => {
    console.error(`Failed to start ${name} process:`, error)
    shuttingDown = true
    stopAll()
    process.exit(1)
  })
}

function stopAll() {
  processes.forEach(({ child }) => {
    if (!child.killed) {
      child.kill('SIGINT')
    }
  })
}

function handleShutdown(reason) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`\nReceived ${reason}, shutting down child processes...`)
  stopAll()
}

console.log('🔧 Starting frontend (Vite dev server)...')
startProcess('frontend', 'npm', ['run', 'dev'], {
  cwd: './scepter-client',
  env: {
    ...process.env,
    FORCE_COLOR: '1'
  }
})

console.log('🚀 Starting backend (Flask dev server)...')
startProcess('backend', 'python', ['main.py'], {
  cwd: './scepter-server',
  env: {
    ...process.env,
    FLASK_ENV: 'development'
  }
})

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('exit', () => {
  if (!shuttingDown) {
    stopAll()
  }
})
