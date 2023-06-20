import { createFunction, useCursive, z } from '../src'

const { query } = useCursive({
    apiKey: process.env.OPENAI_API_KEY!,
})

const add = createFunction({
    name: 'add',
    description: 'Adds two numbers a and b.',
    parameters: {
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
    },
    context: { c: 1 },
    async execute({ a, b }, { c }) {
        console.log({ a, b, c })
        return (a + b) * c
    },
})

const { data, error } = await query({
    functions: [add],
    prompt: 'How much is 125 + 1233?',
    temperature: 0,
})

console.log(data)
if (error)
    console.error(error)
