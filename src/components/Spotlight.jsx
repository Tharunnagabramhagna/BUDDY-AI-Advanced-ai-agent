import { Sparkles, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import CommandInput from './CommandInput';
import { addMessage, addMessages, getHistory, setHistory } from '../store/chatStore';

const APP_KEYWORDS = [
    'chrome', 'vscode', 'vs code', 'visual studio code', 'code',
    'notepad', 'calculator', 'calc', 'paint', 'edge', 'spotify',
    'explorer', 'file explorer', 'terminal', 'cmd', 'powershell',
    'word', 'excel', 'powerpoint', 'outlook', 'teams', 'discord',
    'steam', 'vlc', 'zoom', 'slack', 'notion', 'obsidian', 'brave',
    'firefox', 'opera', 'photoshop', 'premiere', 'illustrator'
];

const COMMAND_TRIGGERS = ['open ', 'launch ', 'start ', 'run ', 'search google for ', 'search youtube for '];
const SIDEBAR_SUGGESTIONS = ['Ask me anything', 'Open Chrome', 'Search YouTube', 'Search Google'];

const glassCard = {
    background: 'rgba(18,18,22,0.65)',
    backdropFilter: 'blur(60px) saturate(200%)',
    WebkitBackdropFilter: 'blur(60px) saturate(200%)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)'
};

const BuddyLogo = React.memo(({ size = 'sm', pulse = true }) => {
    const dim = size === 'lg' ? 64 : size === 'md' ? 40 : 28;
    const iconSize = size === 'lg' ? 22 : size === 'md' ? 14 : 10;
    const ringDim = size === 'lg' ? 80 : size === 'md' ? 52 : 36;

    return (
        <div className="relative flex items-center justify-center" style={{ width: ringDim, height: ringDim }}>
            {pulse && (
                <>
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '1px solid rgba(59,130,246,0.5)', animationDuration: '2.5s' }} />
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '1px solid rgba(59,130,246,0.25)', animationDuration: '2.5s', animationDelay: '0.8s' }} />
                </>
            )}
            <div
                className="relative rounded-full flex items-center justify-center"
                style={{
                    width: dim,
                    height: dim,
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.2) 100%)',
                    border: '1px solid rgba(59,130,246,0.6)',
                    boxShadow: '0 0 24px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
            >
                <Sparkles size={iconSize} style={{ color: 'rgba(96,165,250,1)' }} />
            </div>
        </div>
    );
});

const Sidebar = React.memo(({ visible }) => (
    <div
        className="fixed right-5 top-1/2 -translate-y-1/2 w-[180px] transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: `translateY(-50%) translateX(${visible ? 0 : 24}px)`, pointerEvents: visible ? 'auto' : 'none' }}
    >
        <div
            style={{
                background: 'rgba(20,20,25,0.72)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 18,
                padding: '16px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
            }}
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>ONLINE</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Hey, I&apos;m Buddy</p>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>Your personal AI assistant - always one shortcut away.</p>
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, letterSpacing: '0.06em', marginBottom: 8 }}>TRY SAYING</p>
            {SIDEBAR_SUGGESTIONS.map((text) => (
                <div key={text} className="flex items-center gap-1.5 mb-1.5">
                    <span style={{ color: 'rgba(96,165,250,0.7)', fontSize: 10 }}>{'>'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11 }}>{text}</span>
                </div>
            ))}
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }}>gemini-1.5-flash</p>
        </div>
    </div>
));

const WelcomeSplash = React.memo(({ onDone }) => {
    const [phase, setPhase] = useState('enter');

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('hold'), 400);
        const t2 = setTimeout(() => setPhase('dissolve'), 2000);
        const t3 = setTimeout(() => onDone(), 2800);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [onDone]);

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-700"
            style={{
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(60px)',
                WebkitBackdropFilter: 'blur(60px)',
                opacity: phase === 'dissolve' ? 0 : 1,
                transform: phase === 'dissolve' ? 'scale(0.97)' : 'scale(1)'
            }}
        >
            <div
                className="flex flex-col items-center gap-5 transition-all duration-500"
                style={{ opacity: phase === 'enter' ? 0 : 1, transform: phase === 'enter' ? 'translateY(12px)' : 'translateY(0)' }}
            >
                <BuddyLogo size="lg" pulse />
                <div className="text-center" style={{ marginTop: 8 }}>
                    <h1 style={{ color: 'rgba(255,255,255,0.92)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Buddy</h1>
                    <p style={{ color: 'rgba(255,255,255,0.36)', fontSize: 13, marginTop: 6, fontWeight: 400 }}>Your personal AI assistant</p>
                </div>
                <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                >
                    <kbd style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'monospace' }}>Ctrl + Alt + B</kbd>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>to open anytime</span>
                </div>
            </div>
        </div>
    );
});

const ChatHeader = React.memo(() => (
    <div
        className="relative w-full"
        style={{
            ...glassCard,
            borderRadius: '20px 20px 0 0',
            padding: '16px 20px 10px',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)'
        }}
    >
        <div className="flex items-center px-5 py-3 pr-16">
            <div className="flex items-center gap-2" style={{ color: 'rgba(96,165,250,0.9)', fontWeight: 500, letterSpacing: '0.08em', fontSize: 12 }}>
                <Sparkles size={15} />
                <span>BUDDY AI</span>
            </div>
        </div>
    </div>
));

const ChatPanel = React.memo(({ chatOpen, isLoading, messages, onClose, chatEndRef }) => {
    const messageList = useMemo(() => messages.map((msg, index) => (
        <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'buddy' && (
                <div
                    className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                    style={{ width: 20, height: 20, background: 'rgba(59,130,246,0.12)', border: '0.5px solid rgba(59,130,246,0.3)' }}
                >
                    <Sparkles size={9} style={{ color: 'rgba(96,165,250,0.9)' }} />
                </div>
            )}
            <div
                style={{
                    maxWidth: '78%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    background: msg.role === 'user' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `0.5px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    color: msg.role === 'user' ? 'rgba(186,219,255,0.95)' : 'rgba(255,255,255,0.65)'
                }}
            >
                {msg.text}
            </div>
        </div>
    )), [messages]);

    return (
        <div
            style={{
                ...glassCard,
                borderRadius: chatOpen ? 0 : '0 0 20px 20px',
                overflow: 'hidden',
                maxHeight: chatOpen ? 380 : 0,
                opacity: chatOpen ? 1 : 0,
                transition: 'max-height 0.4s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease, border-radius 0.3s ease',
                borderBottom: chatOpen ? '0.5px solid rgba(255,255,255,0.06)' : 'none'
            }}
        >
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles size={13} style={{ color: 'rgba(96,165,250,0.8)' }} />
                    <span style={{ color: 'rgba(96,165,250,0.8)', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em' }}>BUDDY AI</span>
                </div>
                <button
                    onClick={onClose}
                    className="flex items-center justify-center rounded-full transition-all hover:bg-white/10"
                    style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
                >
                    <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
            </div>

            <div className="overflow-y-auto px-5 pb-4 space-y-3" style={{ maxHeight: 300 }}>
                {messageList}
                {isLoading && (
                    <div className="flex gap-2 justify-start">
                        <div
                            className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                            style={{ width: 20, height: 20, background: 'rgba(59,130,246,0.12)', border: '0.5px solid rgba(59,130,246,0.3)' }}
                        >
                            <div className="w-2.5 h-2.5 rounded-full animate-spin border-2 border-transparent" style={{ borderTopColor: 'rgba(59,130,246,0.9)', borderRightColor: 'rgba(59,130,246,0.9)' }} />
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: '14px 14px 14px 4px', fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                            thinking...
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
        </div>
    );
});

const InputBar = React.memo(({ chatOpen, isLoading, onEscape, onSubmit, inputRef }) => (
    <div
        className="buddy-input-bar"
        style={{
            ...glassCard,
            borderRadius: chatOpen ? '0 0 20px 20px' : 20,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transition: 'border-radius 0.3s ease',
            borderTop: '0.5px solid rgba(59,130,246,0.25)'
        }}
    >
        <div className="flex items-center gap-2 shrink-0">
            <BuddyLogo size="xs" pulse={!isLoading} />
            <span style={{ color: 'rgba(96,165,250,0.95)', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em' }}>BUDDY</span>
        </div>

        <div style={{ width: '0.5px', height: 18, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        <CommandInput ref={inputRef} isLoading={isLoading} onEscape={onEscape} onSubmit={onSubmit} />
    </div>
));

const Spotlight = React.memo(() => {
    const [messages, setMessages] = useState(() => getHistory());
    const [isLoading, setIsLoading] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [showSplash, setShowSplash] = useState(true);
    const [mainVisible, setMainVisible] = useState(false);
    const inputRef = useRef(null);
    const chatEndRef = useRef(null);
    const messagesRef = useRef(messages);
    const loadingRef = useRef(isLoading);

    useEffect(() => {
        messagesRef.current = messages;
        setHistory(messages);
    }, [messages]);

    useEffect(() => {
        loadingRef.current = isLoading;
    }, [isLoading]);

    const handleSplashDone = useCallback(() => {
        setShowSplash(false);

        setTimeout(() => {
            setMainVisible(true);
            setTimeout(() => inputRef.current?.focus(), 100);
        }, 80);
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const isAppCommand = useCallback((text) => {
        const lower = text.toLowerCase().trim();

        if (COMMAND_TRIGGERS.some((keyword) => lower.startsWith(keyword))) {
            return true;
        }

        return APP_KEYWORDS.some((app) => lower === app || lower === `open ${app}` || lower.includes(app));
    }, []);

    const handleChatClose = useCallback(() => {
        setChatOpen(false);
        setSidebarVisible(true);
        inputRef.current?.focus();
    }, []);

    const handleEscape = useCallback(() => {
        if (chatOpen) {
            handleChatClose();
            return;
        }

        setSidebarVisible(true);
        inputRef.current?.clear();
    }, [chatOpen, handleChatClose]);

    const handleSubmit = useCallback(async (rawText) => {
        const text = rawText.trim();

        if (!text || loadingRef.current) {
            return false;
        }

        setChatOpen(true);
        setSidebarVisible(false);
        inputRef.current?.clear();

        if (isAppCommand(text)) {
            window.electronAPI?.sendBuddyCommand(text);
            setMessages((prev) => {
                const nextMessages = [
                    ...prev,
                    { role: 'user', text },
                    { role: 'buddy', text: `Done! Running: "${text}"` }
                ];

                addMessages(nextMessages.slice(prev.length));
                return nextMessages;
            });
            return true;
        }

        const currentMessages = messagesRef.current;
        const userMessage = { role: 'user', text };
        const updatedMessages = [...currentMessages, userMessage];

        setMessages(updatedMessages);
        addMessage(userMessage);
        setIsLoading(true);

        try {
            const history = updatedMessages
                .slice(0, -1)
                .map((message) => ({
                    role: message.role === 'user' ? 'user' : 'model',
                    parts: [{ text: message.text }]
                }))
                .filter((message) => message.parts[0].text);

            const response = await window.buddyAPI.askBuddy(text, history);
            const buddyMessage = { role: 'buddy', text: response };
            setMessages((prev) => [...prev, buddyMessage]);
            addMessage(buddyMessage);
        } catch {
            const fallbackMessage = { role: 'buddy', text: 'AI unavailable. Check your Gemini API key in .env' };
            setMessages((prev) => [...prev, fallbackMessage]);
            addMessage(fallbackMessage);
        } finally {
            setIsLoading(false);
        }

        return true;
    }, [isAppCommand]);

    const spotlightStyle = useMemo(() => ({
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        opacity: mainVisible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: mainVisible ? 'auto' : 'none'
    }), [mainVisible]);

    return (
        <>
            <style>{`
                @keyframes borderPulse {
                    0%, 100% { 
                        box-shadow: 0 32px 80px rgba(0,0,0,0.65), 
                                    inset 0 1px 0 rgba(255,255,255,0.06), 
                                    0 0 0 0.5px rgba(59,130,246,0.2), 
                                    0 0 20px rgba(59,130,246,0.06);
                    }
                    50% { 
                        box-shadow: 0 32px 80px rgba(0,0,0,0.65), 
                                    inset 0 1px 0 rgba(255,255,255,0.06), 
                                    0 0 0 0.5px rgba(99,102,241,0.5), 
                                    0 0 30px rgba(99,102,241,0.12);
                    }
                }
                .buddy-input-bar {
                    animation: borderPulse 3s ease-in-out infinite;
                }
                @keyframes glowPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.7; }
                }
                .buddy-glow {
                    animation: glowPulse 3s ease-in-out infinite;
                }
            `}</style>
            {showSplash && <WelcomeSplash onDone={handleSplashDone} />}
            <Sidebar visible={sidebarVisible && mainVisible} />

            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4" style={spotlightStyle}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column' }}>
                    <div className="buddy-glow" style={{
                        position: 'absolute',
                        inset: -2,
                        borderRadius: 24,
                        pointerEvents: 'none',
                        zIndex: -1,
                        boxShadow: '0 0 80px rgba(59,130,246,0.12), 0 0 160px rgba(99,102,241,0.06)',
                        background: 'transparent'
                    }} />
                    <div className="w-full flex flex-col">
                        <ChatHeader />
                        <ChatPanel chatEndRef={chatEndRef} chatOpen={chatOpen} isLoading={isLoading} messages={messages} onClose={handleChatClose} />
                        <InputBar chatOpen={chatOpen} inputRef={inputRef} isLoading={isLoading} onEscape={handleEscape} onSubmit={handleSubmit} />

                        <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, letterSpacing: '0.02em' }}>
                            Press <kbd style={{ fontFamily: 'monospace' }}>Esc</kbd> to close chat | <kbd style={{ fontFamily: 'monospace' }}>Ctrl+Alt+B</kbd> to toggle
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
});

export default Spotlight;
