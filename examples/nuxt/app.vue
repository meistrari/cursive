<script lang="ts" setup>
import { useCursive } from '../../src/index'

const data = ref('')

if (process.client) {
    const cursive = useCursive({
        openAI: { apiKey: 'sk-***' },
    })
    console.log('asking')
    cursive.ask({
        systemMessage: 'Hello, I am Cursive. I am an AI that can write text for you.',
        prompt: 'What is your name?',
        model: 'gpt-4',
        n: 5,
        temperature: 1.5,
    }).then(console.log)
}
</script>

<template>
  <div>
    {{ data }}
  </div>
</template>
