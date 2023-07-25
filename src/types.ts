import type { ZodRawShape } from 'zod'
import type { ChatCompletionRequestMessage } from 'openai-edge-fns'
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import type { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef'
import type { HookResult, ObjectWithNullValues, Override } from './util'
import type { CursiveAnswer } from './cursive'

export type CursiveAvailableModels =
/* OpenAI        */ 'gpt-3.5-turbo' | 'gpt-4'
/* Anthropic     */ | 'claude-instant' | 'claude-2'
// eslint-disable-next-line @typescript-eslint/ban-types
/* Allow any     */ | (string & {})

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

export interface CursiveSetupOptions {
    openAI?: {
        apiKey: string
        host?: string
    }
    anthropic?: {
        apiKey: string
    }
    maxRetries?: number
    expand?: {
        enabled?: boolean
        defaultsTo?: string
        modelMapping?: Record<string, string>
    }
    debug?: boolean
    /**
     * Allows for the usage of WindowAI
     */
    allowWindowAI?: boolean
}

export enum CursiveErrorCode {
    FunctionCallError = 'function_call_error',
    CompletionError = 'completion_error',
    InvalidRequestError = 'invalid_request_error',
    EmbeddingError = 'embedding_error',
    UnknownError = 'unknown_error',
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

export type CursiveAskOnToken = (delta:
{ functionCall: { name: string; arguments: '' } | { name: null; arguments: string }; content: null }
| { content: string; functionCall: null }
) => void | Promise<void>
interface CursiveAskOptionsBase {
    model?: CursiveAvailableModels
    systemMessage?: string
    functions?: CursiveFunction[]
    functionCall?: string | CursiveFunction
    onToken?: CursiveAskOnToken
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

export interface CursiveAskOptionsWithMessages extends CursiveAskOptionsBase {
    messages: ChatCompletionRequestMessage[]
    prompt?: never
}

export interface CursiveAskOptionsWithPrompt extends CursiveAskOptionsBase {
    prompt: string
    messages?: never
}

export type CursiveAskOptions = CursiveAskOptionsWithMessages | CursiveAskOptionsWithPrompt

export interface CursiveAskUsage {
    completionTokens: number
    promptTokens: number
    totalTokens: number
}

export interface CursiveAskCost {
    completion: number
    prompt: number
    total: number
    version: string
}

export type CursiveAnswerSuccess = CursiveAnswer<null>
export type CursiveAnswerError = Override<ObjectWithNullValues<CursiveAnswer<CursiveError>>, { error: CursiveError }>
export type CursiveAnswerResult = CursiveAnswerSuccess | CursiveAnswerError

export interface CursiveAskErrorResult {
    choices: null
    id: null
    model: string
    usage: null
    cost: null
    answer: null
    conversation: null
    error: CursiveError
}

// export type CursiveAskResult = CursiveAnswer<null> |
type ChatCompletionWithCost = CreateChatCompletionResponse & { cost: CursiveAskCost }

export interface CursiveHooks {
    'query:before': (options: CursiveAskOptions) => HookResult
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
