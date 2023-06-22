import { createFunction, useCursive } from '../src'

const { query } = useCursive({
    apiKey: process.env.OPENAI_API_KEY!,
})

const add = createFunction({
    name: 'add',
    description: 'Adds two numbers a and b.',
    async execute({ a, b }) {
        return 1345
    },
})

const result = await query({
    functions: [add],
    // prompt: 'How much is 125 + 1233?',
    temperature: 0,
    messages: new Array(1).fill(0).map(_ => ({
        role: 'user',
        content: 'How much is 125 + 1233?',
    }) as const),
})

if (result.error)
    console.log(result.error.details)

console.log(result)
