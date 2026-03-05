const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require("electron")
const path = require("path")

let mainWindow
let tray

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 700,
        height: 400,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        show: false, // start hidden
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    mainWindow.loadURL("http://localhost:5173")

    mainWindow.on("close", (event) => {
        if (!app.isQuiting) {
            event.preventDefault()
            mainWindow.hide()
        }
    })
}

function createTray() {

    tray = new Tray(path.join(__dirname, "tray.png"))

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Open Buddy",
            click: () => {
                mainWindow.show()
                mainWindow.focus()
            }
        },
        {
            label: "Quit",
            click: () => {
                app.isQuiting = true
                app.quit()
            }
        }
    ])

    tray.setToolTip("Buddy AI Assistant")
    tray.setContextMenu(contextMenu)

    tray.on("click", () => {
        mainWindow.show()
        mainWindow.focus()
    })
}

function registerShortcut() {

    const shortcut = "Control+Alt+B"

    globalShortcut.unregisterAll()

    globalShortcut.register(shortcut, () => {

        if (!mainWindow) return

        if (mainWindow.isVisible()) {

            mainWindow.minimize()

        } else {

            mainWindow.show()
            mainWindow.focus()

        }

    })

}

ipcMain.on("buddy-command", (event, command) => {
    console.log("Buddy received command:", command)
})

app.whenReady().then(() => {

    createTray()
    createWindow()
    registerShortcut()

})

app.on("will-quit", () => {
    globalShortcut.unregisterAll()
})