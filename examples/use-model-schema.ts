import { useCursive, Type as t } from '../src/index'

const cursive = useCursive()

const schema = t.Object({
    name: t.String({ description: 'The name of the person' }),
    age: t.Number({ description: 'The age of the person' }),
    pets: t.Array(
        t.Object({
            name: t.String({ description: 'The name of the pet' }),
            age: t.Number({ description: 'The age of the pet' }),
            type: t.String({ description: 'The type of the pet' }),
        }),
        { description: 'The pets of the person' },
    ),
}, { 
    title: 'Person',
    description: 'A person object'
})

const { answer, choices } = await cursive.ask({ 
    schema,
    model: 'gpt-4',
    prompt: 'Create a random female person with two pets, one of which is a cat named "Mittens" and the other is a dog named "Spot".',
})

console.log(answer)
