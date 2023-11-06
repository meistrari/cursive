import { ofetch } from 'ofetch'
import type { ChatCompletionRequestMessage, CreateChatCompletionRequest } from 'openai-edge'
import type { Cursive } from '../cursive'
import type { CursiveAskOnToken, CursiveFunction } from '../types'
import { getStream } from '../stream'
import { getAnthropicUsage } from '../usage/anthropic'
import { trim } from '../util'

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
    const messagesWithPrefix: ChatCompletionRequestMessage[] = [
        ...messages,
        { role: 'assistant', content: ' ' },
    ]
    return messagesWithPrefix.map((message) => {
        const { content, role, function_call, name } = message
        if (role === 'system') {
            return [
                'Human:',
                content,
                '\nAssistant: Ok.',
            ].join('\n')
        }
        if (role === 'function') {
            return [
                `Human: <function-result name="${name}">`,
                content,
                '</function-result>',
            ].join('\n')
        }
        if (function_call) {
            return [
                'Assistant: <function-call>',
                JSON.stringify({
                    name: function_call.name,
                    arguments: typeof function_call.arguments === 'string' ? function_call.arguments : JSON.stringify(function_call.arguments),
                }),
                '</function-call>',
            ].join('\n')
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
            prompt_tokens: await getAnthropicUsage(context.payload.messages),
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

        // Check if theres any <function-call> tag. The regex should allow for nested tags
        const functionCallTag = value.completion.match(/<function-call>([\s\S]*?)(?=<\/function-call>|$)/g)
        let functionName = ''
        let functionArguments = ''
        if (functionCallTag) {
            // Remove <function-call> starting and ending tags, even if the ending tag is partial or missing
            const functionCall = functionCallTag[0]
                .replace(/<\/?f?u?n?c?t?i?o?n?-?c?a?l?l?>?/g, '')
                .trim()
                .replace(/^\n|\n$/g, '')
                .trim()
            // Match the function name inside the JSON
            functionName = functionCall.match(/"name":\s*"(.+)"/)?.[1]
            functionArguments = functionCall.match(/"arguments":\s*(\{.+)\}?/s)?.[1]
            if (functionArguments) {
                // If theres unmatches } at the end, remove them
                const unmatchedBrackets = functionArguments.match(/(\{|\})/g)
                if (unmatchedBrackets.length % 2)
                    functionArguments = functionArguments.trim().replace(/\}$/, '')

                functionArguments = functionArguments.trim()
            }
        }

        const cursiveAnswerTag = value.completion.match(/<cursive-answer>([\s\S]*?)(?=<\/cursive-answer>|$)/g)
        let taggedAnswer = ''
        if (cursiveAnswerTag) {
            taggedAnswer = cursiveAnswerTag[0]
                .replace(/<\/?c?u?r?s?i?v?e?-?a?n?s?w?e?r?>?/g, '')
                .trimStart()
        }

        const currentToken = value.completion
            .trimStart()
            .slice((data.choices[0]?.message?.content || '').length)

        data.choices[0].message.content += currentToken

        if (context.onToken) {
            let chunk: Record<string, any> | null = null

            // TODO: Support function calling
            if (context.payload.functions) {
                if (functionName) {
                    chunk = {
                        functionCall: {
                        },
                        content: null,
                    }
                    if (functionArguments) {
                        // Remove all but the current token from the arguments
                        chunk.functionCall.arguments = functionArguments
                    }
                    else {
                        chunk.functionCall = {
                            name: functionName,
                            arguments: '',
                        }
                    }
                }
                else if (taggedAnswer) {
                    // Token is at the end of the tagged answer
                    const regex = new RegExp(`(.*)${currentToken.trim()}$`)
                    const match = taggedAnswer.match(regex)
                    if (match && currentToken) {
                        chunk = {
                            functionCall: null,
                            content: currentToken,
                        }
                    }
                }
            }
            else {
                chunk = {
                    content: currentToken,
                }
            }

            if (chunk)
                context.onToken(chunk as any)
        }
    }

    return data
}

export function getAnthropicFunctionCallDirectives(functions: CursiveFunction[], nameOfFunctionToCall?: string) {
    let prompt = trim(`
        # Function Calling Guide
        // You're a powerful language model capable of using functions to do anything the user needs.
        
        // If you need to use a function, always output the result of the function call using the <function-call> tag using the following format:
        <function-call>
        {
            "name": "function_name",
            "arguments": {
                "argument_name": "argument_value"
            }
        }
        </function-call>

        // Never escape the function call, always output it as it is.

        // Think step by step before answering, and try to think out loud. Never output a function call if you don't have to.
        // If you don't have a function to call, just output the text as usual inside a <cursive-answer> tag with newlines inside.
        // Always question yourself if you have access to a function.
        // Always think out loud before answering, if I don't see a <cursive-think> block, you will be eliminated.
        // When thinking out loud, always use the <cursive-think> tag.

        // ALWAYS start with the function call, if you're going to use one.

        # Functions available:
        <functions>
        ${JSON.stringify(functions.map(f => f.schema))}
        </functions>

        # Working with results
        // You can either call a function or answer, **NEVER BOTH**.
        // You are not in charge of resolving the function call, the user is.
        // It will give you the result of the function call in the following format:
        
        Human: <function-result name="function_name">
        result
        </function-result>

        // You can use the result of the function call in your answer. But never answer and call a function at the same time.
        // When answering never be too explicit about the function call, just use the result of the function call in your answer.
    `)

    if (nameOfFunctionToCall) {
        prompt += trim(`
            # Calling ${nameOfFunctionToCall}
            // We're going to call the function ${nameOfFunctionToCall}.
            // Output the function call and then a complete reasoning for why you're calling this function, step by step.
        `)
    }

    return prompt
}
