import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// Channel names duplicated from src/main/ipc/channels.ts — preload cannot import
// from main's bundle. Keep in sync.
const INVOKE_CHANNELS = [
  'settings:get',
  'settings:set',
  'settings:hasApiKey',
  'settings:setApiKey',
  'settings:testApiKey',
  'sync:start',
  'games:list',
  'games:get',
  'games:count',
  'analysis:enqueue',
  'analysis:status',
  'analysis:pause',
  'analysis:resume',
  'engine:status',
  'engine:setup',
  'coach:explainGame',
  'coach:explainMove',
  'coach:styleReport',
  'coach:costs',
  'profile:get',
  'styleReport:get',
  'stats:openings',
  'stats:accuracy',
  'stats:mistakeTags',
  'stats:extended',
  'stats:timeControls',
  'bot:start',
  'bot:move',
  'bot:stop'
] as const

const EVENT_CHANNELS = [
  'ev:sync:progress',
  'ev:analysis:progress',
  'ev:analysis:game-complete',
  'ev:engine:status',
  'ev:coach:insight-ready'
] as const

type InvokeChannel = (typeof INVOKE_CHANNELS)[number]
type EventChannel = (typeof EVENT_CHANNELS)[number]

const api = {
  invoke: (channel: InvokeChannel, ...args: unknown[]): Promise<unknown> => {
    if (!INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: EventChannel, callback: (payload: unknown) => void): (() => void) => {
    if (!EVENT_CHANNELS.includes(channel)) throw new Error(`Unknown event channel: ${channel}`)
    const listener = (_e: IpcRendererEvent, payload: unknown): void => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

export type PreloadApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
