import { useState } from 'react'
import Spotlight from './components/Spotlight'

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse('');
    try {
      const result = await window.buddyAPI.askBuddy(prompt);
      setResponse(result);
    } catch (error) {
      setResponse("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Simulating minimal background desktop context for the Spotlight UI overlay */}
      <div className="absolute inset-0 bg-slate-950 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none"></div>

      <Spotlight />

      {/* Floating Gemini AI Interface */}
      <div className="absolute top-8 right-8 z-[60] w-80 bg-slate-900 border border-slate-700/60 rounded-xl p-5 shadow-2xl backdrop-blur-xl">
        <h3 className="font-semibold text-slate-200 mb-3 text-sm">Gemini AI Test</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Buddy a question..."
          className="w-full bg-slate-800/80 text-slate-200 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500/50 resize-none h-24 mb-3"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !prompt.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
        {response && (
          <div className="mt-4 bg-slate-800/50 border border-slate-700/50 p-4 rounded-lg text-sm text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
            {response}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
