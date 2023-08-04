import type { ChatCompletionRequestMessage } from 'openai-edge'

export async function getAnthropicUsage(content: string | ChatCompletionRequestMessage[]) {
    const { encode } = await import('@meistrari/gpt-tokenizer/esm/encoding/claude')

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
