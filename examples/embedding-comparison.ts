import { useCursive } from '../src/index'

const cursive = useCursive()

for (const _ of [1,1,1,1,1]) {
    const textA = 'Olá'
    const embeddingA = await cursive.embed(textA)
    
    const textB = 'Olá'
    const embeddingB = await cursive.embed(textB)
    
    const howSimilar = similarity(embeddingA, embeddingB)
    
    console.log({
        textA,
        textB,
        howSimilar
    })
}

function similarity(a: number[], b: number[]) {
    const dotProduct = a.reduce((acc, cur, i) => acc + cur * b[i], 0)
    const normA = Math.sqrt(a.reduce((acc, cur) => acc + cur * cur, 0))
    const normB = Math.sqrt(b.reduce((acc, cur) => acc + cur * cur, 0))
    return dotProduct / (normA * normB)
}
