<script setup lang="ts">
import fs from 'node:fs'
import { ipcRenderer } from 'electron'
import consola from 'consola'
import { appName } from '~/constants'

useHead({
  title: appName,
})

onMounted(() => {
  consola.log('ipcRenderer:', ipcRenderer)
  consola.log('fs:', fs)
})
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
html, body , #__nuxt{
  height: 100vh;
  margin: 0;
  padding: 0;
}

html.dark {
  background: #222;
  color: white;
}
</style>
