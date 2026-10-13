import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { clampViewport, contentSecurityPolicy, isAllowedPage, isLoopbackOrigin, parseRequest, resolveAsset, validUpdateRepository } from '../../electron/policies'

describe('desktop trust policy', () => {
  it('allows declared HTTPS origins, but rejects credentials and host suffix spoofing', () => {
    const origins = ['https://nuxt.com']
    expect(isAllowedPage('https://nuxt.com/docs', origins)).toBe(true)
    for (const url of ['https://nuxt.com.evil.example/', 'https://user:password@nuxt.com/', 'http://nuxt.com/', 'file:///etc/passwd', 'app://shell/'])
      expect(isAllowedPage(url, origins)).toBe(false)
  })
  it('accepts only explicit loopback development origins', () => {
    expect(isLoopbackOrigin('http://127.0.0.1:3000')).toBe(true)
    for (const url of ['http://localhost.evil.test', 'http://0.0.0.0:3000', 'http://localhost/path', 'http://localhost?x=1', 'https://localhost'])
      expect(isLoopbackOrigin(url)).toBe(false)
  })
  it('rejects forged commands and nonfinite layout values', () => {
    for (const input of [null, [], { type: 'open-example', example: 'file:///tmp' }, { type: 'execute', script: '...' }, { type: 'viewport', bounds: { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 100 } }])
      expect(() => parseRequest(input)).toThrow()
    expect(parseRequest({ type: 'theme', preference: 'dark' })).toEqual({ type: 'theme', preference: 'dark' })
  })
  it('confines viewport updates to the current window', () => {
    expect(clampViewport({ x: -20, y: 50, width: 5000, height: 5000 }, { width: 800, height: 600 }))
      .toEqual({ x: 0, y: 50, width: 800, height: 550 })
    expect(clampViewport({ x: 20, y: 20, width: 100, height: 100 }, { width: 800, height: 600 }, 1.5))
      .toEqual({ x: 30, y: 30, width: 150, height: 150 })
  })
  it('keeps decoded resource paths inside the static bundle', () => {
    const root = path.resolve('fixture')
    expect(resolveAsset(root, '/_nuxt/app.js')).toBe(path.join(root, '_nuxt/app.js'))
    for (const name of ['/../secret', '/%2e%2e/secret', '/%00secret', '/%5c..%5csecret', '/%invalid'])
      expect(resolveAsset(root, name)).toBeNull()
  })
  it('hashes executable inline Nuxt scripts without allowing arbitrary inline JavaScript', () => {
    const csp = contentSecurityPolicy('<script>window.test = 1</script><script src="/app.js"></script><script type="application/json">{}</script>')
    expect(csp).toContain('\'sha256-')
    expect(csp.split(';').find(item => item.trim().startsWith('script-src'))).not.toContain('\'unsafe-inline\'')
    expect(csp).toContain('frame-ancestors \'none\'')
    expect(contentSecurityPolicy('<script>window.test = 2</script>')).not.toBe(csp)
  })
  it('accepts an update repository, never a page-supplied feed URL', () => {
    expect(validUpdateRepository('YunLeFun/vitesse-nuxt-electron')).toBe(true)
    for (const value of ['', 'https://evil.test/feed', 'owner/repo/extra', null])
      expect(validUpdateRepository(value)).toBe(false)
  })
})
