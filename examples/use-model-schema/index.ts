import { useCursive, Type as t } from '../../src/index'

const cursive = useCursive()

const schema = t.Object({
    name: t.String({ description: 'The name of the person' }),
    age: t.Number({ description: 'The age of the person' }),
}, { 
    title: 'Person',
    description: 'A person object'
})

const { answer } = await cursive.ask({ 
    schema,
    prompt: 'John is 20 years old',
})

console.log(answer)
