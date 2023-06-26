import { createFunction, useCursive } from '../src'

const cursive = useCursive({
    apiKey: process.env.OPENAI_API_KEY!,
    // debug: true,
})

cursive.on('completion:after', (result, duration) => {
    console.log(result.usage?.completion_tokens, duration)
})

const add = createFunction({
    name: 'add',
    description: 'Adds two numbers a and b.',
    async execute({ a, b }) {
        return 1345
    },
})

const result = await cursive.query({
    functions: [add],
    temperature: 0,
    messages: new Array(1).fill(0).map(_ => ({
        role: 'user',
        content: 'What can you do?',
    }) as const),
})

console.log(result.choices)
// if (result.error)
//     console.log(result.error)

// else
//     console.log(result)
