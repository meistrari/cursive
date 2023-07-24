import { useCursive } from '../../../src/index'

export interface Env {
    OPENAI_API_KEY: string
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const cursive = useCursive({ openAI: { apiKey: env.OPENAI_API_KEY } })
        const { answer } = await cursive.ask({
            prompt: 'Generate a random hello world message in a random language!',
            temperature: 1,
            maxTokens: 16,
        })
        return new Response(answer)
    },
}
