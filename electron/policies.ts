import type { DesktopRequest, ViewportBounds } from '../shared/desktop'
import { createHash } from 'node:crypto'
import path from 'node:path'

export function isLoopbackOrigin(input: string): boolean {
  try {
    const url = new URL(input)
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
  }
  catch { return false }
}

export function isAllowedPage(input: string, origins: readonly string[]): boolean {
  try {
    const url = new URL(input)
    return !url.username && !url.password && origins.includes(url.origin)
      && (url.protocol === 'https:' || isLoopbackOrigin(url.origin))
  }
  catch { return false }
}

export function parseRequest(input: unknown): DesktopRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid desktop request')
  const value = input as Record<string, unknown>
  switch (value.type) {
    case 'snapshot':
    case 'check-updates':
      return { type: value.type }
    case 'open-example':
      if (value.example === 'electron' || value.example === 'nuxt')
        return { type: value.type, example: value.example }
      break
    case 'guest-command':
      if (['back', 'forward', 'reload', 'close'].includes(String(value.command)))
        return { type: value.type, command: value.command as 'back' | 'forward' | 'reload' | 'close' }
      break
    case 'theme':
      if (value.preference === 'system' || value.preference === 'light' || value.preference === 'dark')
        return { type: value.type, preference: value.preference }
      break
    case 'viewport': {
      if (value.bounds === null)
        return { type: value.type, bounds: null }
      const bounds = value.bounds as Record<string, unknown> | undefined
      if (bounds && ['x', 'y', 'width', 'height'].every(key =>
        typeof bounds[key] === 'number' && Number.isFinite(bounds[key]) && Math.abs(bounds[key] as number) <= 100000)) {
        return { type: value.type, bounds: { x: bounds.x as number, y: bounds.y as number, width: bounds.width as number, height: bounds.height as number } }
      }
      break
    }
  }
  throw new Error('Unsupported desktop request')
}

export function clampViewport(bounds: ViewportBounds, size: { width: number, height: number }, zoom = 1): ViewportBounds {
  const x = Math.max(0, Math.min(size.width, Math.round(bounds.x * zoom)))
  const y = Math.max(0, Math.min(size.height, Math.round(bounds.y * zoom)))
  return {
    x,
    y,
    width: Math.max(0, Math.min(size.width - x, Math.round(bounds.width * zoom))),
    height: Math.max(0, Math.min(size.height - y, Math.round(bounds.height * zoom))),
  }
}

export function resolveAsset(root: string, pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname)
    if (decoded.includes('\0') || decoded.includes('\\'))
      return null
    const file = path.resolve(root, `.${decoded}`)
    const relative = path.relative(root, file)
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? file : null
  }
  catch { return null }
}

export function contentSecurityPolicy(html: string): string {
  const hashes = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
    .filter(([, attrs, code]) => !/\bsrc\s*=/i.test(attrs!) && !!code?.trim() && !/application\/(?:json|ld\+json)/i.test(attrs!))
    .map(([, , code]) => `'sha256-${createHash('sha256').update(code!).digest('base64')}'`)
  return [
    'default-src \'self\'',
    `script-src 'self' ${hashes.join(' ')}`,
    'style-src \'self\' \'unsafe-inline\'',
    'img-src \'self\' data:',
    'font-src \'self\'',
    'connect-src \'self\'',
    'object-src \'none\'',
    'base-uri \'none\'',
    'frame-src \'none\'',
    'frame-ancestors \'none\'',
  ].join('; ')
}

export function validUpdateRepository(input: unknown): input is string {
  return typeof input === 'string' && /^[\w.-]+\/[\w.-]+$/.test(input)
}
