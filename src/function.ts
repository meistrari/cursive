import { type TProperties, Type } from '@sinclair/typebox'
import type { CursiveCreateFunctionOptions, CursiveFunction } from './types'

export function createFunction<P extends TProperties>(options: CursiveCreateFunctionOptions<P>): CursiveFunction {
    const parameters = Type.Object(options.parameters ?? {})
    const { description, name } = options

    const resolvedSchema = {
        parameters: {
            properties: deepRemoveNonStringKeys(parameters.properties),
            required: parameters.required,
            type: 'object' as const,
        },
        description,
        name,
    }

    return {
        schema: resolvedSchema,
        definition: options.execute,
        pause: options.pause,
    }
}

function deepRemoveNonStringKeys(obj: any) {
    const newObj: any = {}
    for (const key in obj) {
        if (typeof obj[key] === 'string')
            newObj[key] = obj[key]
        else if (Array.isArray(obj[key]))
            newObj[key] = obj[key]
        else if (typeof obj[key] === 'object')
            newObj[key] = deepRemoveNonStringKeys(obj[key])
    }
    return newObj
}
