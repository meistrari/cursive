import { createFunction, useCursive, z } from '../src'

const { query } = useCursive({
    apiKey: process.env.OPENAI_API_KEY!,
})

const addTodo = createFunction({
    name: 'addTodo',
    description: 'Add a todo to the list',
    parameters: {
        title: z.string().describe('The title of the todo'),
        dueDate: z.string().describe('The due date of the todo'),
    },
    async execute({ title, dueDate }) {
        db.todos.push({ title, description, dueDate })
        return { success: true }
    },
})

const { data, error } = await query({
    functions: [addTodo],
    prompt: 'Remember me to buy some milk tomorrow',
})

if (error)
    console.error(error)
