# Vitesse Nuxt Electron

Nuxt 4 + Vue 3 + Electron, packaged with **Electron Forge**, the tool used by the official Electron tutorial. VueUse, UnoCSS and color mode are available in the renderer.

This starter includes a local Nuxt interface, isolated WebContentsView examples, two restricted preload scripts, development orchestration, application updates and release workflows.

## Requirements

- Node.js 24.15 or newer in the Node 24 release line.
- pnpm 11 (the exact version is pinned in package.json).
- Electron 44.7.0 is pinned to a supported stable release. Dependabot proposes newer stable versions.

## Development

```sh
corepack enable
pnpm install
pnpm dev
```

The development script checks port availability, starts Nuxt on 127.0.0.1, waits for its health response and compiled preloads, then starts Electron through Forge. Nuxt changes use HMR. Changes under electron/ rebuild the desktop bundles and restart Electron. Ctrl+C and closing the Electron process stop the child processes.

Set PORT in your shell to choose another port. A conflicting port fails explicitly; the app will not silently attach to another local server.

```sh
pnpm dev:web    # ordinary browser preview; desktop controls are disabled
pnpm build      # static Nuxt renderer + main/preload bundles
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e   # actual Electron integration tests; no Chrome download needed
```

## Embedded applications

The demo opens Electron or Nuxt documentation in a WebContentsView. Each example has a separate persistent Session. Closing the view releases its WebContents; reopening the same example retains its own website storage.

- Main and guest renderers use context isolation, sandboxing and no Node integration.
- The shell can call only the typed methods in shared/desktop.ts.
- Every shell request must come from the registered shell WebContents and its main frame.
- Guest pages receive only templateHost.getEnvironment(), validated against the current main frame and exact origin.
- Examples allow navigation only within their configured origin. Popups and device permissions are denied in this minimal starter.
- The shell custom protocol is registered only in the shell Session. Guests cannot load the local application.
- Vue manages the content rectangle; Electron manages the native View. A Vue z-index does not place a dialog above a WebContentsView.
- Packaged content has a CSP that hashes Nuxt's inline bootstrap scripts instead of enabling arbitrary inline JavaScript.

Extend electron/policies.ts and the typed bridges for real application requirements. Do not expose ipcRenderer, unrestricted IPC channels, credentials or arbitrary filesystem/network operations to a page. The demo intentionally does not implement browser-style OAuth popups or YunLeFun SSO.

The static shell loads from app://shell. Its protocol handler serves only .output/public and supports refreshing Nuxt routes. There is no local Nitro server in the installed application. A future remote API needs an explicit base URL and matching CORS policy.

## Package and make installers

```sh
pnpm package          # application bundle in out/
pnpm make             # native installers + update artifacts in out/make/
pnpm verify:package   # checks the ASAR's renderer, preloads and runtime dependencies
```

Forge's prePackage hook builds the static client and desktop bundles before packaging. Runtime dependencies use pnpm's hoisted linker so Forge can collect and prune them correctly. Source files, tests, secrets and the Nitro server are excluded. Packaged Electron fuses disable Node CLI startup, NODE_OPTIONS and inspector arguments, and require the ASAR bundle.

Build each target on its matching operating system. The workflows cover:

| Platform | Artifacts |
| --- | --- |
| macOS arm64 / x64 | DMG installer and ZIP update payload |
| Windows x64 | Squirrel Setup.exe, full.nupkg and RELEASES update metadata |
| Linux x64 | Debian package; updates through the package manager |

An unsigned local package is useful for smoke tests. Published macOS releases require Developer ID signing and notarization. Release CI requires signing credentials for Windows as well.

## Automatic application updates

electron/updates.ts uses the official update-electron-app module and Electron's built-in autoUpdater. Installed macOS/Windows apps check on startup and every hour. Downloaded updates prompt the user to restart; the renderer cannot set an update feed or force installation. Development runs and Linux packages show that automatic updates are unavailable.

The default source is the Electron team's update.electronjs.org service for **public GitHub repositories**. It serves published stable releases; draft releases are not delivered to users. Signed macOS releases are required for updates to work. Windows must be installed through the Squirrel installer rather than launched from an arbitrary unpacked directory.

Before using this template for your own app, edit package.json:

```json
{
  "name": "your-app",
  "productName": "Your App",
  "repository": {
    "type": "git",
    "url": "https://github.com/owner/repository"
  },
  "desktop": {
    "appId": "com.example.your-app",
    "updateRepository": "owner/repository",
    "updatesEnabled": true
  }
}
```

Also set executableName and the Squirrel package name in forge.config.cjs before the first release. Keep these names, appId and Session partition keys stable across updates. For a private repository or domestic object-storage delivery, replace the update source and publishing configuration together; do not place GitHub credentials in the client.

## Signed release workflow

1. Set the GitHub Secrets below.
2. Bump package.json to a stable version using a Conventional Commit.
3. Push the matching vX.Y.Z tag, or dispatch Release with an existing matching tag.
4. Forge creates a draft GitHub release and uploads all platform installer/update assets.
5. The final job publishes the draft only after all platform builds, tests and uploads succeed.

The workflow verifies that the tag matches package.json and that the configured update repository is this repository. If a platform fails, the release remains a draft; fix it and rerun the failed jobs. Install signing files are created in the ephemeral runner's temporary directory and removed afterwards.

| Secret | Use |
| --- | --- |
| APPLE_CERTIFICATE_BASE64 | Base64-encoded Developer ID Application .p12 |
| APPLE_CERTIFICATE_PASSWORD | Password for that .p12 |
| APPLE_SIGN_IDENTITY | Developer ID Application certificate identity |
| APPLE_API_KEY_BASE64 | Base64-encoded App Store Connect notarization .p8 key |
| APPLE_API_KEY_ID | Notarization API key ID |
| APPLE_API_ISSUER | Notarization API issuer ID |
| WINDOWS_CERTIFICATE_BASE64 | Base64-encoded Authenticode .pfx |
| WINDOWS_CERTIFICATE_PASSWORD | Password for that .pfx |

GITHUB_TOKEN is provided by GitHub Actions with contents: write. The template does not publish a release during local build or make.

## Template maintenance

.github/dependabot.yml opens weekly dependency and GitHub Actions update PRs. Related desktop and Nuxt patch/minor updates are grouped; major changes remain reviewable PRs. CI checks types, lint, security policy tests, actual Electron behavior and native packaging before merging. There is no automatic merge of major upgrades.

TypeScript stays on version 6 until vue-tsc supports the newer compiler API. Build script approval is explicit in pnpm-workspace.yaml. The template does not need nuxt-electron, renderer Node polyfills, PWA caching or a bundled web server.

## Structure

```text
app/                    Nuxt 4 pages, components and composables
shared/desktop.ts       Typed renderer/host contract
electron/main.ts        Window, views, Sessions and IPC validation
electron/preload.*.ts   Separate shell and guest bridges
electron/protocol.ts    Local static protocol and CSP
electron/policies.ts    Testable navigation/input/path policies
electron/updates.ts     Official updater integration
scripts/                Development, builds, package checks and signing helpers
forge.config.cjs        Official packaging, makers, publishing and fuses
tests/                  Unit policies and real Electron integration tests
```

CJS output is intentional for sandbox preload compatibility. Application source and Vite build configuration use TypeScript/ES modules.

## References

- [Electron's packaging tutorial](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
- [Electron Forge](https://www.electronforge.io/)
- [Official automatic update guide](https://www.electronforge.io/advanced/auto-update)
- [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)

[MIT](./LICENSE) © YunYouJun
