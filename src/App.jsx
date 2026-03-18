import Spotlight from './components/Spotlight'

function App() {
  return (
    <div className="min-h-screen bg-transparent text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-slate-950 opacity-40 pointer-events-none" />
      <Spotlight />
    </div>
  )
}

export default App
