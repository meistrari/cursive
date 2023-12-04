import type { CreateChatCompletionResponse, ErrorResponse } from 'openai-edge'
import { TransformStream } from '@web-std/stream'
import type { TSchema } from '@sinclair/typebox'
import type { CursiveAskOptions, CursiveAskOptionsWithMessages, CursiveHook, CursiveHooks, CursiveSetupOptions, CursiveStreamDelta } from './types'
import { useCursive } from './cursive'
import { randomId } from './util'

interface CursiveProxyOptions {
    stream?: {
        encodeValues?: boolean
    }
}

export type CursiveProxyRequest = CursiveAskOptions & {
    schema?: Record<string, any>
}

type CursiveProxy = <R extends CursiveProxyRequest>(request: R) => Promise<CreateChatCompletionResponse | ReadableStream<any> | ErrorResponse>

export function createCursiveProxy(options: CursiveSetupOptions & CursiveProxyOptions = {}) {
    const cursive = useCursive(options)

    const handle: CursiveProxy = async (request) => {
        if (!request.stream)
            return await handleRequest(request, cursive)
        else
            return await handleStreamRequest(request, cursive, options.stream)
    }

    function on<H extends CursiveHook>(event: H, callback: CursiveHooks[H]) {
        return cursive.on(event, callback)
    }

    return {
        handle,
        on,
    }
}

async function handleRequest<T extends TSchema | undefined = undefined>(request: CursiveAskOptions<T>, cursive: ReturnType<typeof useCursive>) {
    const answer = await cursive.ask(
        request,
    )

    if (answer.error) {
        return {
            error: {
                message: answer.error.message,
                name: answer.error.name,
                cause: answer.error.cause,
                details: answer.error.details,
                stack: answer.error.stack,
            },
        }
    }

    const mappedAnswer: CreateChatCompletionResponse = {
        choices: answer.choices.map((choice, index) => ({
            finish_reason: 'stop',
            index,
            message: {
                role: 'assistant',
                content: choice,
            },
        })),
        created: Date.now(),
        id: answer.id,
        object: 'chat.completion',
        usage: null,
        model: request.model,
    }

    if (answer.usage) {
        mappedAnswer.usage = {
            prompt_tokens: answer.usage.promptTokens,
            completion_tokens: answer.usage.completionTokens,
            total_tokens: answer.usage.totalTokens,
        }
    }

    return mappedAnswer
}

// Wraps the request in a async generator function
async function handleStreamRequest<T extends TSchema | undefined = undefined>(request: CursiveProxyRequest, cursive: ReturnType<typeof useCursive>, options?: CursiveProxyOptions['stream']) {
    async function getAsyncIterator() {
    // Define a queue to store tokens
        const tokens = []
        // Set the initial resolver to null
        let resolver = null

        // Initiate your request and pass the handler
        cursive.ask({
            ...request as CursiveAskOptionsWithMessages<T>,
            onToken: (token) => {
            // If the resolver exists, resolve it with a new promise and reset
                if (resolver) {
                    const currentResolver = resolver
                    // create a new promise and reset resolver
                    resolver = null
                    currentResolver({ value: token, done: false })
                }
                else {
                // Otherwise, push the token into the queue
                    tokens.push(token)
                }
            },
        }).then(() => {
            // When the request is complete, resolve the last token
            if (resolver) {
                const currentResolver = resolver
                // create a new promise and reset resolver
                resolver = null
                currentResolver({ value: undefined, done: true })
            }
        })

        return {
            [Symbol.asyncIterator]() {
                return {
                // This is the iterator object
                    next(): Promise<IteratorResult<CursiveStreamDelta>> {
                        if (tokens.length > 0) {
                            const value = tokens.shift()
                            if (value === null)
                                return Promise.resolve({ value: undefined, done: true })
                            else
                                return Promise.resolve({ value, done: false })
                        }

                        // If no tokens queued, return a new promise
                        return new Promise((resolve) => {
                        // Set the resolver to resolve with the next token
                            resolver = resolve
                        })
                    },
                }
            },
        }
    }

    const iterableRequest = await getAsyncIterator()

    function asyncIteratorToReadableStream<T, E>(options: {
        iterator: AsyncIterable<CursiveStreamDelta>
        transform?: (value: CursiveStreamDelta) => T
        onEnd?: () => E
    }) {
        const reader = options.iterator[Symbol.asyncIterator]()
        const { readable, writable } = new TransformStream()
        const writer = writable.getWriter()

        async function write() {
            const { done, value } = await reader.next()
            if (done) {
                if (options.onEnd) {
                    const onEndValue = options.onEnd()
                    if (Array.isArray(onEndValue)) {
                        for (const v of onEndValue)
                            writer.write(options.transform ? options.transform(v) : v)
                    }
                }
                writer.close()
            }
            else {
                writer.write(options.transform ? options.transform(value) : value)
                write()
            }
        }

        write()
        return readable
    }

    let chunkData: string | any = {
        created: Date.now(),
        id: randomId(),
        model: request.model,
        object: 'chat.completion.chunk',
        choices: [],
    }

    const stopSymbol = Symbol('stop')

    const stream = asyncIteratorToReadableStream({
        iterator: iterableRequest,
        transform: (delta) => {
            const isDone = (delta as any) === '[DONE]'
            const isStop = (delta as any) === stopSymbol

            if (isDone) {
                chunkData = '[DONE]'
            }
            else {
                chunkData.choices = [{
                    finish_reason: isStop ? 'stop' : delta.finishReason,
                    delta: isStop ? {} : { content: delta.content },
                    index: delta.index,
                }]
            }

            if (options?.encodeValues)
                return new TextEncoder().encode(`data: ${JSON.stringify(chunkData, null, 4)}\n\n`)
            else
                return `data: ${JSON.stringify(chunkData, null, 4)}\n\n`
        },
        onEnd: () => [stopSymbol, '[DONE]'],
    })

    return stream
}
