const path = require('path')
const { app, BrowserWindow, shell, Menu } = require('electron')

const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env.local')
  : path.join(__dirname, '..', '.env.local')

try {
  require('dotenv').config({ path: envPath })
} catch (err) {
  console.warn('[electron] No se pudo cargar .env.local:', err && err.message)
}

// Quita la barra de menu antes de crear cualquier ventana
Menu.setApplicationMenu(null)

let mainWindow

const BASE_URL = process.env.ELECTRON_APP_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || 'http://localhost:3000'
const APP_URL = `${BASE_URL}/admin`
const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:mesa',
    },
    show: true,
    backgroundColor: '#0c0a09',
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.setMenu(null)

  console.log(`[electron] Cargando ${APP_URL}`)
  mainWindow.loadURL(APP_URL).catch((err) => {
    console.error('[electron] Error cargando URL:', err)
  })

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[electron] did-fail-load (${code} ${description}) -> ${url}`)
    if (code === -102 || code === -106 || code === -105) {
      setTimeout(() => {
        console.log('[electron] Reintentando cargar...')
        mainWindow.loadURL(APP_URL).catch(() => undefined)
      }, 2000)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
