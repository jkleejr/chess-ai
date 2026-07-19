import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { closeDb, openDb } from './db/database'
import { resetStuckAnalyzing } from './db/repos/gamesRepo'
import { analysisQueue } from './engine/analysisQueue'
import { registerIpcHandlers } from './ipc/handlers'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

// Keep the runtime app name stable regardless of the bundle's display name
// ("Chess Analysis"): userData path (~/Library/Application Support/chess-ai) and
// the safeStorage keychain entry are derived from it, and existing users have
// their games and encrypted API key under the dev-era identity.
app.setName('chess-ai')

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.chessai.coach')

  // Headless dev harness: COACH_SMOKE_GAME=<id> runs one real coaching call
  // (no window) and exits. Used to verify the pipeline without the UI.
  if (process.env.COACH_SMOKE_GAME || process.env.STYLE_SMOKE) {
    openDb()
    try {
      if (process.env.COACH_SMOKE_GAME) {
        const { explainGame } = await import('./coach/gameCoach')
        const insight = await explainGame(parseInt(process.env.COACH_SMOKE_GAME, 10))
        console.log('COACH_SMOKE_OK ' + JSON.stringify(insight))
      } else {
        const { generateStyleReport } = await import('./coach/styleReport')
        const report = await generateStyleReport()
        console.log('STYLE_SMOKE_OK ' + JSON.stringify(report))
      }
    } catch (e) {
      console.error('SMOKE_FAIL', (e as Error).message)
      process.exitCode = 1
    }
    app.quit()
    return
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  openDb()
  // Deliberately do NOT auto-analyze the backlog at startup — analysis runs
  // for freshly synced games, opened games, and explicit "Analyze all" only.
  resetStuckAnalyzing()
  const win = createWindow()
  registerIpcHandlers(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  analysisQueue.shutdown()
  closeDb()
})
