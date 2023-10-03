import { describe, test, expect } from 'bun:test'

import { OpenAIEncoder, AnthropicEncoder } from 'unitoken'

describe("tokenizers", () => {
    test("support OpenAI models", () => {
        const tokens = OpenAIEncoder.encode("Hello, world!")
        expect(tokens.length).toBe(4)
    })

    test("support Anthropic models", () => {
        let tokens = AnthropicEncoder.encode("Hello, world!")
        expect(tokens.length).toBe(4)

        tokens = AnthropicEncoder.encode(`
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Nulla quis est sit amet ipsum iaculis ultrices.
            [1] Donec euismod, nisl eget ultricies ultrices, nunc nisl aliquam nunc, quis aliquam nisl nisl vitae nisl.
            [<$$>] Sed euismod, nisl eget ultricies ultrices, nunc nisl aliquam nunc, quis aliquam nisl nisl vitae nisl.
            <a> Sed euismod, nisl eget ultricies ultrices, nunc nisl aliquam nunc, quis aliquam nisl nisl vitae nisl.</a>
            ## Heading
            - List item
            - List item
            > Blockquote
            ãêç
        `)
        expect(tokens.length).toBe(187)
    })
})