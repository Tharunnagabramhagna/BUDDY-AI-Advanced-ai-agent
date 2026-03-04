import { Terminal, Zap } from 'lucide-react';
import { useState } from 'react';

export default function Hero() {
    const [command, setCommand] = useState('');

    const handleLaunch = () => {
        if (command.trim()) {
            console.log('Launching Buddy with command:', command);
        } else {
            console.log('Launching Buddy...');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center pt-32 pb-16 px-4 bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 antialiased relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>

            {/* Decorative Blur Vectors - Reduced intensity for minimal feel */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px] pointer-events-none" />

            <main className="relative z-10 flex flex-col items-center w-full max-w-3xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500 tracking-widest uppercase mb-2">
                        Meet Buddy
                    </p>
                    <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-slate-100">
                        Buddy
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 font-normal max-w-md mx-auto mt-2">
                        Your Intelligent Desktop Agent
                    </p>
                </div>

                <div className="w-full max-w-2xl mt-6">
                    <div className="flex items-center gap-3 mb-4 pl-3 text-left opacity-90 transition-opacity duration-1000">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/60 shadow-inner flex shrink-0 items-center justify-center overflow-hidden">
                            <div className="w-full h-full bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-500/20 via-transparent to-transparent opacity-60" />
                        </div>
                        <p className="text-slate-400/90 text-[15px] font-normal">
                            What can I help you with today?
                        </p>
                    </div>

                    <div className="w-full relative group cursor-text">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-[2rem] blur-md opacity-20 group-hover:opacity-30 group-focus-within:opacity-50 group-focus-within:from-indigo-500/40 group-focus-within:via-blue-500/40 group-focus-within:to-indigo-500/40 transition duration-700" />

                        <div className="relative flex items-center bg-slate-900/60 border border-slate-800 backdrop-blur-2xl rounded-full p-1.5 pl-5 shadow-xl transition-all group-focus-within:border-slate-700/80 group-focus-within:bg-slate-900/70 group-focus-within:shadow-indigo-500/10">
                            <Terminal className="text-slate-500 mr-2 flex-shrink-0" size={20} />
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="Ask Buddy to do something..."
                                className="flex-1 bg-transparent border-none text-slate-200 text-base placeholder:text-slate-600 focus:outline-none w-full py-2.5"
                            />
                            <button
                                className="ml-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.98] flex items-center gap-2 whitespace-nowrap"
                                onClick={handleLaunch}
                            >
                                <Zap size={16} className="text-slate-400" />
                                Launch Buddy
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
