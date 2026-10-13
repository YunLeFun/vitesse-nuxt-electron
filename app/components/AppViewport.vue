<script setup lang="ts">
defineProps<{ open: boolean, error?: string }>()
const viewport = useTemplateRef<HTMLDivElement>('viewport')
let observer: ResizeObserver | undefined
let frame = 0

function reportBounds() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const rect = viewport.value?.getBoundingClientRect()
    if (rect && window.desktop)
      void window.desktop.setViewport({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined)
  })
}
onMounted(() => {
  observer = new ResizeObserver(reportBounds)
  if (viewport.value)
    observer.observe(viewport.value)
  window.addEventListener('resize', reportBounds)
  window.addEventListener('scroll', reportBounds, true)
  reportBounds()
})
onUnmounted(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  window.removeEventListener('resize', reportBounds)
  window.removeEventListener('scroll', reportBounds, true)
  void window.desktop?.setViewport(null).catch(() => undefined)
})
</script>

<template>
  <div ref="viewport" class="viewport" data-testid="app-viewport">
    <div v-if="!open" class="placeholder">
      <span class="preview-mark">↗</span>
      <h2>Your web application goes here</h2>
      <p>Choose a documentation site above to open an isolated Chromium view.</p>
    </div>
  </div>
  <p v-if="error" role="alert" class="error">
    {{ error }}
  </p>
</template>

<style scoped>
.viewport { flex: 1; min-height: 220px; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); }
.placeholder { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; }
.placeholder h2 { font-size: 20px; margin: 16px 0 8px; }
.placeholder p { color: var(--muted); margin: 0; max-width: 400px; line-height: 1.6; }
.preview-mark { color: var(--accent); font-size: 34px; }
</style>
