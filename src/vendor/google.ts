import { ofetch } from 'ofetch'
import type { FetchInstance } from 'openai-edge/types/base'
import type { Cursive } from '../cursive'
import type { CursiveAskOnToken } from '../types'
import { CreateChatCompletionRequest } from 'openai-edge'

interface GenerateContentRequest {
    contents: Array<{
        role: string
        parts: Array<{
            text: string
        }>
    }>
}

interface GenerateContentResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string
            }>
            role: string
        }
        finishReason: string
        index: number
        safetyRatings: Array<{
            category: string
            probability: string
        }>
    }>
    promptFeedback: {
        safetyRatings: Array<{
            category: string
            probability: string
        }>
    }
}

export function createGoogleGenAIClient(options: { apiKey: string }) {
    const resolvedFetch: FetchInstance = ofetch.native

    async function createChatCompletion(payload: CreateChatCompletionRequest, abortSignal?: AbortSignal) {

        return resolvedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${options.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
    }

    return { createChatCompletion }
}

export async function processGoogleGenerativeLanguageStream(context: {
    payload: GenerateContentRequest
    cursive: Cursive
    abortSignal?: AbortSignal
    onToken?: CursiveAskOnToken
    response: Response
}) {
    const data: GenerateContentResponse = await context.response.json()

    const { candidates, promptFeedback } = data

    const processedData = {
        candidates: candidates.map((candidate) => ({
            content: candidate.content,
            finishReason: candidate.finishReason,
            index: candidate.index,
            safetyRatings: candidate.safetyRatings,
        })),
        promptFeedback,
    }

    if (context.onToken) {
        candidates.forEach((candidate, index) => {
            const { content, finishReason } = candidate

            context.onToken({
                content: content.parts[0].text,
                finishReason,
                index,
            } as any)
        })
    }

    return processedData
}