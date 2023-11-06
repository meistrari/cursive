import { TSchema } from "@sinclair/typebox"

export function schemaToFunction(schema: TSchema | undefined) {
    if(!schema)
        return undefined
    
    // Remove all the typebox symbols
    const { title: name, description, ...resolvedSchema} = JSON.parse(JSON.stringify(schema))

    const resolved = {
        name,
        description,
        parameters: resolvedSchema
    }

    return resolved
}

