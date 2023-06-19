// import { createFunction, useCursive, z } from '../src'

// const { query } = useCursive({
//     apiKey: process.env.OPENAI_API_KEY!,
// })

// const recall = createFunction({
//     name: 'recallFromMemory',
//     description: 'Recalls specific context needed to answer the question from things ranging from conversations to documents, if theres nothing to be recalled returns null',
//     parameters: {
//         timerange: z.string().optional().describe('The time range of the memory'),
//         question: z.string().describe('What is the memory about. It can be the whole question if needed'),
//     },
//     async execute({ question, timerange }) {
//         // const embedding = await createEmbedding(question)
//         // const docs = vdb.search(embedding).limit(5)
//         // const memory = docs.map(({ content }) => content).join('\n')
//         return `John told peter to grab more coffee beans from the store.`
//     },
// })

// const multiplication = createFunction({
//     name: 'add',
//     description: 'Adds two numbers a and b.',
//     parameters: {
//         a: z.number().describe('First number'),
//         b: z.number().describe('Second number'),
//     },
//     async execute({ a, b }) {
//         return a + b
//     },
// })

// const { data, error } = await query({
//     functions: [recall],
//     prompt: 'What did John tell peter to grab??',
//     // systemMessage: 'You\'re a calculator. If theres an operation that you have a function at the ready, use it. If not, NEVER CALL ANY FUNCTIONS THAT YOU DONT KNOW. Just answer with what you know. And dont tell the user you dont have the function, just be helpful and answer.',
//     temperature: 0,
// })

// console.log(data)
// if (error)
//     console.error(error)
