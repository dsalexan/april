require('dotenv').config()

const electron = require('electron')
const url = require('url')
const path = require('path')

const { app, BrowserWindow, Menu } = electron

const publish = require('./publish')

let mainWindow

const mainMenuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Add Item',
      },
      {
        label: 'Clear Items',
      },
      {
        label: 'Quit',
        accelerator: process.plataform === 'darwin' ? 'Command+Q' : 'Ctrl+Q', // darwin is macOS Node js process plataform
        click() {
          app.quit()
        },
      },
    ],
  },
  {
    label: 'Developer Tools',
    submenu: [
      {
        label: 'Toggle DevTools',
        accelerator: process.plataform === 'darwin' ? 'F12' : 'F12', // darwin is macOS Node js process plataform
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools()
        },
      },
      {
        role: 'reload',
      },
    ],
  },
]

function createWindow() {
  mainWindow = new BrowserWindow({
    titleBarStyle: 'hidden',
    width: 300,
    height: 900,
    icon: `${__dirname}/../assets/icons/win/icon.ico`,
    backgroundColor: '#282c34',
    show: false,
    webPreferences: {
      nodeIntegration: true,
    },
  })
  mainWindow.loadURL(
    process.env.REACT === 'development'
      ? `http://localhost:${process.env.PORT}/`
      : `file://${path.join(__dirname, '../build/index.html')}`
  )

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)
  Menu.setApplicationMenu(mainMenu)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  return mainWindow
}

// Listen for the app to the ready
app.on('ready', function () {
  createWindow()
  if (process.platform === 'win32') {
    if (process.env.NODE_ENV === 'development') app.setAppUserModelId(process.execPath)
    else app.setAppUserModelId('com.dsalexan.rpg.april')
  }
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

var driver

electron.ipcMain.on('@april/publish', async (event, scripts) => {
  console.log('publish', scripts)

  mainWindow.webContents.send('@april/notify', `API sandbox is shutting down...`)

  let status = await publish.publish(scripts)

  mainWindow.webContents.send('@april/published', scripts)
  mainWindow.webContents.send(
    '@april/notify',
    status === true ? `Scripts ${scripts.map((s) => `"${s}"`).join(', ')} were published to campaign API.` : status
  )
})

electron.ipcMain.on('@april/prepare', async (event, scripts) => {
  const config = require((process.env.NODE_ENV === 'development' ? './../dist' : '') + '/config.json')
  driver = await publish.prepare(config)

  mainWindow.webContents.send('@april/prepared')
  mainWindow.webContents.send('@april/notify', `Driver is prepared.`)
})

electron.ipcMain.on('@april/reset', async (event, scripts) => {
  mainWindow.webContents.send('@april/notify', `API sandbox is shutting down...`)

  let status = await publish.reset()

  mainWindow.webContents.send('@april/notify', status === true ? `API sandbox was restarted.` : status)
})

electron.ipcMain.on('@april/cancel', async (event, scripts) => {
  await driver.quit()
})
