import type { ChatCompletionRequestMessage } from 'openai-edge'

export async function getAnthropicUsage(content: string | ChatCompletionRequestMessage[]) {
    const { AnthropicEncoder } = await import('unitoken')

    if (typeof content === 'string')
        return AnthropicEncoder.encode(content).length

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

    return AnthropicEncoder.encode(mappedContent).length
}
