require("dotenv").config()
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
console.log("OPENAI_API_KEY loaded:", process.env.OPENAI_API_KEY ? "YES" : "NO")
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require("electron")
app.disableHardwareAcceleration()
const fs = require("fs")
const http = require("http")
const path = require("path")
const { exec } = require("child_process")
const { GoogleGenerativeAI } = require("@google/generative-ai")

const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) console.error("ERROR: No Gemini API key found in .env!");
const genAI = new GoogleGenerativeAI(API_KEY);
console.log("Gemini key loaded:", API_KEY ? API_KEY.substring(0, 8) + "..." : "MISSING");

let mainWindow
let tray
const DEV_SERVER_URL = "http://localhost:5173"
const DIST_INDEX_PATH = path.join(__dirname, "..", "dist", "index.html")

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception in main process:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection in main process:", error);
});

function isDevServerAvailable(url) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume()
            resolve(true)
        })

        request.on("error", () => resolve(false))
        request.setTimeout(1500, () => {
            request.destroy()
            resolve(false)
        })
    })
}

function showMainWindow() {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) {
        mainWindow.restore()
    }

    if (!mainWindow.isVisible()) {
        mainWindow.show()
    }

    mainWindow.focus()
}

function hideMainWindow() {
    if (!mainWindow) return

    mainWindow.hide()
}

async function loadRenderer() {
    const canUseDevServer = await isDevServerAvailable(DEV_SERVER_URL)

    if (canUseDevServer) {
        console.log("Loading Buddy from dev server")
        await mainWindow.loadURL(DEV_SERVER_URL)
        return
    }

    if (fs.existsSync(DIST_INDEX_PATH)) {
        console.log("Loading Buddy from dist fallback")
        await mainWindow.loadFile(DIST_INDEX_PATH)
        return
    }

    throw new Error("No renderer source available. Start Vite or build the app first.")
}

async function createWindow() {
    console.log("Creating Buddy window");
    let hasRevealedWindow = false

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        resizable: true,
        maximizable: true,
        alwaysOnTop: true,
        show: false, // start hidden
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
        console.error("Buddy window failed to load:", errorCode, errorDescription);
    });

    const revealWindow = () => {
        if (!mainWindow || hasRevealedWindow) return

        hasRevealedWindow = true
        console.log("Revealing Buddy window");
        showMainWindow()
    }

    mainWindow.once("ready-to-show", () => {
        console.log("Buddy window ready to show");
        revealWindow()
    })

    mainWindow.webContents.once("did-finish-load", () => {
        console.log("Buddy window finished loading");
        setTimeout(revealWindow, 120)
    })

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message}`);
    });

    mainWindow.on("close", (event) => {
        if (!app.isQuiting) {
            event.preventDefault()
            hideMainWindow()
        }
    })

    mainWindow.on("closed", () => {
        mainWindow = null
    })

    await loadRenderer()
    setTimeout(revealWindow, 600)
}

function createTray() {
    console.log("Creating Buddy tray");

    tray = new Tray(path.join(__dirname, "tray.png"))

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Open Buddy",
            click: () => {
                showMainWindow()
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
        showMainWindow()
    })
}

function registerShortcut() {
    console.log("Registering Buddy shortcut");

    globalShortcut.unregisterAll()

    const spotlightRegistered = globalShortcut.register("Control+Alt+B", () => {

        if (!mainWindow) return

        if (mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused()) {
            hideMainWindow()
        } else {
            showMainWindow()
        }

    })

    console.log("Shortcut registered:", spotlightRegistered);

}

function handleCommand(command) {
    console.log("Buddy command received:", command);
    const lower = command.toLowerCase().trim();

    if (lower.includes("search google for")) {
        const query = lower.split("search google for")[1].trim();
        exec(`start chrome "https://www.google.com/search?q=${encodeURIComponent(query)}"`);
        if (mainWindow) mainWindow.hide();
        return;
    }
    if (lower.includes("search youtube for")) {
        const query = lower.split("search youtube for")[1].trim();
        exec(`start chrome "https://www.youtube.com/results?search_query=${encodeURIComponent(query)}"`);
        if (mainWindow) mainWindow.hide();
        return;
    }

    const appMap = {
        'chrome': 'start chrome',
        'vscode': 'code .',
        'vs code': 'code .',
        'visual studio code': 'code .',
        'code': 'code .',
        'notepad': 'start notepad',
        'calculator': 'start calc',
        'calc': 'start calc',
        'paint': 'start mspaint',
        'edge': 'start msedge',
        'spotify': 'start spotify',
        'explorer': 'start explorer',
        'file explorer': 'start explorer',
        'terminal': 'start cmd',
        'cmd': 'start cmd',
        'powershell': 'start powershell',
        'discord': 'start discord',
        'steam': 'start steam',
        'vlc': 'start vlc',
        'zoom': 'start zoom',
        'slack': 'start slack',
        'brave': 'start brave',
        'firefox': 'start firefox',
        'opera': 'start opera',
    };

    // Strip action words to get app name
    let appName = lower;
    for (const action of ['open ', 'launch ', 'start ', 'run ', 'can you open ', 'please open ', 'i need ', 'i want to open ', "let's open ", 'could you open ']) {
        if (appName.startsWith(action)) {
            appName = appName.replace(action, '').trim();
            break;
        }
    }
    // Also strip trailing words like "for me", "please", "now"
    appName = appName.replace(/( for me| please| now| app)$/g, '').trim();

    const cmd = appMap[appName];
    if (cmd) {
        console.log("Opening:", appName, "->", cmd);
        exec(cmd, (err) => { if (err) console.error("Failed to open:", appName, err.message); });
        if (mainWindow) mainWindow.hide();
        return;
    }

    // Fuzzy fallback — check if any known app keyword appears anywhere in command
    for (const [key, cmd] of Object.entries(appMap)) {
        if (lower.includes(key)) {
            console.log("Fuzzy match:", key, "->", cmd);
            exec(cmd, (err) => { if (err) console.error("Fuzzy open failed:", err.message); });
            if (mainWindow) mainWindow.hide();
            return;
        }
    }

    console.log("No app matched for:", lower);
}

ipcMain.on("buddy-command", (event, command) => {
    handleCommand(command);
});

ipcMain.handle("window-minimize", () => {
    if (!mainWindow) return false;

    mainWindow.minimize();
    return true;
});

ipcMain.handle("window-toggle-maximize", () => {
    if (!mainWindow) return false;

    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        showMainWindow();
        console.log("Window restored");
        return "restored";
    }

    mainWindow.maximize();
    showMainWindow();
    console.log("Window maximized");
    return "maximized";
});

ipcMain.handle("window-close", () => {
    if (!mainWindow) return false;

    hideMainWindow();
    console.log("Window hidden to tray");
    return true;
});

ipcMain.handle("ask-buddy", async (event, prompt, history = []) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const validHistory = (Array.isArray(history) ? history : []).filter(
            m => m && m.role && Array.isArray(m.parts) && m.parts.length > 0 && m.parts[0].text
        );
        const chat = model.startChat({ history: validHistory });
        const result = await chat.sendMessage(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
});

app.whenReady().then(async () => {
    console.log("Electron app is ready");
    createTray()
    await createWindow()
    registerShortcut()
}).catch((error) => {
    console.error("Buddy failed during app startup:", error)
})

app.on("activate", async () => {
    if (!mainWindow) {
        await createWindow()
        return
    }

    showMainWindow()
})

app.on("window-all-closed", () => {
    console.log("All Buddy windows closed");
});

app.on("browser-window-created", () => {
    console.log("Buddy browser window created");
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll()
})
