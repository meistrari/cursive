![Logo](/docs/logo-dark.svg#gh-dark-mode-only)
![Logo](/docs/logo-light.svg#gh-light-mode-only)

Cursive is a universal and intuitive framework for interacting with LLMs.

It works in any JavaScript runtime and has a heavy focus on extensability and developer experience.

## highlights
<img width=14 height=0 src=""/>✦ **Universal** - Cursive works in any runtime, including the browser, Node.js, Deno, Bun and Cloudflare Workers. Through [WindowAI](https://windowai.io), users can securely bring their own API and model to completions.

<img width=14 height=0 src=""/>✦ **Extensible** - You can easily hook into any part of a completion life cycle. Be it to log, cache or modify the results.

<img width=14 height=0 src=""/>✦ **Functions** - Easily describe functions that the LLM can use along with it's definition.

<img width=14 height=0 src=""/>✦ **Universal** - Cursive's goal is to bridge as manu capabilities between different models as possible. Ultimately, this means that with a single interface, you can allow your users to choose any model.

<img width=14 height=0 src=""/>✦ **Informative** - Cursive comes with builtin token usage and costs calculations, as accurate as possible.

<img width=14 height=0 src=""/>✦ **Reliable** - Cursive comes with automatic retry and model expanding upon exceeding context length. Which you can always configure.

## quickstart
1. Install.

    ```bash
    npm i cursive-gpt
    ```

2. Start using.

    ```ts
    import { useCursive } from 'cursive-gpt'

    const cursive = useCursive({
        openAI: {
            apiKey: 'sk-xxxx'
        }
    })

    const { answer } = await cursive.ask({
        prompt: 'What is the meaning of life?',
    })
    ```

## usage
### Conversation
Chaining a conversation is easy with `cursive`. You can pass any of the options you're used to with OpenAI's API.

```ts
const resA = await cursive.ask({
    prompt: 'Give me a good name for an gecko.',
    model: 'gpt-4',
    maxTokens: 16,
})

console.log(resA.answer) // Zephyr

const resB = await resA.conversation.ask({
    prompt: 'How would you say it in portuguese?'
})

console.log(resB.answer) // Zéfiro
```
### Streaming
Streaming is also supported, and we also keep track of the tokens for you!
```ts
const result = await cursive.ask({
    prompt: 'Count to 10',
    stream: true,
    onToken(partial) {
        console.log(partial.content)
    }
})

console.log(result.usage.totalTokens) // 40
```

### Functions
You can use `zod` to define and describe functions, along side with their execution code.
```ts
import { createFunction, useCursive, z } from 'cursive-gpt'

const cursive = useCursive({
    openAI: {
        apiKey: 'sk-xxxx'
    }
})

const sum = createFunction({
    name: 'sum',
    description: 'sums two numbers',
    parameters: {
        a: z.number().describe('Number A'),
        b: z.number().describe('Number B'),
    },
    async execute({ a, b }) {
        return a + b
    },
})

const { answer } = await cursive.ask({
    prompt: 'What is the sum of 232 and 243?',
    functions: [sum],
})

console.log(answer) // The sum of 232 and 243 is 475.
```

The functions' result will automatically fed into the conversation and another completion will be made. If you want to prevent this, you can add `pause` to your function definition.

```ts
const createCharacter = createFunction({
    name: 'createCharacter',
    description: 'Creates a character',
    parameters: {
        name: z.string().describe('The name of the character'),
        age: z.number().describe('The age of the character'),
    },
    pause: true,
    async execute({ name, age }) {
        return { name, age }
    },
})

const { functionResult } = await cursive.ask({
    prompt: 'Create a character named John who is 23 years old.',
    functions: [createCharacter],
})

console.log(functionResult) // { name: 'John', age: 23 }
```

### Hooks
You can hook into any part of the completion life cycle.
```ts
cursive.on('completion:after', (result) => {
    console.log(result.cost.total)
    console.log(result.usage.total_tokens)
})

cursive.on('completion:error', (error) => {
    console.log(error)
})

cursive.ask({
    prompt: 'Can androids dream of electric sheep?',
})

// 0.0002185
// 113
```

### Embedding
You can create embeddings pretty easily with `cursive`.
```ts
const embedding = await cursive.embed('This should be a document.')
```
This will support different types of documents and integrations pretty soon.

### Reliability
Cursive comes with automatic retry with backoff and model expanding upon exceeding context length -- which means that it tries again with a model with a bigger context length when it fails by running out of it.

You can configure this behavior by passing the `retry` and `expand` options to `useCursive`.

```ts
const cursive = useCursive({
    maxRetries: 5, // 0 disables it completely
    expand: {
        enable: true,
        defaultsTo: 'gpt-3.5-turbo-16k',
        modelMapping: {
            'gpt-3.5-turbo': 'gpt-3.5-turbo-16k',
            'gpt-4': 'gpt-4-32k',
        },
        allowWindowAI: true
    }
})
```

## roadmap

### vendor support
- [ ] Anthropic
- [ ] Cohere
- [ ] Azure OpenAI models
- [ ] Huggingface
- [ ] Replicate 
