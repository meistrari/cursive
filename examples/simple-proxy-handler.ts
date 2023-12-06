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
    // messages: [{ 'role': 'user', 'content': 'Return a person called John, aged 43.' }],
    // schema: person,
    messages: [{ 'role': 'user', 'content': 'Get the weather for san francisco' }],
    model: 'gpt-3.5-turbo-16k', 
    // functions: [{
    //     "id":"01HGZR6XKCW03VX8DYTTAV2PBC",
    //     "name":"getWeather",
    //     "parameters":{
    //         "type":"object",
    //         "properties":{
    //             "city":{
    //                 "type":"string",
    //                 "description":"The city to get the weather for"
    //             },
    //             "unit":{
    //                 "type":"string",
    //                 "description":"Celsius or Farenheit"
    //             }
    //         }
    //     },
    //     "description":"Given a city returns the weather"
    // }]
})


if ('choices' in response) {
    console.log(response.choices.at(-1)?.message)
}
