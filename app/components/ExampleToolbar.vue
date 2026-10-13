<script setup lang="ts">
import type { ExampleId, GuestCommand, GuestState } from '../../shared/desktop'

defineProps<{ available: boolean, guest?: GuestState }>()
defineEmits<{ open: [example: ExampleId], command: [command: GuestCommand] }>()
</script>

<template>
  <div class="toolbar">
    <div class="example-actions">
      <button class="button primary" :disabled="!available" @click="$emit('open', 'electron')">
        Open Electron docs
      </button>
      <button class="button" :disabled="!available" @click="$emit('open', 'nuxt')">
        Open Nuxt docs
      </button>
    </div>
    <div class="navigation-actions">
      <button class="button compact" :disabled="!guest?.canGoBack" aria-label="Go back" @click="$emit('command', 'back')">
        ←
      </button>
      <button class="button compact" :disabled="!guest?.canGoForward" aria-label="Go forward" @click="$emit('command', 'forward')">
        →
      </button>
      <button class="button" :disabled="!guest?.open" @click="$emit('command', 'reload')">
        Reload
      </button>
      <button class="button" :disabled="!guest?.open" @click="$emit('command', 'close')">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar, .example-actions, .navigation-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar { justify-content: space-between; padding: 18px 0; }
</style>
