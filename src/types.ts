import type { ZodRawShape } from 'zod'
import type { ChatCompletionRequestMessage } from 'openai-edge-fns'
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import type { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef'

export type InferredFunctionParameters<T extends ZodRawShape> = {
    [K in keyof T]: T[K]['_type']
}

export interface CursiveCreateFunctionOptions<P extends ZodRawShape> {
    name: string
    description: string
    parameters?: P
    execute(parameters: InferredFunctionParameters<P>): Promise<any>
    pause?: boolean
}

export interface CursiveFunction {
    schema: {
        parameters: {
            type: 'object'
            properties: Record<string, JsonSchema7Type>
            required: string[]
        }
        description: string
        name: string
    }
    definition: (parameters: Record<string, any>) => Promise<any>
    pause?: boolean
}

export enum CursiveErrorCode {
    FunctionCallError = 'function_call_error',
    CompletionError = 'completion_error',
    InvalidRequestError = 'invalid_request_error',
}
export class CursiveError extends Error {
    constructor(message: string, public details?: any, public code?: CursiveErrorCode) {
        super(message)
        this.name = 'CursiveError'
        this.message = message
        this.details = details
        this.code = code
    }
}

export type CursiveQueryOnProgress = (delta:
{ functionCall: { name: string; arguments: '' } | { name: null; arguments: string }; content: null }
| { content: string; functionCall: null }
) => void | Promise<void>
interface CursiveQueryOptionsBase {
    model?: string
    systemMessage?: string
    functions?: CursiveFunction[]
    functionCall?: string | CursiveFunction
    onProgress?: CursiveQueryOnProgress
    maxTokens?: number
    stop?: string[]
    temperature?: number
    topP?: number
    presencePenalty?: number
    frequencyPenalty?: number
    bestOf?: number
    n?: number
    logitBias?: Record<string, number>
    user?: string
    stream?: boolean
    abortSignal?: AbortSignal
}

export interface CursiveQueryOptionsWithMessages extends CursiveQueryOptionsBase {
    messages: ChatCompletionRequestMessage[]
    prompt?: never
}

export interface CursiveQueryOptionsWithPrompt extends CursiveQueryOptionsBase {
    prompt: string
    messages?: never
}

export type CursiveQueryOptions = CursiveQueryOptionsWithMessages | CursiveQueryOptionsWithPrompt

export interface CursiveQuerySuccessResult {
    choices: CreateChatCompletionResponse['choices']
    id: string
    model: string
    usage: {
        completionTokens: number
        promptTokens: number
        totalTokens: number
    }
    error: null
    functionResult?: any
}

export interface CursiveQueryErrorResult {
    choices: null
    id: null
    model: string
    usage: null
    error: CursiveError
}

export type CursiveQueryResult = Promise<CursiveQuerySuccessResult | CursiveQueryErrorResult>
export interface CursiveHooks {
    'query:before': (options: CursiveQueryOptions) => HookResult
    'query:after': (result: CreateChatCompletionResponse | null, error: CursiveError | null) => HookResult
    'query:error': (error: CursiveError) => HookResult
    'query:success': (result: CreateChatCompletionResponse) => HookResult
    'completion:before': (options: CreateChatCompletionRequest) => HookResult
    'completion:after': (result: CreateChatCompletionResponse, duration: number) => HookResult
    'completion:error': (error: CursiveError) => HookResult
    'completion:success': (result: CreateChatCompletionResponse) => HookResult
}

export type CursiveHook = keyof CursiveHooks

// Utils
export type HookResult = Promise<void> | void

export type Override<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

type CamelToSnakeCaseKey<S> = S extends `${infer T}${infer U}` ? `${T extends Uppercase<T> ? `_${Lowercase<T>}` : T}${CamelToSnakeCaseKey<U>}` : S
export type CamelToSnakeCase<T> = T extends Array<infer U>
    ? Array<CamelToSnakeCase<U>>
    : T extends object
        ? { [K in keyof T as CamelToSnakeCaseKey<K>]: CamelToSnakeCase<T[K]> }
        : T

const lowercase = (w: string) => w.toLowerCase()
const toSnakeString = (w: string) => w.split(/(?=[A-Z])/).map(lowercase).join('_')
export function toSnake<T>(source: T): CamelToSnakeCase<T> {
    if (Array.isArray(source))
        return source.map(toSnake) as any

    if (source && typeof source === 'object') {
        const target = {} as any
        for (const [key, value] of Object.entries(source)) {
            const newKey = toSnakeString(key)
            target[newKey] = toSnake(value)
        }
        return target
    }
    return source as CamelToSnakeCase<T>
}
