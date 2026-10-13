import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const temp = process.env.RUNNER_TEMP
if (!temp)
  throw new Error('This helper runs on GitHub-hosted release runners.')
const keychain = path.join(temp, 'template-signing.keychain-db')
const certificate = path.join(temp, 'template-signing.p12')
const apiKey = path.join(temp, 'template-notarize.p8')
const windowsCertificate = path.join(temp, 'template-signing.pfx')
function security(args) {
  return new Promise((resolve, reject) => {
    execFile('security', args, error => error ? reject(new Error('Keychain operation failed.')) : resolve())
  })
}
function requireValues(names) {
  for (const name of names) {
    if (!process.env[name])
      throw new Error(`Missing release secret: ${name}`)
  }
}
async function setEnvironment(values) {
  if (!process.env.GITHUB_ENV)
    throw new Error('GITHUB_ENV is missing.')
  for (const value of Object.values(values)) {
    if (/[\r\n]/.test(value))
      throw new Error('Invalid multiline signing setting.')
  }
  await fs.appendFile(process.env.GITHUB_ENV, `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`)
}
if (process.argv.includes('--cleanup')) {
  if (process.platform === 'darwin')
    await security(['delete-keychain', keychain]).catch(() => undefined)
  for (const file of [certificate, apiKey, windowsCertificate])
    await fs.rm(file, { force: true })
}
else if (process.platform === 'darwin') {
  requireValues(['APPLE_CERTIFICATE_BASE64', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGN_IDENTITY', 'APPLE_API_KEY_BASE64', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'])
  const password = randomBytes(24).toString('hex')
  await fs.writeFile(certificate, Buffer.from(process.env.APPLE_CERTIFICATE_BASE64, 'base64'), { mode: 0o600 })
  await fs.writeFile(apiKey, Buffer.from(process.env.APPLE_API_KEY_BASE64, 'base64'), { mode: 0o600 })
  await security(['create-keychain', '-p', password, keychain])
  await security(['set-keychain-settings', '-lut', '21600', keychain])
  await security(['unlock-keychain', '-p', password, keychain])
  await security(['import', certificate, '-P', process.env.APPLE_CERTIFICATE_PASSWORD, '-k', keychain, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'])
  await security(['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain])
  await security(['list-keychains', '-d', 'user', '-s', keychain])
  await setEnvironment({
    APPLE_SIGN_IDENTITY: process.env.APPLE_SIGN_IDENTITY,
    APPLE_API_KEY_PATH: apiKey,
    APPLE_API_KEY_ID: process.env.APPLE_API_KEY_ID,
    APPLE_API_ISSUER: process.env.APPLE_API_ISSUER,
  })
}
else if (process.platform === 'win32') {
  requireValues(['WINDOWS_CERTIFICATE_BASE64', 'WINDOWS_CERTIFICATE_PASSWORD'])
  await fs.writeFile(windowsCertificate, Buffer.from(process.env.WINDOWS_CERTIFICATE_BASE64, 'base64'))
  await setEnvironment({ WINDOWS_CERTIFICATE_FILE: windowsCertificate, WINDOWS_CERTIFICATE_PASSWORD: process.env.WINDOWS_CERTIFICATE_PASSWORD })
}
