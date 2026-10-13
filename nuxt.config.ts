export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-10-13',
  modules: ['@vueuse/nuxt', '@unocss/nuxt', '@nuxtjs/color-mode'],
  css: ['~/assets/main.css'],
  colorMode: { classSuffix: '' },
  devServer: { host: '127.0.0.1', port: 3000 },
  devtools: { enabled: true },
  app: {
    head: {
      title: 'Vitesse Nuxt Electron',
      meta: [{ name: 'description', content: 'Nuxt 4 + Electron Forge desktop starter' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/nuxt.svg' }],
    },
  },
  nitro: { prerender: { crawlLinks: false, routes: ['/'] } },
})
