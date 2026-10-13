import type { DesktopState, ExampleId, GuestCommand } from '../../shared/desktop'

export function useDesktop() {
  const state = shallowRef<DesktopState>()
  const error = shallowRef('')
  const available = shallowRef(false)
  let unsubscribe: (() => void) | undefined
  async function request(action: () => Promise<DesktopState>) {
    error.value = ''
    try {
      state.value = await action()
    }
    catch {
      error.value = 'The desktop operation could not be completed.'
    }
  }
  onMounted(async () => {
    const bridge = window.desktop
    if (!bridge)
      return
    available.value = true
    unsubscribe = bridge.onState((value) => {
      state.value = value
    })
    await request(bridge.getState)
  })
  onUnmounted(() => unsubscribe?.())
  return {
    state: readonly(state),
    error: readonly(error),
    available: readonly(available),
    openExample: (example: ExampleId) => window.desktop && request(() => window.desktop!.openExample(example)),
    command: (command: GuestCommand) => window.desktop && request(() => window.desktop!.command(command)),
    checkUpdates: () => window.desktop && request(() => window.desktop!.checkUpdates()),
  }
}
