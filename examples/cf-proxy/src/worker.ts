import { resguard } from 'resguard'
import { createCursiveProxy } from '../../../src/index'

export interface Env {
    OPENAI_API_KEY: string
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const proxy = createCursiveProxy({ openAI: { apiKey: env.OPENAI_API_KEY }, stream: { encodeValues: true }, countUsage: true })

				proxy.on('query:after', (query) => {
					console.log(query?.cost)
				})

        const body = await resguard<any>(request.json())

        if(body.error) {
            return new Response(JSON.stringify({
                error: true
            }))
        }

        const response = await proxy.handle(body.data)

        if (body.data.stream) {
            const init = {
                status: 200,
                statusText: 'ok',
                headers: new Headers({
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                }),
            }

            return new Response(response as ReadableStream, init)
        } else {
            return new Response(JSON.stringify(response))
        }

    },
}
