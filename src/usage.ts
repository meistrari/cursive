import type { ChatCompletionRequestMessage } from 'openai-edge'
import { encode } from 'gpt-token-utils'

export function getUsage(messageList: ChatCompletionRequestMessage[], model: string) {
    const tokens = {
        perMessage: 0,
        perName: 0,
    }

    if (model.startsWith('gpt-3.5')) {
        tokens.perMessage = 4
        tokens.perName = -1
    }
    else if (model.startsWith('gpt-4')) {
        tokens.perMessage = 3
        tokens.perName = 1
    }

    let tokenCount = 0
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
