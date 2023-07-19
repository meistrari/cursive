import type { ChatCompletionFunctions, ChatCompletionRequestMessage } from 'openai-edge'
import { encode } from 'gpt-tokenizer'

export function getUsage(messageList: ChatCompletionRequestMessage[], model?: string) {
    const tokens = {
        perMessage: 0,
        perName: 0,
    }

    tokens.perMessage = 3
    tokens.perName = 1

    let tokenCount = 3
    for (const message of messageList) {
        tokenCount += tokens.perMessage
        for (const key in message) {
            if (key === 'name')
                tokenCount += tokens.perName

            let value = (message as any)[key]
            if (typeof value === 'object')
                value = JSON.stringify(value)

            if (value === null || value === undefined)
                continue
            tokenCount += encode(value).length
        }
    }

    return tokenCount
}

export function getTokenCountFromFunctions(functions: ChatCompletionFunctions[]) {
    let tokenCount = 3
    for (const fn of functions) {
        let functionTokens = encode(fn.name).length
        functionTokens += encode(fn.description).length

        if (fn.parameters?.properties) {
            const properties = fn.parameters.properties
            for (const key in properties) {
                functionTokens += encode(key).length
                const value = properties[key]
                for (const field in value) {
                    if (['type', 'description'].includes(field)) {
                        functionTokens += 2
                        functionTokens += encode(value[field]).length
                    }
                    else if (field === 'enum') {
                        functionTokens -= 3
                        for (const enumValue in value[field]) {
                            functionTokens += 3
                            functionTokens += encode(enumValue).length
                        }
                    }
                }
            }
            functionTokens += 11
        }
        tokenCount += functionTokens
    }
    tokenCount += 12
    return tokenCount
}
