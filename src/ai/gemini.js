export async function askBuddy(prompt) {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3.5:2b',
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.response;
  } catch (error) {
    console.error("Error asking buddy (Ollama):", error);
    return "Make sure Ollama is running (`ollama serve` or open the Ollama app) and you have the model downloaded (`ollama run qwen3.5:2b`).";
  }
}