import { Cpu, Eye, Lock, Database } from 'lucide-react';

const features = [
    {
        icon: Cpu,
        title: 'Smart Task Execution',
        description: 'Buddy autonomously plans and executes complex desktop tasks across multiple applications with ease.'
    },
    {
        icon: Eye,
        title: 'Screen Awareness',
        description: 'Visually intelligent context processing understands what is on your screen in real time.'
    },
    {
        icon: Lock,
        title: 'Secure Permission Control',
        description: 'You maintain strict control over what Buddy can access, with end-to-end sandbox security.'
    },
    {
        icon: Database,
        title: 'Personal Memory Database',
        description: 'Buddy remembers your workflows, preferences, and commands contextually to serve you better.'
    },
];

export default function Features() {
    return (
        <section className="relative z-10 py-24 px-4 bg-slate-950">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">

                    {/* Subtle background glow for features section */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <div
                                key={index}
                                className="group relative p-8 bg-slate-900/50 border border-slate-800/50 rounded-[2rem] hover:bg-slate-800/50 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 overflow-hidden backdrop-blur-sm"
                            >
                                {/* Hover gradient effect inside card */}
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                                <div className="relative z-10 space-y-5">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40 text-indigo-400 shadow-inner">
                                        <Icon strokeWidth={1.5} size={28} />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold text-slate-100 tracking-wide group-hover:text-indigo-300 transition-colors duration-300">
                                            {feature.title}
                                        </h3>

                                        <p className="text-slate-400 leading-relaxed text-sm group-hover:text-slate-300 transition-colors duration-300">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
