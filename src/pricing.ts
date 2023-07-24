import type { CursiveAskCost, CursiveAskUsage } from './types'
import OpenAIPrices from './assets/price/openai.json'
import AnthropicPrices from './assets/price/anthropic.json'

export function resolveOpenAIPricing(usage: CursiveAskUsage, model: string) {
    const modelsAvailable = Object.keys(OpenAIPrices)
    const modelMatch = modelsAvailable.find(m => model.startsWith(m))
    if (!modelMatch)
        throw new Error(`Unknown model ${model}`)

    const modelPrice = OpenAIPrices[modelMatch]
    const { completionTokens, promptTokens } = usage
    const completion = completionTokens * modelPrice.completion / 1000
    const prompt = promptTokens * modelPrice.prompt / 1000

    const cost: CursiveAskCost = {
        completion,
        prompt,
        total: completion + prompt,
        version: OpenAIPrices.version,
    }

    return cost
}

export function resolveAnthropicPricing(usage: CursiveAskUsage, model: string) {
    const modelsAvailable = Object.keys(AnthropicPrices)
    const modelMatch = modelsAvailable.find(m => model.startsWith(m))
    if (!modelMatch)
        throw new Error(`Unknown model ${model}`)

    const modelPrice = AnthropicPrices[modelMatch]
    const { completionTokens, promptTokens } = usage
    const completion = completionTokens * modelPrice.completion / 1000
    const prompt = promptTokens * modelPrice.prompt / 1000

    const cost: CursiveAskCost = {
        completion,
        prompt,
        total: completion + prompt,
        version: AnthropicPrices.version,
    }

    return cost
}
