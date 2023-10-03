import type { ChatCompletionFunctions, ChatCompletionRequestMessage } from 'openai-edge'

export async function getOpenAIUsage(contentOrMessageList: string | ChatCompletionRequestMessage[]) {
    const { OpenAIEncoder } = await import('unitoken')

    if (typeof contentOrMessageList === 'string')
        return OpenAIEncoder.encode(contentOrMessageList).length

    const tokens = {
        perMessage: 0,
        perName: 0,
    }

    tokens.perMessage = 3
    tokens.perName = 1

    let tokenCount = 3
    for (const message of contentOrMessageList) {
        tokenCount += tokens.perMessage
        for (const key in message) {
            if (key === 'name')
                tokenCount += tokens.perName

            let value = (message as any)[key]
            if (typeof value === 'object')
                value = JSON.stringify(value)

            if (value === null || value === undefined)
                continue
            tokenCount += OpenAIEncoder.encode(value).length
        }
    }

    return tokenCount
}

export async function getTokenCountFromFunctions(functions: ChatCompletionFunctions[]) {
    const { OpenAIEncoder} = await import('unitoken')

    let tokenCount = 3
    for (const fn of functions) {
        let functionTokens = OpenAIEncoder.encode(fn.name).length
        functionTokens += OpenAIEncoder.encode(fn.description).length

        if (fn.parameters?.properties) {
            const properties = fn.parameters.properties
            for (const key in properties) {
                functionTokens += OpenAIEncoder.encode(key).length
                const value = properties[key]
                for (const field in value) {
                    if (['type', 'description'].includes(field)) {
                        functionTokens += 2
                        functionTokens += OpenAIEncoder.encode(value[field]).length
                    }
                    else if (field === 'enum') {
                        functionTokens -= 3
                        for (const enumValue in value[field]) {
                            functionTokens += 3
                            functionTokens += OpenAIEncoder.encode(enumValue).length
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
