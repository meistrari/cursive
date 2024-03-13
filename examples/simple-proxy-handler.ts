import { createCursiveProxy, Type as t } from "../src"

const person = t.Object({
    name: t.String(),
    age: t.Number(),
}, { 
    title: 'Person',
    description: 'A person object'
})

const proxy = createCursiveProxy({ countUsage: true })

const response = await proxy.handle({
    messages: [{ 'role': 'user', 'content': 'WHATS THE WEATHER IN SAN FRANCISCO?' }],
    model: 'gpt-3.5-turbo-16k', 
    functions: [
        {
            name: 'getWeather',
            description: 'returns the weather in a specific city',
            parameters: {
                properties: {
                    city: {
                        type: 'string',
                        description: 'the city to get the weather for',
                    }
                },
                type: 'object',
                required: ['city']
            }
        }
    ]
})

console.log(response)

if ('choices' in response) {
    console.log(response.choices.at(0))
}

