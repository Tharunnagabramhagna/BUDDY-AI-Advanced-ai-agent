require("dotenv").config()
console.log("OPENAI_API_KEY loaded:", process.env.OPENAI_API_KEY ? "YES" : "NO")
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require("electron")
const path = require("path")
const { exec } = require("child_process")
const { GoogleGenerativeAI } = require("@google/generative-ai")

const API_KEY = process.env.VITE_GEMINI_API_KEY || "AIzaSyDr_qE80_xKlv1E4eE_J088pZf70vL9oGk";
const genAI = new GoogleGenerativeAI(API_KEY);

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
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.loadURL("http://localhost:5173")

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message}`);
    });

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

function handleCommand(command) {
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
}

ipcMain.on("buddy-command", (event, command) => {
    handleCommand(command)
})

ipcMain.handle("ask-buddy", async (event, prompt) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
});

app.whenReady().then(() => {
    createTray()
    createWindow()
    registerShortcut()
})

app.on("will-quit", () => {
    globalShortcut.unregisterAll()
})