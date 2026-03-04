import Spotlight from './components/Spotlight'

function App() {
  return (
    <div className="min-h-screen bg-transparent text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Simulating minimal background desktop context for the Spotlight UI overlay */}
      <div className="absolute inset-0 bg-slate-950 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none"></div>
      <Spotlight />
    </div>
  )
}

export default App
