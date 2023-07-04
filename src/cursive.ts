import type { ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import { resguard } from 'resguard'
import type { Hookable } from 'hookable'
import { createDebugger, createHooks } from 'hookable'
import { ofetch } from 'ofetch'
import type { FetchInstance } from 'openai-edge/types/base'
import type { CursiveHook, CursiveHooks, CursiveQueryOnProgress, CursiveQueryOptions, CursiveQueryResult } from './types'
import { CursiveError, CursiveErrorCode } from './types'
import { getStream } from './stream'
import { getUsage } from './usage'
import { toSnake } from './util'

function createOpenAIClient(options: { apiKey: string }) {
    const resolvedFetch: FetchInstance = ofetch.native

    async function createChatCompletion(payload: CreateChatCompletionRequest, abortSignal?: AbortSignal) {
        return resolvedFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify(payload),
            signal: abortSignal,
        })
    }

    return { createChatCompletion }
}

export function useCursive(initOptions: { apiKey: string; debug?: boolean }) {
    const hooks = createHooks<CursiveHooks>()
    const openai = createOpenAIClient(initOptions)
    let debug: { close: () => void }

    if (initOptions.debug)
        debug = createDebugger(hooks, { tag: 'cursive' })

    function on<H extends CursiveHook>(event: H, callback: CursiveHooks[H]) {
        hooks.hook(event, callback as any)
    }

    async function query(
        options: CursiveQueryOptions,
    ): CursiveQueryResult {
        async function executeQuery(options: CursiveQueryOptions): Promise<CreateChatCompletionResponse & { functionResult?: any }> {
            await hooks.callHook('query:before', options)

            const { payload, resolvedOptions } = resolveOptions(options)
            const functions = options.functions || []

            if (typeof options.functionCall !== 'string' && options.functionCall?.schema)
                functions.push(options.functionCall)

            const functionSchemas = functions.map(({ schema }) => schema)

            if (functionSchemas.length > 0)
                payload.functions = functionSchemas

            let completion = await resguard(createCompletion({ payload, openai, hooks, onProgress: options.onProgress }), CursiveError)

            if (completion.error) {
                await hooks.callHook('completion:error', completion.error)
                const cause = completion.error.details.code || completion.error.details.type
                if (cause === 'context_length_exceeded') {
                    completion = await resguard(
                        createCompletion({
                            payload: { ...payload, model: 'gpt-3.5-turbo-16k' },
                            openai,
                            hooks,
                            onProgress: options.onProgress,
                        }),
                        CursiveError,
                    )
                }

                else if (cause === 'invalid_request_error') {
                    throw new CursiveError('Invalid request', completion.error.details, CursiveErrorCode.InvalidRequestError)
                }

                // TODO: Handle other errors

                if (completion.error) {
                    // Retry 5 times
                    for (let i = 0; i < 5; i++) {
                        completion = await resguard(createCompletion({ payload, openai, hooks, onProgress: options.onProgress }), CursiveError)

                        if (completion.error)
                            await hooks.callHook('completion:error', completion.error)

                        if (!completion.error)
                            break
                    }
                }
            }

            if (completion.error) {
                const error = new CursiveError('Error while completing request', completion.error.details, CursiveErrorCode.CompletionError)
                await hooks.callHook('completion:error', error)
                await hooks.callHook('query:error', error)
                await hooks.callHook('query:after', null, error)
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
                    return await executeQuery({
                        ...resolvedOptions,
                        functionCall: 'none',
                        messages: payload.messages,
                    })
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
                        ...completion.data,
                        functionResult: functionResult.data,
                    }
                }
                else {
                    return await executeQuery({
                        ...resolvedOptions,
                        functions,
                        messages,
                    })
                }
            }

            await hooks.callHook('query:after', completion.data, null)
            await hooks.callHook('query:success', completion.data)

            if (initOptions.debug)
                debug.close()

            return completion.data
        }

        const result = await resguard(executeQuery(options), CursiveError)

        if (result.error) {
            return {
                error: result.error,
                usage: null,
                model: options.model || 'gpt-3.5-turbo-0613',
                id: null,
                choices: null,
            }
        }
        else {
            return {
                error: null,
                usage: {
                    completionTokens: result.data.usage!.completion_tokens,
                    promptTokens: result.data.usage!.prompt_tokens,
                    totalTokens: result.data.usage!.total_tokens,
                },
                model: result.data.model,
                id: result.data.id,
                choices: result.data.choices,
                functionResult: result.data.functionResult || null,
            }
        }
    }

    return {
        query,
        on,
    }
}

function resolveOptions(options: CursiveQueryOptions) {
    const {
        functions: _ = [],
        messages = [],
        model = 'gpt-3.5-turbo-0613',
        systemMessage,
        prompt,
        functionCall,
        ...rest
    } = options

    const queryMessages = [
        systemMessage && { role: 'system', content: systemMessage },
        ...messages,
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
    openai: ReturnType<typeof createOpenAIClient>
    hooks: Hookable<CursiveHooks>
    abortSignal?: AbortSignal
    onProgress?: CursiveQueryOnProgress
}) {
    const { payload, openai, hooks } = context
    await hooks.callHook('completion:before', payload)
    const start = Date.now()
    const response = await openai.createChatCompletion({ ...payload }, context.abortSignal)
    let data: any

    if (payload.stream) {
        const reader = getStream(response).getReader()

        data = {
            choices: [],
            usage: {
                completion_tokens: 0,
                prompt_tokens: getUsage(payload.messages, payload.model),
            },
            model: payload.model,
        }

        while (true) {
            const { done, value } = await reader.read()
            if (done)
                break

            data = {
                ...data,
                id: value.id,
            }

            value.choices.forEach((choice: any, i: number) => {
                const { delta } = choice

                if (!data.choices[i]) {
                    data.choices[i] = {
                        message: {
                            function_call: null,
                            role: 'assistant',
                            content: '',
                        },
                    }
                }

                if (delta?.function_call?.name)
                    data.choices[i].message.function_call = delta.function_call

                if (delta?.function_call?.arguments)
                    data.choices[i].message.function_call.arguments += delta.function_call.arguments

                if (delta?.content)
                    data.choices[i].message.content += delta.content

                if (context.onProgress) {
                    let chunk: Record<string, any> | null = null
                    if (delta?.function_call) {
                        chunk = {
                            functionCall: delta.function_call,
                        }
                    }

                    if (delta?.content) {
                        chunk = {
                            content: delta.content,
                        }
                    }

                    if (chunk)
                        context.onProgress(chunk as any)
                }
            })
        }

        data.usage.completion_tokens = getUsage(data.choices.map(({ message }: any) => message), payload.model)
        data.usage.total_tokens = data.usage.completion_tokens + data.usage.prompt_tokens
    }
    else {
        data = await response.json()
    }

    if (data.error)
        throw new CursiveError(data.error.message, data.error, CursiveErrorCode.CompletionError)

    const end = Date.now()

    await hooks.callHook('completion:after', data as CreateChatCompletionResponse, end - start)

    return data as CreateChatCompletionResponse
}
