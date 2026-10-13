import type { Session } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { contentSecurityPolicy, resolveAsset } from './policies'

export function registerScheme() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  }])
}

export async function serveShell(session: Session, root: string) {
  if (await session.protocol.isProtocolHandled('app'))
    return
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8')
  const policy = contentSecurityPolicy(html)
  session.protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'shell' || !['GET', 'HEAD'].includes(request.method))
      return new Response('Forbidden', { status: 403 })
    let file = resolveAsset(root, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!file)
      return new Response('Invalid path', { status: 400 })
    try {
      if (!(await fs.stat(file)).isFile())
        return new Response('Not found', { status: 404 })
    }
    catch {
      if (path.extname(url.pathname) || url.pathname.startsWith('/api/'))
        return new Response('Not found', { status: 404 })
      file = path.join(root, 'index.html')
    }
    const real = await fs.realpath(file)
    const relative = path.relative(await fs.realpath(root), real)
    if (relative.startsWith('..') || path.isAbsolute(relative))
      return new Response('Forbidden', { status: 403 })
    const response = await net.fetch(pathToFileURL(file).toString())
    const headers = new Headers(response.headers)
    headers.set('Content-Security-Policy', policy)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers })
  })
}
