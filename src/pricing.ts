import type { CursiveQueryCost, CursiveQueryUsage } from './types'
import OpenAIPrices from './assets/price/openai.json'

export function resolveOpenAIPricing(usage: CursiveQueryUsage, model: string) {
    const modelsAvailable = Object.keys(OpenAIPrices)
    const modelMatch = modelsAvailable.find(m => model.startsWith(m))
    if (!modelMatch)
        throw new Error(`Unknown model ${model}`)

    const modelPrice = OpenAIPrices[modelMatch]
    const { completionTokens, promptTokens } = usage
    const completion = completionTokens * modelPrice.completion / 1000
    const prompt = promptTokens * modelPrice.prompt / 1000

    const cost: CursiveQueryCost = {
        completion,
        prompt,
        total: completion + prompt,
        version: OpenAIPrices.version,
    }

    return cost
}
