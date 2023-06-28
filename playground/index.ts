import { createFunction, useCursive, z } from '../src'

const cursive = useCursive({
    apiKey: process.env.OPENAI_API_KEY!,
    debug: true,
})

cursive.on('completion:after', (result, duration) => {
    console.log(result.usage?.completion_tokens, duration)
})

const add = createFunction({
    name: 'add',
    description: 'Adds two numbers a and b.',
    parameters: {
        a: z.number().describe('The first number.'),
        b: z.number().describe('The second number.'),
    },
    async execute({ a, b }) {
        return a + b
    },
})

const result = await cursive.query({
    functionCall: add,
    temperature: 0,
    messages: new Array(1).fill(0).map(_ => ({
        role: 'user',
        content: 'how much is 293 + 123?',
    }) as const),
})

// console.log(result.error.details)
// if (result.error)
//     console.log(result.error)

// else
console.log(result)
