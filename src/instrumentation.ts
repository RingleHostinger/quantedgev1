/**
 * Next.js 15 Instrumentation Hook
 *
 * Runs once on server startup before any route handlers execute.
 * Loads environment variables from .env and .env.local files so they are
 * available to all server-side code, including API routes that use
 * server-only env vars like ODDS_API_KEY.
 *
 * This is necessary because next.config.ts's loadEnvFiles() only runs at
 * config-parse time, not in the request-handling worker context.
 */

export async function register() {
  // Only run in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: fs } = await import('fs')
    const { default: path } = await import('path')

    // Determine the app root directory (where .env files live)
    // In production (next start), __dirname is inside .next/server/
    // Walk up until we find the .env file
    function findAppRoot(): string {
      let dir = process.cwd()
      // Try cwd first (works in dev and most production setups)
      if (fs.existsSync(path.join(dir, '.env')) || fs.existsSync(path.join(dir, '.env.local'))) {
        return dir
      }
      // Fallback: walk up from __dirname
      try {
        dir = path.resolve(__dirname, '../../../..')
        if (fs.existsSync(path.join(dir, '.env'))) return dir
      } catch { /* ignore */ }
      return process.cwd()
    }

    function loadEnvFile(filePath: string): void {
      if (!fs.existsSync(filePath)) return
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx < 0) continue
          const key = trimmed.slice(0, eqIdx).trim()
          const value = trimmed.slice(eqIdx + 1).trim()
          // Don't overwrite vars already set in the process environment
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      } catch { /* ignore read errors */ }
    }

    const appRoot = findAppRoot()
    // Load in priority order: .env first, then .env.local overrides
    loadEnvFile(path.join(appRoot, '.env'))
    loadEnvFile(path.join(appRoot, '.env.local'))
  }
}
