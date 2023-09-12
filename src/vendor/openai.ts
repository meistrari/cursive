import { ofetch } from 'ofetch'
import type { CreateChatCompletionRequest, CreateEmbeddingRequest } from 'openai-edge'
import type { FetchInstance } from 'openai-edge/types/base'
import type { Cursive } from '../cursive'
import type { CursiveAskOnToken } from '../types'
import { getStream } from '../stream'
import { getOpenAIUsage, getTokenCountFromFunctions } from '../usage/openai'

export function createOpenAIClient(options: { apiKey: string }) {
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

    async function createEmbedding(payload: CreateEmbeddingRequest, abortSignal?: AbortSignal) {
        return resolvedFetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify(payload),
            signal: abortSignal,
        })
    }

    return { createChatCompletion, createEmbedding }
}

export async function processOpenAIStream(context: {
    payload: CreateChatCompletionRequest
    cursive: Cursive
    abortSignal?: AbortSignal
    onToken?: CursiveAskOnToken
    response: Response
}) {
    let data: any

    const reader = (await getStream(context.response)).getReader()

    data = {
        choices: [],
        usage: {
            completion_tokens: 0,
            prompt_tokens: getOpenAIUsage(context.payload.messages),
        },
        model: context.payload.model,
    }

    if (context.payload.functions)
        data.usage.prompt_tokens += getTokenCountFromFunctions(context.payload.functions)

    while (true) {
        const { done, value } = await reader.read()
        if (done)
            break

        data = {
            ...data,
            id: value.id,
        }

        value.choices.forEach((choice: any) => {
            const { delta, index } = choice

            if (!data.choices[index]) {
                data.choices[index] = {
                    message: {
                        function_call: null,
                        role: 'assistant',
                        content: '',
                    },
                }
            }

            if (delta?.function_call?.name)
                data.choices[index].message.function_call = delta.function_call

            if (delta?.function_call?.arguments)
                data.choices[index].message.function_call.arguments += delta.function_call.arguments

            if (delta?.content)
                data.choices[index].message.content += delta.content

            if (context.onToken) {
                let chunk: Record<string, any> | null = null
                if (delta?.function_call) {
                    chunk = {
                        functionCall: delta.function_call,
                    }
                }

                if (delta?.finish_reason) {
                    chunk = {
                        finishReason: delta.finish_reason,
                    }
                }

                if (delta?.content) {
                    chunk = {
                        content: delta.content,
                    }
                }

                if (chunk)
                    context.onToken({ ...chunk, index } as any)
            }
        })
    }

    return data
}
