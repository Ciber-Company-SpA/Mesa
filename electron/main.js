const { app, BrowserWindow, shell, Menu, session } = require('electron')

const BASE_URL = 'https://mesa-production-f46d.up.railway.app'
const APP_URL = `${BASE_URL}/admin`
const isDev = !app.isPackaged


const ALLOWED_ORIGIN = new URL(BASE_URL).origin

function isAllowedUrl(targetUrl) {
  try {
    return new URL(targetUrl).origin === ALLOWED_ORIGIN
  } catch {
    return false
  }
}

Menu.setApplicationMenu(null)

let mainWindow

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

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

app.whenReady().then(() => {
  session.fromPartition('persist:mesa').webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self' " + BASE_URL,
            "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co https://images.pexels.com",
            "connect-src 'self' " + BASE_URL +
              " https://api.cloudinary.com https://*.supabase.co wss://*.supabase.co",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self' 'unsafe-inline'",
            "frame-ancestors 'none'",
          ].join('; '),
        ],
      },
    })
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})