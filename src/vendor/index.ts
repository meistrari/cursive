import type { CursiveAvailableModels } from '../types'

export function resolveVendorFromModel(model: CursiveAvailableModels) {
    const isFromOpenAI = ['gpt-3.5', 'gpt-4'].find(m => model.startsWith(m))
    if (isFromOpenAI)
        return 'openai'
    return ''
}
