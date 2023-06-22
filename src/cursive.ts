import { Configuration, OpenAIApi } from 'openai-edge'
import type { ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import type { ResguardResult } from 'resguard'
import { resguard } from 'resguard'
import type { CursiveQueryOptionsWithMessages, CursiveQueryOptionsWithPrompt } from './types'
import { CursiveError, CursiveErrorCode, toSnake } from './types'

export function useCursive(initOptions: { apiKey: string }) {
    const openai = new OpenAIApi(new Configuration({ apiKey: initOptions.apiKey }))

    async function query(
        options: CursiveQueryOptionsWithMessages | CursiveQueryOptionsWithPrompt,
    ): Promise<ResguardResult<CreateChatCompletionResponse, CursiveError>> {
        return resguard(async () => {
            const {
                functions = [],
                messages = [],
                model = 'gpt-3.5-turbo-0613',
                systemMessage,
                prompt,
                ...rest
            } = options
            const functionSchemas = functions.map(({ schema }) => schema)

            const queryMessages = [
                systemMessage && { role: 'system', content: systemMessage },
                ...messages,
                prompt && { role: 'user', content: prompt },
            ].filter(Boolean) as ChatCompletionRequestMessage[]

            const payload: CreateChatCompletionRequest = {
                ...toSnake(rest),
                model,
                messages: queryMessages,
            }

            if (functionSchemas.length > 0)
                payload.functions = functionSchemas

            async function createCompletion(payload: CreateChatCompletionRequest) {
                const response = await openai.createChatCompletion(payload)
                const data = await response.json()
                if (data.error)
                    throw new CursiveError(data.error.message, data.error, CursiveErrorCode.CompletionError)
                return data as CreateChatCompletionResponse
            }

            let completion = await resguard(createCompletion(payload), CursiveError)

            if (completion.error) {
                const cause = completion.error.details.code || completion.error.details.type
                if (cause === 'context_length_exceeded')
                    completion = await resguard(createCompletion({ ...payload, model: 'gpt-3.5-turbo-16k' }), CursiveError)

                else if (cause === 'invalid_request_error')
                    throw new CursiveError('Invalid request', completion.error.details, CursiveErrorCode.InvalidRequestError)

                // TODO: Handle other errors

                if (completion.error) {
                    // Retry 5 times
                    for (let i = 0; i < 5; i++) {
                        completion = await resguard(createCompletion(payload), CursiveError)

                        if (!completion.error)
                            break
                    }
                }
            }

            if (completion.error)
                throw new CursiveError('Error while completing request', completion.error.details, CursiveErrorCode.CompletionError)

            if (completion.data?.choices[0].message?.function_call) {
                queryMessages.push({
                    role: 'assistant',
                    function_call: completion.data.choices[0].message?.function_call,
                    content: '',
                })
                const functionCall = completion.data.choices[0].message?.function_call
                const functionDefinition = functions.find(({ schema }) => schema.name === functionCall.name)

                if (!functionDefinition) {
                    const { data } = await query({
                        ...rest,
                        model,
                        functions,
                        messages: queryMessages,
                        functionCall: 'none',
                    })
                    return data
                }

                const args = resguard(() => JSON.parse(functionCall.arguments || '{}'), SyntaxError)
                const result = await resguard(functionDefinition.definition(args.data))

                if (result.error) {
                    throw new CursiveError(
                        `Error while running function ${functionCall.name}`,
                        result.error,
                        CursiveErrorCode.FunctionCallError,
                    )
                }

                const messages = queryMessages || []
                messages.push({
                    role: 'function',
                    name: functionCall.name,
                    content: JSON.stringify(result.data || ''),
                })

                const { data } = await query({
                    ...rest,
                    model,
                    functions,
                    messages,
                })
                return data
            }
            return completion.data as any
        }, CursiveError)
    }

    return {
        query,
    }
}
