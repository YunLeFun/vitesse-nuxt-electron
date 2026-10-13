<script setup lang="ts">
const { state, error, available, openExample, command, checkUpdates } = useDesktop()
const colorMode = useColorMode()
const description = computed(() => state.value?.guest.open
  ? state.value.guest.url || 'Loading application…'
  : 'A shared Nuxt interface. A separate Chromium view for every web application.')
function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  void window.desktop?.setTheme(colorMode.preference as 'light' | 'dark')
}
</script>

<template>
  <main class="desktop">
    <header class="header">
      <div>
        <span class="eyebrow">NUXT 4 + ELECTRON FORGE</span>
        <h1>One interface. Separate applications.</h1>
        <p class="description">
          {{ description }}
        </p>
      </div>
      <nav class="header-actions">
        <NuxtLink class="text-link" to="/about">
          About the starter
        </NuxtLink>
        <button class="button" aria-label="Toggle color theme" @click="toggleTheme">
          Theme
        </button>
      </nav>
    </header>
    <ExampleToolbar :available="available" :guest="state?.guest" @open="openExample" @command="command" />
    <p v-if="error" role="alert" class="error">
      {{ error }}
    </p>
    <AppViewport :open="state?.guest.open || false" :error="state?.guest.error" />
    <RuntimeStatus :state="state" :available="available" @check-updates="checkUpdates" />
  </main>
</template>
