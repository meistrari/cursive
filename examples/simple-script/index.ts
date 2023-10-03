import { useCursive } from '../../src/index'

const cursive = useCursive({ countUsage: true })

debugger
const { answer, usage } = await cursive.ask({ prompt: 'Tell me a short short joke' })

console.log({
    answer,
    usage
})
