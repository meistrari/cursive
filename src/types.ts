import type { ZodRawShape } from 'zod'
import type { ChatCompletionRequestMessage } from 'openai-edge-fns'
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import type { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef'
import type { HookResult } from './util'

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
    EmbeddingError = 'embedding_error',
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

export interface CursiveQueryUsage {
    completionTokens: number
    promptTokens: number
    totalTokens: number
}

export interface CursiveQueryCost {
    completion: number
    prompt: number
    total: number
    version: string
}

export interface CursiveQuerySuccessResult {
    choices: CreateChatCompletionResponse['choices']
    id: string
    model: string
    usage: CursiveQueryUsage
    cost: CursiveQueryCost
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
type ChatCompletionWithCost = CreateChatCompletionResponse & { cost: CursiveQueryCost }
export interface CursiveHooks {
    'query:before': (options: CursiveQueryOptions) => HookResult
    'query:after': (result: ChatCompletionWithCost | null, error: CursiveError | null) => HookResult
    'query:error': (error: CursiveError) => HookResult
    'query:success': (result: ChatCompletionWithCost) => HookResult
    'completion:before': (options: CreateChatCompletionRequest) => HookResult
    'completion:after': (result: ChatCompletionWithCost | null, error: CursiveError | null, duration: number) => HookResult
    'completion:error': (error: CursiveError, duration: number) => HookResult
    'completion:success': (result: ChatCompletionWithCost, duration: number) => HookResult
    'embedding:before': (options: { model: string; input: string }) => HookResult
    'embedding:after': (result: { embedding: number[] } | null, error: CursiveError | null, duration: number) => HookResult
    'embedding:error': (error: CursiveError, duration: number) => HookResult
    'embedding:success': (result: { embedding: number[] }, duration: number) => HookResult

}

export type CursiveHook = keyof CursiveHooks
