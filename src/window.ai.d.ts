import type { WindowAI } from 'window.ai'

declare global {
    interface Window {
        ai: WindowAI
    }
}