// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: { enabled: true },
    $development: {
        build: {
            transpile: ['@web-std/stream'],
        },
    },
})
