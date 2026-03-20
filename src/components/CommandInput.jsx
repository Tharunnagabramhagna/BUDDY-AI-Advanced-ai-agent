import { Mic, Send } from 'lucide-react';
import React, { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react';

const CommandInput = memo(forwardRef(function CommandInput({ isLoading, onEscape, onSubmit }, ref) {
    const [command, setCommand] = useState('');
    const innerInputRef = useRef(null);

    const handleChange = useCallback((event) => {
        setCommand(event.target.value);
    }, []);

    const handleSubmit = useCallback(async () => {
        const submitted = await onSubmit(command);

        if (submitted) {
            setCommand('');
        }
    }, [command, onSubmit]);

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void handleSubmit();
            return;
        }

        if (event.key === 'Escape') {
            onEscape();
        }
    }, [handleSubmit, onEscape]);

    const handleButtonClick = useCallback(() => {
        void handleSubmit();
    }, [handleSubmit]);

    useImperativeHandle(ref, () => ({
        clear() {
            setCommand('');
        },
        focus() {
            innerInputRef.current?.focus();
        },
        setCommand(cmd) {
            setCommand(cmd);
        }
    }), []);

    const hasCommand = command.trim().length > 0;

    return (
        <>
            <div className="flex-1 relative">
                <input
                    ref={innerInputRef}
                    type="text"
                    value={command}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Buddy anything..."
                    style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        caretColor: 'rgba(59,130,246,1)',
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: 16,
                        fontWeight: 400,
                        letterSpacing: '-0.015em'
                    }}
                />
            </div>

            <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                    position: 'absolute', inset: -4, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
                    opacity: command.trim() ? 1 : 0, transition: 'opacity 0.3s ease'
                }} />
                <button
                    onClick={hasCommand ? handleButtonClick : undefined}
                    disabled={isLoading}
                    style={{ color: hasCommand ? 'rgba(59,130,246,0.95)' : 'rgba(255,255,255,0.2)', transition: 'color 0.2s ease', position: 'relative', zIndex: 1 }}
                >
                    {hasCommand ? <Send size={16} strokeWidth={1.5} /> : <Mic size={16} strokeWidth={1.5} />}
                </button>
            </div>
        </>
    );
}));

export default CommandInput;
