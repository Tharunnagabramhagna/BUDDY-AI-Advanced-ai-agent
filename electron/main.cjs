const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require("electron")
const path = require("path")
const { exec } = require("child_process")

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

    const lower = command.toLowerCase()

    if (lower.includes("search google for")) {
        const query = lower.split("search google for")[1].trim()
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        exec(`start chrome "${url}"`)
        return
    }

    if (lower.includes("search youtube for")) {
        const query = lower.split("search youtube for")[1].trim()
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        exec(`start chrome "${url}"`)
        return
    }

    const actionWords = ["open", "launch", "start", "run"]

    let appName = null

    for (const action of actionWords) {
        if (lower.includes(action + " ")) {
            const parts = lower.split(action + " ")
            if (parts.length > 1) {
                appName = parts[1].trim().split(" ")[0]
                break
            }
        }
    }

    if (appName) {
        const appMap = {
            chrome: "chrome",
            vscode: "code",
            notepad: "notepad",
            calculator: "calc",
            calc: "calc",
            paint: "mspaint",
            edge: "msedge"
        }

        const appCommand = appMap[appName] || appName

        console.log("Opening app:", appCommand)

        exec(`start ${appCommand}`, (error) => {
            if (error) {
                console.log("Failed to open:", appCommand)
            }
        })
    }
})

app.whenReady().then(() => {

    createTray()
    createWindow()
    registerShortcut()

})

app.on("will-quit", () => {
    globalShortcut.unregisterAll()
})