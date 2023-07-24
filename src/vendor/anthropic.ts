import { ofetch } from 'ofetch'
import type { ChatCompletionRequestMessage, CreateChatCompletionRequest } from 'openai-edge'
import type { Cursive } from '../cursive'
import type { CursiveAskOnToken } from '../types'
import { getStream } from '../stream'
import { getAnthropicUsage } from '../usage/anthropic'

export function createAnthropicClient(options: { apiKey: string }) {
    const resolvedFetch = ofetch.native

    async function createCompletion(payload: CreateChatCompletionRequest, abortSignal?: AbortSignal) {
        const input = buildAnthropicInput(payload.messages)
        const response = await resolvedFetch('https://api.anthropic.com/v1/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': options.apiKey,
            },
            body: JSON.stringify({
                prompt: input,
                max_tokens_to_sample: payload.max_tokens || 100_000,
                stop_sequences: payload.stop,
                temperature: payload.temperature,
                top_p: payload.top_p,
                model: payload.model,
                // TODO: Add top_k support
                // top_k: payload.top_k,
                stream: payload.stream,
            }),
            signal: abortSignal,
        })
        return response
    }

    return createCompletion
}

function buildAnthropicInput(messages: ChatCompletionRequestMessage[]) {
    const roleMapping = { user: 'Human', assistant: 'Assistant' }
    const messagesWithPrefix = [
        ...messages,
        { role: 'assistant', content: ' ' },
    ]
    return messagesWithPrefix.map((message) => {
        const { content, role } = message
        if (role === 'system') {
            return `
                Human: ${content}
                
                Assistant: Ok.
            `
        }
        return `${roleMapping[role]}: ${content}`
    }).join('\n\n')
}

export async function processAnthropicStream(context: {
    payload: CreateChatCompletionRequest
    cursive: Cursive
    abortSignal?: AbortSignal
    onToken?: CursiveAskOnToken
    response: Response
}) {
    let data: any

    const reader = (await getStream(context.response)).getReader()
    data = {
        choices: [{ message: { content: '' } }],
        usage: {
            completion_tokens: 0,
            prompt_tokens: getAnthropicUsage(context.payload.messages),
        },
        model: context.payload.model,
    }

    while (true) {
        const { done, value } = await reader.read()

        if (done)
            break

        data = {
            ...data,
            id: value.id,
        }

        // The completion partial will come with a leading whitespace
        value.completion = value.completion.trimStart()

        const currentToken = value.completion.slice((data.choices[0]?.message?.content || '').length)

        data.choices[0].message.content += currentToken

        if (context.onToken) {
            let chunk: Record<string, any> | null = null

            // TODO: Support function calling

            chunk = {
                content: currentToken,
            }

            context.onToken(chunk as any)
        }
    }

    return data
}
