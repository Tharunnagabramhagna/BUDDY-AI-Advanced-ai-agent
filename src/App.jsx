import React from 'react'
import Spotlight from './components/Spotlight'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[Buddy] App boundary caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-slate-100 bg-slate-950">
          <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-center shadow-lg">
            <h1 className="mb-3 text-xl font-semibold text-rose-400">⚠️ Something went wrong</h1>
            <p className="mb-4 text-sm text-slate-300">Please check the DevTools console for details.</p>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-800 p-3 text-xs text-slate-300">{this.state.error?.message || 'Unknown error'}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-transparent text-slate-50 font-sans selection:bg-indigo-500/30">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-slate-950 opacity-40 pointer-events-none" />
        <Spotlight />
      </div>
    </AppErrorBoundary>
  )
}

export default App
