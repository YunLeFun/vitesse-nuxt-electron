import fs from 'node:fs/promises'
import { root } from './lib.mjs'

const metadata = JSON.parse(await fs.readFile(`${root}/package.json`, 'utf8'))
const tag = process.env.RELEASE_TAG
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag) || tag !== `v${metadata.version}`)
  throw new Error('Release tag must be a stable v<package.json version> tag.')
const repository = process.env.GITHUB_REPOSITORY
if (metadata.desktop.updateRepository !== repository)
  throw new Error('Set desktop.updateRepository to this repository before publishing.')
if (metadata.desktop.updatesEnabled !== true)
  throw new Error('Enable desktop.updatesEnabled before publishing an update-enabled release.')
console.info(`Validated release ${tag}`)
