import { Configuration, OpenAIApi } from 'openai-edge'
import type { ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import type { ResguardResult } from 'resguard'
import { resguard } from 'resguard'
import type { CursiveQueryOptionsWithMessages, CursiveQueryOptionsWithPrompt } from './types'
import { CursiveError, toSnake } from './types'

export function useCursive(initOptions: { apiKey: string }) {
    const openai = new OpenAIApi(new Configuration({ apiKey: initOptions.apiKey }))

    async function query(
        options: CursiveQueryOptionsWithMessages | CursiveQueryOptionsWithPrompt,
    ): Promise<ResguardResult<CreateChatCompletionResponse, CursiveError>> {
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

        const completionPromise: CreateChatCompletionResponse = await openai.createChatCompletion(payload)
            .then(response => response.json())
            .then((response) => {
                if (response.error)
                    throw new CursiveError(response.error.message, response.error)
                return response
            })

        if (completionPromise.choices[0].message?.function_call) {
            const functionCall = completionPromise.choices[0].message?.function_call
            const functionDefinition = functions.find(({ schema }) => schema.name === functionCall.name)

            if (!functionDefinition) {
                return query({
                    ...rest,
                    model,
                    functions,
                    messages: queryMessages,
                    functionCall: 'none',
                })
            }

            const args = resguard(() => JSON.parse(functionCall.arguments || '{}'), SyntaxError)
            const result = await resguard(functionDefinition.definition(args.data, functionDefinition.context || {}))

            if (result.error)
                throw new CursiveError(`Error while running function ${functionCall.name}`, result.error)

            const messages = queryMessages || []
            messages.push({
                role: 'function',
                name: functionCall.name,
                content: JSON.stringify(result.data || ''),
            })

            return query({
                ...rest,
                model,
                functions,
                messages,
            })
        }

        return resguard(() => completionPromise, CursiveError)
    }

    return {
        query,
    }
}
