import type { CursiveAvailableModels } from '../types'

// export function resolveVendorFromModel(model: CursiveAvailableModels) {
//     const isFromOpenAI = ['gpt-3.5', 'gpt-4'].find(m => model.startsWith(m))
//     if (isFromOpenAI)
//         return 'openai'

//     const isFromAnthropic = ['claude-instant', 'claude-2'].find(m => model.startsWith(m))
//     if (isFromAnthropic)
//         return 'anthropic'

//     return ''
// }

// Simplifying the code above
const modelSuffixToVendorMapping = {
    openai: ['gpt-3.5', 'gpt-4'],
    anthropic: ['claude-instant', 'claude-2'],
}

type CursiveAvailableVendor = (keyof typeof modelSuffixToVendorMapping) | ''

export function resolveVendorFromModel(model: CursiveAvailableModels): CursiveAvailableVendor {
    for (const [vendor, suffixes] of Object.entries(modelSuffixToVendorMapping)) {
        if (suffixes.find(m => model.startsWith(m)))
            return vendor as CursiveAvailableVendor
    }

    return ''
}
