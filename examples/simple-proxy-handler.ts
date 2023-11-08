import { createCursiveProxy, Type as t } from "../src"

const person = t.Object({
    name: t.String(),
    age: t.Number(),
}, { 
    title: 'Person',
    description: 'A person object'
})

const proxy = createCursiveProxy()

const response = await proxy.handle({
    messages: [{ 'role': 'user', 'content': 'Return a person called John, aged 43.' }],
    model: 'gpt-3.5-turbo-16k',
    schema: person
})

if ('choices' in response) {
    console.log(response.choices.at(0)?.message?.content)
}

