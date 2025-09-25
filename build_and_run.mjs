const mode = (process.argv[2] || 'prod').toLowerCase()

if (mode === 'dev') {
  await import('./build_and_run.dev.mjs')
} else if (mode === 'prod' || mode === 'production') {
  await import('./build_and_run.prod.mjs')
} else {
  console.error(`Unknown mode "${mode}". Use "dev" or "prod".`)
  process.exit(1)
}
