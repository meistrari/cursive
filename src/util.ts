export type HookResult = Promise<void> | void

export type Override<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

type CamelToSnakeCaseKey<S> = S extends `${infer T}${infer U}` ? `${T extends Uppercase<T> ? `_${Lowercase<T>}` : T}${CamelToSnakeCaseKey<U>}` : S
export type CamelToSnakeCase<T> = T extends Array<infer U>
    ? Array<CamelToSnakeCase<U>>
    : T extends object
        ? { [K in keyof T as CamelToSnakeCaseKey<K>]: CamelToSnakeCase<T[K]> }
        : T

const lowercase = (w: string) => w.toLowerCase()
const toSnakeString = (w: string) => w.split(/(?=[A-Z])/).map(lowercase).join('_')

export function toSnake<T>(source: T): CamelToSnakeCase<T> {
    if (Array.isArray(source))
        return source.map(toSnake) as any

    if (source && typeof source === 'object') {
        const target = {} as any
        for (const [key, value] of Object.entries(source)) {
            const newKey = toSnakeString(key)
            target[newKey] = toSnake(value)
        }
        return target
    }
    return source as CamelToSnakeCase<T>
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Makes every key of the object null
export type ObjectWithNullValues<T extends Record<string, any>> = {
    [K in keyof T]: null
}

// Override keys of T with keys of U
export type IfNull<T, U> = T extends null ? U : null
