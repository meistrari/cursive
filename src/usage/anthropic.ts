import { encode } from '@meistrari/gpt-tokenizer/esm/encoding/claude'
import type { ChatCompletionRequestMessage } from 'openai-edge'

export function getAnthropicUsage(content: string | ChatCompletionRequestMessage[]) {
    if (typeof content === 'string')
        return encode(content).length

    const mappedContent = content.map((message) => {
        const { content, role } = message
        if (role === 'system') {
            return `
                Human: ${content}
                
                Assistant: Ok.
            `
        }
        return `${role}: ${content}`
    }).join('\n\n')

    return encode(mappedContent).length
}
