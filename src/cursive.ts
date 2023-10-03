import type { ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import { resguard } from 'resguard'
import type { Hookable } from 'hookable'
import { createDebugger, createHooks } from 'hookable'
import { type ChatMessage, type CompletionOptions, type MessageOutput } from 'window.ai'
import type { CursiveAnswerResult, CursiveAskCost, CursiveAskOnToken, CursiveAskOptions, CursiveAskOptionsWithPrompt, CursiveAskUsage, CursiveFunction, CursiveFunctionSchema, CursiveHook, CursiveHooks, CursiveSetupOptions } from './types'
import { CursiveError, CursiveErrorCode } from './types'
import type { IfNull } from './util'
import { randomId, sleep, toSnake } from './util'
import { resolveAnthropicPricing, resolveOpenAIPricing } from './pricing'
import { createOpenAIClient, processOpenAIStream } from './vendor/openai'
import { resolveVendorFromModel } from './vendor'
import { createAnthropicClient, getAnthropicFunctionCallDirectives, processAnthropicStream } from './vendor/anthropic'
import { getOpenAIUsage } from './usage/openai'
import { getAnthropicUsage } from './usage/anthropic'

export class Cursive {
    public _hooks: Hookable<CursiveHooks>
    public _vendor: {
        openai: ReturnType<typeof createOpenAIClient>
        anthropic: ReturnType<typeof createAnthropicClient>
    }

    public options: CursiveSetupOptions

    private _usingWindowAI = false
    private _debugger: { close: () => void }
    private _ready = false

    constructor(options: CursiveSetupOptions = {
        countUsage: true,
    }) {
        this._hooks = createHooks<CursiveHooks>()
        this._vendor = {
            openai: createOpenAIClient({ apiKey: options?.openAI?.apiKey || ('process' in globalThis && process.env.OPENAI_API_KEY) }),
            anthropic: createAnthropicClient({ apiKey: options?.anthropic?.apiKey || ('process' in globalThis && process.env.ANTHROPIC_API_KEY) }),
        }
        this.options = options

        if (options.debug)
            this._debugger = createDebugger(this._hooks, { tag: 'cursive' })

        if (options.allowWindowAI === undefined || options.allowWindowAI === true) {
            if (typeof window !== 'undefined') {
                // Wait for the window.ai to be available, for a maximum of half a second
                const start = Date.now()
                const interval = setInterval(() => {
                    if (window.ai) {
                        clearInterval(interval)
                        this._usingWindowAI = true
                        this._ready = true
                        if (options.debug)
                            console.log('[cursive] Using WindowAI')
                    }
                    else if (Date.now() - start > 500) {
                        clearInterval(interval)
                        this._ready = true
                    }
                }, 100)
            }
            else {
                this._ready = true
            }
        }
        else {
            this._ready = true
        }
    }

    private _readyCheck() {
        return new Promise((resolve) => {
            let tries = 0
            const interval = setInterval(() => {
                if (this._ready || ++tries > 80) {
                    clearInterval(interval)
                    resolve(null)
                }
            }, 10)
        })
    }

    on<H extends CursiveHook>(event: H, callback: CursiveHooks[H]) {
        this._hooks.hook(event, callback as any)
    }

    async ask(
        options: CursiveAskOptions,
    ): Promise<CursiveAnswerResult> {
        await this._readyCheck()
        const result = await buildAnswer(options, this)
        if (result.error) {
            return new CursiveAnswer<CursiveError>({
                result: null,
                error: result.error,
            })
        }

        const newMessages = [
            ...result.messages,
            { role: 'assistant', content: result.answer } as const,
        ]

        return new CursiveAnswer<null>({
            result,
            error: null,
            messages: newMessages,
            cursive: this,
        })
    }

    async embed(content: string) {
        await this._readyCheck()
        const options = {
            model: 'text-embedding-ada-002',
            input: content,
        }
        await this._hooks.callHook('embedding:before', options)
        const start = Date.now()
        const response = await this._vendor.openai.createEmbedding(options)

        const data = await response.json()

        if (data.error) {
            const error = new CursiveError(data.error.message, data.error, CursiveErrorCode.EmbeddingError)
            await this._hooks.callHook('embedding:error', error, Date.now() - start)
            await this._hooks.callHook('embedding:after', null, error, Date.now() - start)
            throw error
        }
        const result = {
            embedding: data.data[0].embedding,
        }
        await this._hooks.callHook('embedding:success', result, Date.now() - start)
        await this._hooks.callHook('embedding:after', result, null, Date.now() - start)

        return result.embedding as number[]
    }
}

export class CursiveConversation {
    public _cursive: Cursive
    public messages: ChatCompletionRequestMessage[] = []

    constructor(messages: ChatCompletionRequestMessage[]) {
        this.messages = messages
    }

    async ask(options: CursiveAskOptionsWithPrompt): Promise<CursiveAnswerResult> {
        const { prompt, ...rest } = options
        const resolvedOptions = {
            ...(rest as any),
            messages: [
                ...this.messages,
                { role: 'user', content: prompt },
            ],
        }

        const result = await buildAnswer(resolvedOptions, this._cursive)

        if (result.error) {
            return new CursiveAnswer<CursiveError>({
                result: null,
                error: result.error,
            })
        }

        const newMessages = [
            ...result.messages,
            { role: 'assistant', content: result.answer } as const,
        ]

        return new CursiveAnswer<null>({
            result,
            error: null,
            messages: newMessages,
            cursive: this._cursive,
        })
    }
}

export class CursiveAnswer<E extends null | CursiveError> {
    public choices: IfNull<E, string[]>
    public id: IfNull<E, string>
    public model: IfNull<E, string>
    public usage: IfNull<E, CursiveAskUsage>
    public cost: IfNull<E, CursiveAskCost>
    public error: E
    public functionResult?: IfNull<E, any>
    /**
     * The text from the answer of the last choice
     */
    public answer: IfNull<E, string>
    /**
     * A conversation instance with all the messages so far, including this one
     */
    public conversation: IfNull<E, CursiveConversation>

    constructor(options: {
        result: any | null
        error: E
        messages?: ChatCompletionRequestMessage[]
        cursive?: Cursive
    }) {
        if (options.error) {
            this.error = options.error
            this.choices = null
            this.id = null
            this.model = null
            this.usage = null
            this.cost = null
            this.answer = null
            this.conversation = null
            this.functionResult = null
        }
        else {
            this.error = null
            this.choices = options.result.choices
            this.id = options.result.id
            this.model = options.result.model
            this.usage = options.result.usage
            this.cost = options.result.cost
            this.answer = options.result.answer
            this.functionResult = options.result.functionResult
            const conversation = new CursiveConversation(options.messages) as any
            conversation._cursive = options.cursive
            this.conversation = conversation
        }
    }
}

export function useCursive(options: CursiveSetupOptions) {
    return new Cursive(options)
}

function resolveOptions(options: CursiveAskOptions) {
    const {
        functions: functionsRaw = [],
        messages = [],
        model = 'gpt-3.5-turbo-0613',
        systemMessage,
        prompt,
        functionCall,
        abortSignal: __,
        ...rest
    } = options

    // TODO: Add support for function call resolving
    const vendor = resolveVendorFromModel(model)
    let resolvedSystemMessage = systemMessage || ''

    const functions = resolveFunctionList(functionsRaw)

    if (vendor === 'anthropic' && functions.length > 0)
        resolvedSystemMessage = `${systemMessage || ''}\n\n${getAnthropicFunctionCallDirectives(functions)}`

    const hasSystemMessage = messages.some(message => message.role === 'system')

    let filteredMessages = messages
    if (hasSystemMessage && resolvedSystemMessage)
        filteredMessages = messages.filter(message => message.role !== 'system')

    const queryMessages = [
        resolvedSystemMessage && { role: 'system', content: resolvedSystemMessage },
        ...filteredMessages,
        prompt && { role: 'user', content: prompt },
    ].filter(Boolean) as ChatCompletionRequestMessage[]

    const resolvedFunctionCall = functionCall
        ? typeof functionCall === 'string'
            ? functionCall
            : { name: functionCall.schema.name }
        : undefined

    const payload: CreateChatCompletionRequest = {
        ...toSnake(rest),
        model,
        messages: queryMessages,
        function_call: resolvedFunctionCall,
    }

    const resolvedOptions = {
        ...rest,
        model,
        messages: queryMessages,
    }

    return { payload, resolvedOptions }
}

async function createCompletion(context: {
    payload: CreateChatCompletionRequest
    cursive: Cursive
    abortSignal?: AbortSignal
    onToken?: CursiveAskOnToken
}) {
    const { payload, abortSignal } = context
    await context.cursive._hooks.callHook('completion:before', payload)
    const start = Date.now()

    let data: CreateChatCompletionResponse & { cost: CursiveAskCost; error: any }
    const vendor = resolveVendorFromModel(payload.model)

    // TODO:    Improve the completion creation based on model to vendor matching
    //          For now this will do
    // @ts-expect-error - We're using a private property here
    if (context.cursive._usingWindowAI) {
        const resolvedModel = vendor ? `${vendor}/${payload.model}` : payload.model

        const options: CompletionOptions<string> = {
            maxTokens: payload.max_tokens,
            model: resolvedModel,
            numOutputs: payload.n,
            stopSequences: payload.stop as string[],
            temperature: payload.temperature,
        }

        if (payload.stream && context.onToken) {
            options.onStreamResult = (result) => {
                const resultResolved = result as MessageOutput
                context.onToken({ content: resultResolved.message.content, functionCall: null })
            }
        }

        const response = await window.ai.generateText({
            messages: payload.messages as ChatMessage[],
        }, options) as MessageOutput[]
        data = {} as any
        data.choices = response.map(choice => ({
            message: choice.message,
        }))
        data.model = payload.model
        data.id = randomId()
        data.usage = {
            prompt_tokens: null,
            completion_tokens: null,
            total_tokens: null,
        } as any

        if (context.cursive.options.countUsage) {
            const content = data.choices.map(choice => choice.message.content).join('')
            if (vendor === 'openai') {
                data.usage.prompt_tokens = await getOpenAIUsage(context.payload.messages)
                data.usage.completion_tokens = await getOpenAIUsage(content)
            }

            else if (vendor === 'anthropic') {
                data.usage.prompt_tokens = await getAnthropicUsage(context.payload.messages)
                data.usage.completion_tokens = await getAnthropicUsage(content)
            }

            else {
                // TODO: Create better estimations for other vendors
                data.usage.prompt_tokens = await getOpenAIUsage(context.payload.messages)
                data.usage.completion_tokens = await getOpenAIUsage(content)
                data.usage.total_tokens = data.usage.completion_tokens + data.usage.prompt_tokens
            }
        }
    }
    else {
        if (vendor === 'openai') {
            const response = await context.cursive._vendor.openai.createChatCompletion({ ...payload }, abortSignal)
            if (payload.stream) {
                data = await processOpenAIStream({ ...context, response })
                const content = data.choices.map(choice => choice.message.content).join('')
                if (context.cursive.options.countUsage) {
                    data.usage.completion_tokens = await getOpenAIUsage(content)
                    data.usage.total_tokens = data.usage.completion_tokens + data.usage.prompt_tokens
                }
            }
            else {
                data = await response.json()
            }
        }
        else if (vendor === 'anthropic') {
            const response = await context.cursive._vendor.anthropic({ ...payload }, abortSignal)
            if (payload.stream) {
                data = await processAnthropicStream({ ...context, response })
            }
            else {
                const responseData = await response.json()

                if (responseData.error)
                    throw new CursiveError(responseData.error.message, responseData.error, CursiveErrorCode.CompletionError)

                data = {
                    choices: [{ message: { content: responseData.completion.trimStart() } }],
                    model: payload.model,
                    id: randomId(),
                    usage: {} as any,
                } as any
            }

            // We check for function call in the completion
            const hasFunctionCallRegex = /<function-call>([^<]+)<\/function-call>/
            const functionCallMatches = data.choices[0].message.content.match(hasFunctionCallRegex)

            if (functionCallMatches) {
                const functionCall = JSON.parse(functionCallMatches[1].trim())
                data.choices[0].message.function_call = {
                    name: functionCall.name,
                    arguments: JSON.stringify(functionCall.arguments),
                }
            }
            if (context.cursive.options.countUsage) {
                data.usage.prompt_tokens = await getAnthropicUsage(context.payload.messages)
                data.usage.completion_tokens = await getAnthropicUsage(data.choices[0].message.content)
                data.usage.total_tokens = data.usage.completion_tokens + data.usage.prompt_tokens
            }
            // We check for answers in the completion
            const hasAnswerRegex = /<cursive-answer>([^<]+)<\/cursive-answer>/
            const answerMatches = data.choices[0].message.content.match(hasAnswerRegex)
            if (answerMatches) {
                const answer = answerMatches[1].trim()
                data.choices[0].message.content = answer
            }
        }
    }
    if (context.cursive.options.countUsage && data.usage) {
        if (vendor === 'openai') {
            data.cost = resolveOpenAIPricing({
                completionTokens: data.usage.completion_tokens,
                promptTokens: data.usage.prompt_tokens,
                totalTokens: data.usage.total_tokens,
            }, data.model)
        }
        else if (vendor === 'anthropic') {
            data.cost = resolveAnthropicPricing({
                completionTokens: data.usage.completion_tokens,
                promptTokens: data.usage.prompt_tokens,
                totalTokens: data.usage.total_tokens,
            }, data.model)
        }
    }
    else {
        data.cost = null
    }

    const end = Date.now()

    if (data.error) {
        const error = new CursiveError(data.error.message, data.error, CursiveErrorCode.CompletionError)
        await context.cursive._hooks.callHook('completion:error', error, end - start)
        await context.cursive._hooks.callHook('completion:after', null, error, end - start)
        throw error
    }

    await context.cursive._hooks.callHook('completion:success', data, end - start)
    await context.cursive._hooks.callHook('completion:after', data, null, end - start)

    return data as CreateChatCompletionResponse & { cost: CursiveAskCost }
}

async function askModel(
    options: CursiveAskOptions,
    cursive: Cursive,
): Promise<{
        answer: CreateChatCompletionResponse & { functionResult?: any; cost: CursiveAskCost }
        messages: ChatCompletionRequestMessage[]
    }> {
    await cursive._hooks.callHook('query:before', options)

    const { payload, resolvedOptions } = resolveOptions(options)
    const functions = resolveFunctionList(options.functions || [])

    if (typeof options.functionCall !== 'string' && options.functionCall?.schema)
        functions.push(options.functionCall)

    const functionSchemas = functions.map(({ schema }) => schema)

    if (functionSchemas.length > 0)
        payload.functions = functionSchemas

    let completion = await resguard(createCompletion({
        payload,
        cursive,
        onToken: options.onToken,
        abortSignal: options.abortSignal,
    }), CursiveError)

    if (completion.error) {
        if (!completion.error?.details)
            throw new CursiveError(`Unknown error: ${completion.error.message}`, completion.error, CursiveErrorCode.UnknownError, completion.error.stack)

        const cause = completion.error.details.code || completion.error.details.type
        if (cause === 'context_length_exceeded') {
            if (!cursive.options.expand || cursive.options.expand?.enabled === true) {
                const defaultModel = cursive.options?.expand?.defaultsTo || 'gpt-3.5-turbo-16k'
                const modelMapping = cursive.options?.expand?.modelMapping || {}
                const resolvedModel = modelMapping[options.model] || defaultModel
                completion = await resguard(
                    createCompletion({
                        payload: { ...payload, model: resolvedModel },
                        cursive,
                        onToken: options.onToken,
                        abortSignal: options.abortSignal,
                    }),
                    CursiveError,
                )
            }
        }

        else if (cause === 'invalid_request_error') {
            throw new CursiveError('Invalid request', completion.error.details, CursiveErrorCode.InvalidRequestError)
        }

        // TODO: Handle other errors

        if (completion.error) {
            // TODO: Add a more comprehensive retry strategy
            for (let i = 0; i < cursive.options.maxRetries; i++) {
                completion = await resguard(createCompletion({
                    payload,
                    cursive,
                    onToken: options.onToken,
                    abortSignal: options.abortSignal,
                }), CursiveError)

                if (!completion.error) {
                    if (i > 3)
                        await sleep(1000 * (i - 3) * 2)
                    break
                }
            }
        }
    }

    if (completion.error) {
        const error = new CursiveError('Error while completing request', completion.error.details, CursiveErrorCode.CompletionError)
        await cursive._hooks.callHook('query:error', error)
        await cursive._hooks.callHook('query:after', null, error)
        throw error
    }

    if (completion.data?.choices[0].message?.function_call) {
        payload.messages.push({
            role: 'assistant',
            function_call: completion.data.choices[0].message?.function_call,
            content: '',
        })
        const functionCall = completion.data.choices[0].message?.function_call
        const functionDefinition = functions.find(({ schema }) => schema.name === functionCall.name)

        if (!functionDefinition) {
            return await askModel(
                {
                    ...resolvedOptions as any,
                    functionCall: 'none',
                    messages: payload.messages,
                },
                cursive,
            )
        }

        const args = resguard(() => JSON.parse(functionCall.arguments || '{}'), SyntaxError)
        const functionResult = await resguard(functionDefinition.definition(args.data))

        if (functionResult.error) {
            throw new CursiveError(
                `Error while running function ${functionCall.name}`,
                functionResult.error,
                CursiveErrorCode.FunctionCallError,
            )
        }

        const messages = payload.messages || []

        messages.push({
            role: 'function',
            name: functionCall.name,
            content: JSON.stringify(functionResult.data || ''),
        })

        if (functionDefinition.pause) {
            return {
                answer: {
                    ...completion.data,
                    functionResult: functionResult.data,
                },
                messages,
            }
        }
        else {
            return await askModel(
                {
                    ...resolvedOptions as any,
                    functions,
                    messages,
                },
                cursive,
            )
        }
    }

    await cursive._hooks.callHook('query:after', completion.data, null)
    await cursive._hooks.callHook('query:success', completion.data)

    return {
        answer: completion.data,
        messages: payload.messages || [],
    }
}

async function buildAnswer(
    options: CursiveAskOptions,
    cursive: Cursive,
): Promise<CursiveEnrichedAnswer> {
    const result = await resguard(askModel(options, cursive), CursiveError)

    if (result.error) {
        return {
            error: result.error,
            usage: null,
            model: options.model || 'gpt-3.5-turbo',
            id: null,
            choices: null,
            functionResult: null,
            answer: null,
            messages: null,
            cost: null,
        }
    }
    else {
        const usage: CursiveAskUsage = {
            completionTokens: result.data.answer.usage!.completion_tokens,
            promptTokens: result.data.answer.usage!.prompt_tokens,
            totalTokens: result.data.answer.usage!.total_tokens,
        }

        const newMessage = {
            error: null,
            model: result.data.answer.model,
            id: result.data.answer.id,
            usage,
            cost: result.data.answer.cost,
            choices: result.data.answer.choices.map(choice => choice.message.content),
            functionResult: result.data.answer.functionResult || null,
            answer: result.data.answer.choices[result.data.answer.choices.length - 1].message.content,
            messages: result.data.messages,
        }

        return newMessage
    }
}

function resolveFunctionList(functions: (CursiveFunction | CursiveFunctionSchema)[]) {
    return functions.map((functionDefinition) => {
        if ('schema' in functionDefinition) {
            return functionDefinition
        }
        else if ('name' in functionDefinition) {
            const fn: CursiveFunction = {
                schema: functionDefinition,
                pause: true,
                definition: null,
            }
            return fn
        }
        return null
    }).filter(Boolean)
}

interface CursiveEnrichedAnswer {
    error: CursiveError | null
    usage: CursiveAskUsage
    model: string
    id: string
    choices: string[]
    functionResult: any
    answer: string
    messages: ChatCompletionRequestMessage[]
    cost: CursiveAskCost
}
