import { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';

const mockLogs = [
    { time: '[10:01]', message: 'Opened Chrome' },
    { time: '[10:02]', message: 'Searched "AI News"' },
    { time: '[10:03]', message: 'Saved first link' },
    { time: '', message: 'Awaiting permission...', isStatus: true },
];

export default function ActivityLog() {
    const [visibleLogs, setVisibleLogs] = useState([]);
    // Derived state: true if there are still logs left to display
    const isTyping = visibleLogs.length < mockLogs.length;

    useEffect(() => {
        let timeout;
        if (isTyping) {
            timeout = setTimeout(() => {
                setVisibleLogs(prev => [...prev, mockLogs[visibleLogs.length]]);
            }, 1500); // 1.5 seconds between each log
        }
        return () => clearTimeout(timeout);
    }, [visibleLogs, isTyping]);

    return (
        <section className="relative z-10 py-16 px-4 bg-slate-950 flex flex-col items-center">
            <div className="max-w-3xl w-full">
                <div className="text-center mb-8">
                    <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-200 to-indigo-400">
                        Real-time Activity
                    </h2>
                    <p className="mt-3 text-slate-400">Watch Buddy execute your tasks securely.</p>
                </div>

                {/* Glassmorphism Terminal Panel */}
                <div className="relative group">
                    {/* Subtle background glow */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-blue-500/20 to-indigo-500/20 rounded-2xl blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />

                    <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                        {/* Terminal Header */}
                        <div className="flex items-center px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
                            <div className="flex space-x-2 mr-4">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                            <div className="flex items-center text-slate-400 text-xs font-mono">
                                <Terminal size={14} className="mr-2" />
                                buddy-execution-log
                            </div>
                        </div>

                        {/* Terminal Body */}
                        <div className="p-6 font-mono text-sm md:text-base h-64 overflow-y-auto no-scrollbar flex flex-col items-start justify-start select-text">
                            <div className="space-y-3 w-full">
                                {visibleLogs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`flex animate-in slide-in-from-left-2 fade-in duration-300 ${log.isStatus ? 'text-indigo-400 animate-pulse mt-4' : 'text-slate-300'}`}
                                    >
                                        {!log.isStatus && (
                                            <span className="text-emerald-500/80 mr-3 shrink-0">{log.time}</span>
                                        )}
                                        <span className={`${log.isStatus ? 'font-semibold' : ''}`}>
                                            {log.isStatus && <span className="mr-2 inline-block w-2 text-indigo-400 relative -top-0.5">›</span>}
                                            {log.message}
                                        </span>
                                    </div>
                                ))}

                                {/* Blinking cursor effect for typing */}
                                {isTyping && (
                                    <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse mt-1 ml-1" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
