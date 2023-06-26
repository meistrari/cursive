import type { EventSourceParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import { createParser } from 'eventsource-parser'
import { CursiveError, CursiveErrorCode } from './types'

export function getStream(res: Response): ReadableStream {
    if (!res.ok) {
        throw new CursiveError(
            res.statusText,
            {
                status: res.status,
                statusText: res.statusText,
            },
            CursiveErrorCode.CompletionError,
        )
    }

    const stream: ReadableStream = res.body as any

    return stream.pipeThrough ? stream.pipeThrough(eventTransformer()) : emptyStream()
}

function eventTransformer() {
    const textDecoder = new TextDecoder()
    let parser: EventSourceParser
    const parseEvent = createParseEvent()

    return new TransformStream({
        async start(controller: any): Promise<void> {
            parser = createParser((event: ParsedEvent | ReconnectInterval) => {
                if (
                    'data' in event
                    && event.type === 'event'
                    && event.data === '[DONE]'
                )
                    return

                if ('data' in event && event.type === 'event') {
                    const parsedEvent = parseEvent(event.data)
                    if (parsedEvent)
                        controller.enqueue(parsedEvent)
                }
            })
        },

        transform(chunk: any) {
            parser.feed(textDecoder.decode(chunk))
        },
    })
}

function createParseEvent() {
    return (data: string) => JSON.parse(data)
}

function emptyStream() {
    return new ReadableStream({
        start(controller: any) {
            controller.close()
        },
    })
}

export function createDecoder() {
    const textDecoder = new TextDecoder()

    return (chunk?: Uint8Array): string => {
        if (!chunk)
            return ''

        return textDecoder.decode(chunk)
    }
}
