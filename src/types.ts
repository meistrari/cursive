import type { TProperties, TSchema } from '@sinclair/typebox'
import type { ChatCompletionRequestMessage } from 'openai-edge'
import type { CreateChatCompletionRequest, CreateChatCompletionResponse } from 'openai-edge'
import { Type as TypeBox } from '@sinclair/typebox'
import type { HookResult, ObjectWithNullValues, Override } from './util'
import type { CursiveAnswer } from './cursive'

export type CursiveAvailableModels =
/* OpenAI        */ 'gpt-3.5-turbo' | 'gpt-4'
/* Anthropic     */ | 'claude-instant-1' | 'claude-2'

/* Allow any     */ | (string & {})

export type InferredFunctionParameters<T extends TProperties> = {
    [K in keyof T]: T[K]['static']
}

export interface CursiveCreateFunctionOptions<P extends TProperties> {
    name: string
    description: string
    parameters?: P
    execute(parameters: InferredFunctionParameters<P>): Promise<any>
    pause?: boolean
}

export interface CursiveFunction {
    schema: CursiveFunctionSchema
    definition: (parameters: Record<string, any>) => Promise<any>
    pause?: boolean
}

export interface CursiveFunctionSchema {
    parameters: {
        type: 'object'
        properties: any
        required: string[]
    }
    description: string
    name: string
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
    /**
     * Count usage and pricing for each completion
     */
    countUsage?: boolean
}

export enum CursiveErrorCode {
    FunctionCallError = 'function_call_error',
    CompletionError = 'completion_error',
    InvalidRequestError = 'invalid_request_error',
    EmbeddingError = 'embedding_error',
    UnknownError = 'unknown_error',
}
export class CursiveError extends Error {
    constructor(public message: string, public details?: any, public code?: CursiveErrorCode, stack?: any) {
        super(message)
        this.name = 'CursiveError'
        this.message = message
        this.details = details
        this.code = code
        this.stack = stack
    }
}

export type CursiveStreamDelta = {
    functionCall: { name: string; arguments: '' } | { name: null; arguments: string }
    content: null
    index?: number
    finishReason?: string
}
| {
    content: string
    functionCall: null
    index?: number
    finishReason?: string
}
export type CursiveAskOnToken = (delta: CursiveStreamDelta) => void | Promise<void>

interface CursiveAskOptionsBase {
    model?: CursiveAvailableModels
    systemMessage?: string
    functions?: CursiveFunction[] | CursiveFunctionSchema[]
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

const Nullable = <T extends TSchema>(schema: T) => TypeBox.Union([schema, TypeBox.Null()])
function StringEnum<T extends string[]>(values: [...T], options?: { description?: string }) {
    return TypeBox.Unsafe<T[number]>({
        type: 'string',
        enum: values,
        ...options,
    })
}

// @ts-expect-error Overriding method
TypeBox.StringEnum = StringEnum
// @ts-expect-error Overriding method
TypeBox.Nullable = Nullable

export const Type = TypeBox as any as typeof TypeBox & {
    Nullable: typeof Nullable
    StringEnum: typeof StringEnum
}
