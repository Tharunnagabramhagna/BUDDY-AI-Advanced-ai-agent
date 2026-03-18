let chatHistory = [];

export function getHistory() {
    return chatHistory;
}

export function setHistory(messages) {
    chatHistory = [...messages];
    return chatHistory;
}

export function addMessage(message) {
    chatHistory = [...chatHistory, message];
    return chatHistory;
}

export function addMessages(messages) {
    chatHistory = [...chatHistory, ...messages];
    return chatHistory;
}

