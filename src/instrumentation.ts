export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { initFileLogger } = await import('./lib/fileLogger')
  initFileLogger()
}
