<script lang="ts" setup>
import { useCursive } from '../../src/index'

const data = ref('')

if (process.client) {
    const cursive = useCursive({
        openAI: { apiKey: 'sk-***' },
    })

    cursive.ask({
        prompt: 'What is your name?',
        onToken: (token) => {
            data.value += token.content
        },
        stream: true,
    })
}
</script>

<template>
  <div>
    {{ data }}
  </div>
</template>
