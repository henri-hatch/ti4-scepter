import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function run() {
  try {
    console.log('🔧 Building frontend...')
    await execAsync('npm run build', { cwd: './scepter-client' })

    console.log('🚀 Starting backend...')
    const server = exec('python main.py', {
      cwd: './scepter-server',
      env: {
        ...process.env,
        FLASK_ENV: 'production'
      }
    })

    server.stdout.pipe(process.stdout)
    server.stderr.pipe(process.stderr)
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

run()
