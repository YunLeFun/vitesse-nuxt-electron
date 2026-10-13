<script setup lang="ts">
useHead({ title: 'About the starter' })
</script>

<template>
  <main class="about">
    <NuxtLink class="text-link" to="/">
      ← Back to the application
    </NuxtLink>
    <span class="eyebrow">THE DESKTOP FOUNDATION</span>
    <h1>Nuxt for the interface.<br>Electron for the host.</h1>
    <p>VueUse, UnoCSS and color mode remain available in the shared Nuxt application. Desktop code lives in the main process and two isolated preload scripts.</p>
    <ul>
      <li>The renderer has no Node.js or Electron imports.</li>
      <li>Web applications use independent, persistent sessions.</li>
      <li>The host validates the sender and every desktop request.</li>
      <li>Electron Forge creates installers and publishes release assets.</li>
    </ul>
    <p>See README.md for development, release signing and automatic updates.</p>
  </main>
</template>
