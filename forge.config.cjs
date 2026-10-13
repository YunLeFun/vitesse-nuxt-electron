const path = require('node:path')
const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const metadata = require('./package.json')

const repository = metadata.desktop.updateRepository.split('/')
module.exports = {
  packagerConfig: {
    name: metadata.productName,
    executableName: 'vitesse-nuxt-electron',
    appBundleId: metadata.desktop.appId,
    appCategoryType: 'public.app-category.developer-tools',
    asar: true,
    ignore: (file) => {
      if (!file)
        return false
      return ![
        /^\/package\.json$/,
        /^\/LICENSE$/,
        /^\/dist-electron(?:\/|$)/,
        /^\/\.output$/,
        /^\/\.output\/public(?:\/|$)/,
        /^\/node_modules(?:\/|$)/,
      ].some(pattern => pattern.test(file.replaceAll('\\', '/')))
    },
    ...(process.env.APPLE_SIGN_IDENTITY
      ? {
          osxSign: { identity: process.env.APPLE_SIGN_IDENTITY, hardenedRuntime: true },
        }
      : {}),
    ...(process.env.APPLE_API_KEY_PATH
      ? {
          osxNotarize: {
            appleApiKey: process.env.APPLE_API_KEY_PATH,
            appleApiKeyId: process.env.APPLE_API_KEY_ID,
            appleApiIssuer: process.env.APPLE_API_ISSUER,
          },
        }
      : {}),
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {
      name: 'vitesse_nuxt_electron',
      certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
      certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
    } },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg', config: { format: 'ULFO' } },
    { name: '@electron-forge/maker-deb', config: { options: { maintainer: metadata.author.name, homepage: metadata.repository.url } } },
  ],
  publishers: [{
    name: '@electron-forge/publisher-github',
    config: { repository: { owner: repository[0], name: repository[1] }, draft: true, prerelease: false },
  }],
  plugins: [new FusesPlugin({
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })],
  hooks: {
    async prePackage() {
      const { runNode } = await import('./scripts/lib.mjs')
      await runNode(path.join(__dirname, 'scripts/build.mjs'))
    },
    async preStart() {
      if (process.env.TEMPLATE_DEV_ORIGIN)
        return
      const { runNode } = await import('./scripts/lib.mjs')
      await runNode(path.join(__dirname, 'scripts/build.mjs'))
    },
  },
}
