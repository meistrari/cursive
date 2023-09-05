![Logo](/docs/logo-dark.svg#gh-dark-mode-only)
![Logo](/docs/logo-light.svg#gh-light-mode-only)

Cursive is a universal and intuitive framework for interacting with LLMs.

It works in any JavaScript runtime and has a heavy focus on extensibility and developer experience.

## ■ Highlights
<img width=14 height=0 src=""/>✦ **Compatible** - Cursive works in any runtime, including the browser, Node.js, Deno, Bun and Cloudflare Workers. Through [WindowAI](https://windowai.io), users can securely bring their own credentials, provider, and model to completions.

<img width=14 height=0 src=""/>✦ **Extensible** - You can easily hook into any part of a completion life cycle. Be it to log, cache, or modify the results.

<img width=14 height=0 src=""/>✦ **Functions** - Easily describe functions that the LLM can use along with its definition, with any model (currently supporting GPT-4, GPT-3.5, Claude 2, and Claude Instant)

<img width=14 height=0 src=""/>✦ **Universal** - Cursive's goal is to bridge as many capabilities between different models as possible. Ultimately, this means that with a single interface, you can allow your users to choose any model.

<img width=14 height=0 src=""/>✦ **Informative** - Cursive comes with built-in token usage and costs calculations, as accurate as possible.

<img width=14 height=0 src=""/>✦ **Reliable** - Cursive comes with automatic retry and model expanding upon exceeding context length. Which you can always configure.

## ■ Quickstart
1. Install.

    ```bash
    npm i cursive
    ```

2. Start using.

    ```ts
    import { useCursive } from 'cursive'

    const cursive = useCursive({
        openAI: {
            apiKey: 'sk-xxxx'
        }
    })

    const { answer } = await cursive.ask({
        prompt: 'What is the meaning of life?',
    })
    ```

## ■ Usage
### Conversation
Chaining a conversation is easy with `cursive`. You can pass any of the options you're used to with OpenAI's API.

```ts
const resA = await cursive.ask({
    prompt: 'Give me a good name for a gecko.',
    model: 'gpt-4',
    maxTokens: 16,
})

console.log(resA.answer) // Zephyr

const resB = await resA.conversation.ask({
    prompt: 'How would you say it in Portuguese?'
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
You can use `Type` to define and describe functions, along side with their execution code.
This is powered by the [**`typebox`**](https://github.com/sinclairzx81/typebox) library.
```ts
import { Type, createFunction, useCursive } from 'cursive'

const cursive = useCursive({
    openAI: {
        apiKey: 'sk-xxxx'
    }
})

const sum = createFunction({
    name: 'sum',
    description: 'Sums two numbers',
    parameters: {
        a: Type.Number({ description: 'Number A' }),
        b: Type.Number({ description: 'Number B' }),
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

The functions' result will automatically be fed into the conversation and another completion will be made. If you want to prevent this, you can add `pause` to your function definition.

```ts
const createCharacter = createFunction({
    name: 'createCharacter',
    description: 'Creates a character',
    parameters: {
        name: Type.String({ description: 'The name of the character' }),
        age: Type.Number({ description: 'The age of the character' }),
        hairColor: Type.StringEnum(['black', 'brown', 'blonde', 'red', 'white'], { description: 'The hair color of the character' }),
    },
    pause: true,
    async execute({ name, age, hairColor }) {
        return { name, age, hairColor }
    },
})

const { functionResult } = await cursive.ask({
    prompt: 'Create a character named John who is 23 years old.',
    functions: [createCharacter],
})

console.log(functionResult) // { name: 'John', age: 23 }
```

If you're on a `0.x.x` version, you can check here for the [old documentation](https://github.com/meistrari/cursive/tree/v0.12.2).

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
Cursive comes with automatic retry with backoff upon failing completions, and model expanding upon exceeding context length -- which means that it tries again with a model with a bigger context length when it fails by running out of it.

You can configure this behavior by passing the `retry` and `expand` options to `useCursive`.

```ts
const cursive = useCursive({
    maxRetries: 5, // 0 disables it completely
    expand: {
        enable: true,
        defaultsTo: 'gpt-3.5-turbo-16k',
        modelMapping: {
            'gpt-3.5-turbo': 'gpt-3.5-turbo-16k',
            'gpt-4': 'claude-2',
        },
    },
    allowWindowAI: true,
    countUsage: false, // When disabled doesn't load and execute token counting and price estimates
})
```

## ■ Examples

-  <img src="https://seeklogo.com/images/N/nuxt-logo-64E0472AA8-seeklogo.com.png" width=16/> **[Nuxt ⇢ Simple Application](https://github.com/meistrari/cursive/blob/main/examples/nuxt)**
-  <img src="https://seeklogo.com/images/C/cloudflare-workers-logo-9BF89B51E2-seeklogo.com.png" width=16/> **[Cloudflare Workers ⇢ Simple Edge API](https://github.com/meistrari/cursive/blob/main/examples/cf-workers)**

## ■ Roadmap

### Vendor support
- [x] Anthropic
- [ ] Cohere (works on browser through WindowAI)
- [ ] Azure OpenAI models
- [ ] Huggingface (works on browser through WindowAI)
- [ ] Replicate (works on browser through WindowAI)


## ■ Credits

Thanks to [**@disjukr**](https://github.com/disjukr) for transferring the `cursive` npm package name to us!