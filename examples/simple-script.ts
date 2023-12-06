import { useCursive } from '../src/index'

const cursive = useCursive({ countUsage: true })

const { answer, usage, error } = await cursive.ask({ 
    prompt: 'Tell me a short short joke',
})

console.log({
    answer,
    usage,
    error: error?.details
})
