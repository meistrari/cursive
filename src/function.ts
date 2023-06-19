import type { ZodRawShape } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { JsonSchema7ObjectType } from 'zod-to-json-schema/src/parsers/object'
import z from 'zod'
import type { CursiveCreateFunctionOptions } from './types'

export function createFunction<P extends ZodRawShape>(options: CursiveCreateFunctionOptions<P>) {
    const zodSchema = z.object({ ...options.parameters }).describe(options.description)
    const { type, properties, required, description } = zodToJsonSchema(zodSchema) as JsonSchema7ObjectType & { description: string }
    const resolvedSchema = {
        parameters: {
            type,
            properties,
            required,
        },
        description,
        name: options.name,
    }
    return {
        schema: resolvedSchema,
        definition: options.execute,
    }
}
