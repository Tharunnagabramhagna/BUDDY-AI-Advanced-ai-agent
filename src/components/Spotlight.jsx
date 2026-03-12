import { Terminal, Check, X, Sparkles, Mic } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

const Spotlight = React.memo(() => {
    const [command, setCommand] = useState('');
    const [storedCommand, setStoredCommand] = useState('');
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
            setStoredCommand(command);
            setIsExecuting(true);
        }
        if (e.key === 'Escape') {
            setCommand('');
            setStoredCommand('');
            setIsExecuting(false);
        }
    };

    const handleCancel = () => {
        setIsExecuting(false);
        setStoredCommand('');
    };

    const handleApprove = () => {
        console.log('Approved execution plan for:', storedCommand);
        if (window.electronAPI && window.electronAPI.sendBuddyCommand) {
            window.electronAPI.sendBuddyCommand(storedCommand);
        } else if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send("buddy-command", storedCommand);
        }
        setIsExecuting(false);
        setCommand('');
        setStoredCommand('');
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
                    <p className="text-slate-500/40 text-[11px] font-normal">
                        What can I help you with today?
                    </p>
                </div>

                {/* Input area */}
                <div className="flex items-center px-5 pb-6 pt-1 relative group">
                    {/* Soft focus glow effect around input field */}
                    <div className="absolute inset-x-5 inset-y-0 bottom-5 rounded-lg opacity-0 group-focus-within:opacity-100 group-focus-within:shadow-[0_0_25px_rgba(255,255,255,0.04)] transition-all duration-200 pointer-events-none" />
                    <Terminal className="text-slate-500 mr-3 shrink-0 relative z-10" size={24} strokeWidth={1.5} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Buddy..."
                        className="flex-1 bg-transparent border-none text-slate-100 text-3xl font-normal placeholder:text-slate-600 focus:outline-none w-full relative z-10"
                    />
                    <button className="ml-3 text-slate-500 hover:text-slate-300 transition shrink-0 relative z-10">
                        <Mic size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Execution Plan Section (Smooth slide down animation) */}
                <div
                    className={`grid transition-all duration-200 ease-in-out ${isExecuting ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                >
                    <div className="overflow-hidden">
                        {/* Subtle Divider Line */}
                        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-600/40 to-transparent" />

                        <div className="bg-slate-800/30">
                            <div className="px-5 py-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles size={16} className="text-indigo-400" />
                                    <h3 className="text-sm font-medium text-slate-300">Execution Plan</h3>
                                </div>
                                {storedCommand && (
                                    <div className="mb-3 px-3 py-2 bg-slate-900/60 rounded-md text-slate-300 text-sm border border-slate-700/50">
                                        Command: <span className="text-white font-mono ml-1">{storedCommand}</span>
                                    </div>
                                )}

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
                                        className="px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700/60 hover:text-white active:scale-95 rounded-lg transition-all duration-200 border border-transparent hover:border-slate-600/50 flex items-center gap-1.5"
                                    >
                                        <X size={14} />
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleApprove}
                                        className="px-4 py-1.5 text-sm font-medium bg-indigo-500 hover:bg-indigo-400 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-[1.03] active:scale-95 text-white rounded-lg transition-all duration-200 shadow-sm shadow-indigo-500/20 flex items-center gap-1.5"
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
});

export default Spotlight;
