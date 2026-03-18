const { contextBridge, ipcRenderer } = require("electron")

console.log("Buddy preload bridge loaded")

contextBridge.exposeInMainWorld("electronAPI", {
    sendBuddyCommand: (command) => ipcRenderer.send("buddy-command", command)
})

contextBridge.exposeInMainWorld("buddyAPI", {
    askBuddy: (prompt, history = []) => ipcRenderer.invoke("ask-buddy", prompt, history)
})

contextBridge.exposeInMainWorld("buddyWindow", {
    minimize: () => ipcRenderer.invoke("window-minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
    close: () => ipcRenderer.invoke("window-close")
})
