const { contextBridge, ipcRenderer } = require("electron")

console.log("Buddy preload bridge loaded")

contextBridge.exposeInMainWorld("electronAPI", {
    sendBuddyCommand: (command) => ipcRenderer.send("buddy-command", command),
    closeApp: () => ipcRenderer.send("close-app"),
})

contextBridge.exposeInMainWorld("buddyAPI", {
    askBuddy: (prompt, history = []) => ipcRenderer.invoke("ask-buddy", prompt, history)
})

contextBridge.exposeInMainWorld("buddyWindow", {
    minimize: () => ipcRenderer.invoke("window-minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
    close: () => ipcRenderer.invoke("window-close")
})

contextBridge.exposeInMainWorld("buddySTT", {
    getResult: () => ipcRenderer.invoke("get-stt-result"),
    getStatus: () => ipcRenderer.invoke("get-stt-status"),
    notifyOpen: () => ipcRenderer.invoke("stt-app-open"),
    notifyClose: () => ipcRenderer.invoke("stt-app-close"),
})
