import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 700,
        height: 400,
        resizable: false,
        center: true,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.removeMenu();
    mainWindow.loadURL('http://localhost:5173');

    // Hide window when it loses focus
    mainWindow.on('blur', () => {
        mainWindow.hide();
    });

    // Hide window when pressing ESC
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && input.type === 'keyDown') {
            mainWindow.hide();
            event.preventDefault();
        }
    });

    // When closing the window, hide it instead of destroying it (unless quitting)
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    // Register a global shortcut 'Ctrl+Space'
    globalShortcut.register('CommandOrControl+Space', () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            createWindow();
        } else {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.center();
                mainWindow.focus();
            }
        }
    });

    // Create System Tray Icon
    const iconPath = path.join(__dirname, 'tray.png');
    tray = new Tray(iconPath);
    tray.setToolTip('Buddy AI');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Buddy',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.center();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        {
            label: 'Quit Buddy',
            click: () => {
                isQuitting = true;
                globalShortcut.unregisterAll();
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Keep app running in background explicitly
    if (isQuitting) {
        app.quit();
    }
});

app.on('will-quit', () => {
    // Unregister all shortcuts when quitting
    globalShortcut.unregisterAll();
});
