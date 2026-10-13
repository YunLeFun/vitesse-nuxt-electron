<script setup lang="ts">
import type { DesktopState } from '../../shared/desktop'

defineProps<{ state?: DesktopState, available: boolean }>()
defineEmits<{ checkUpdates: [] }>()
</script>

<template>
  <footer class="status">
    <span v-if="state">Electron {{ state.electron }} · Chromium {{ state.chromium }} · {{ state.platform }} · v{{ state.version }}</span>
    <span v-else>{{ available ? 'Connecting to desktop…' : 'Web preview — start pnpm dev for desktop features' }}</span>
    <div class="update-status">
      <span>{{ state?.updates.message }}</span>
      <button v-if="state && state.updates.status !== 'disabled'" class="button compact" :disabled="state.updates.status === 'checking'" @click="$emit('checkUpdates')">
        Check updates
      </button>
    </div>
  </footer>
</template>

<style scoped>
.status { padding-top: 16px; font-size: 12px; color: var(--muted); display: flex; gap: 16px; justify-content: space-between; flex-wrap: wrap; }
.update-status { display: flex; align-items: center; gap: 12px; }
</style>
