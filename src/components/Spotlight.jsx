import { Terminal, Check, X, Sparkles, Mic } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function Spotlight() {
    const [command, setCommand] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const inputRef = useRef(null);

    // Auto focus on mount and prevent scroll
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && command.trim() !== '') {
            setIsExecuting(true);
        }
        if (e.key === 'Escape') {
            setCommand('');
            setIsExecuting(false);
        }
    };

    const handleCancel = () => {
        setIsExecuting(false);
    };

    const handleApprove = () => {
        console.log('Approved execution plan for:', command);
        setIsExecuting(false);
        setCommand('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md antialiased transition-all">
            {/* Main overlay container */}
            <div
                className="w-full max-w-[600px] mx-4 bg-slate-900/80 backdrop-blur-3xl border border-slate-700/50 rounded-[20px] shadow-[0_30px_100px_-15px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{ boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255,255,255,0.08) inset' }}
            >
                {/* Greeting / header area */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600/50 shadow-inner flex shrink-0 items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-400/20 via-transparent to-transparent opacity-60" />
                    </div>
                    <p className="text-slate-500/70 text-xs font-normal">
                        What can I help you with today?
                    </p>
                </div>

                {/* Input area */}
                <div className="flex items-center px-5 pb-6 pt-1">
                    <Terminal className="text-slate-500 mr-3 shrink-0" size={24} strokeWidth={1.5} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Buddy..."
                        className="flex-1 bg-transparent border-none text-slate-100 text-3xl font-normal placeholder:text-slate-600 focus:outline-none w-full"
                    />
                    <Mic className="text-slate-600 ml-3 shrink-0 hover:text-slate-400 transition-colors cursor-pointer" size={20} strokeWidth={1.5} />
                </div>

                {/* Execution Plan Section (Smooth slide down animation) */}
                <div
                    className={`grid transition-all duration-300 ease-in-out ${isExecuting ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                >
                    <div className="overflow-hidden">
                        <div className="border-t border-slate-700/50 bg-slate-800/30">
                            <div className="px-5 py-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles size={16} className="text-indigo-400" />
                                    <h3 className="text-sm font-medium text-slate-300">Execution Plan</h3>
                                </div>

                                <ul className="space-y-2 mb-5">
                                    <li className="text-sm text-slate-400 flex items-start gap-2">
                                        <span className="text-emerald-500 mt-0.5">•</span>
                                        <span>Analyze request context and dependencies</span>
                                    </li>
                                    <li className="text-sm text-slate-400 flex items-start gap-2">
                                        <span className="text-emerald-500 mt-0.5">•</span>
                                        <span>Open necessary applications to perform task</span>
                                    </li>
                                    <li className="text-sm text-slate-400 flex items-start gap-2">
                                        <span className="text-slate-600 mt-0.5">•</span>
                                        <span>Execute UI interactions on your behalf</span>
                                    </li>
                                </ul>

                                <div className="flex items-center gap-3 justify-end">
                                    <button
                                        onClick={handleCancel}
                                        className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700/60 hover:text-white active:scale-95 rounded-lg transition-all border border-transparent hover:border-slate-600/50 flex items-center gap-1.5"
                                    >
                                        <X size={14} />
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleApprove}
                                        className="px-4 py-1.5 text-sm font-medium bg-indigo-500 hover:bg-indigo-400 hover:shadow-indigo-500/30 active:scale-95 text-white rounded-lg transition-all shadow-sm shadow-indigo-500/20 flex items-center gap-1.5"
                                    >
                                        <Check size={14} />
                                        Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
