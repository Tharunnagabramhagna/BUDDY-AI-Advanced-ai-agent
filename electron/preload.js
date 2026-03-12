const { contextBridge, ipcRenderer } = require("electron")

console.log("Buddy preload bridge loaded")

contextBridge.exposeInMainWorld("electronAPI", {
    sendBuddyCommand: (command) => ipcRenderer.send("buddy-command", command)
})

contextBridge.exposeInMainWorld("buddyAPI", {
    askBuddy: (prompt) => ipcRenderer.invoke("ask-buddy", prompt)
})
