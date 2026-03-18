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

    useImperativeHandle(ref, () => ({
        clear() {
            setCommand('');
        },
        focus() {
            innerInputRef.current?.focus();
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
                        fontSize: 15,
                        fontWeight: 400,
                        letterSpacing: '-0.01em'
                    }}
                />
            </div>

            <button
                onClick={hasCommand ? () => void handleSubmit() : undefined}
                disabled={isLoading}
                style={{ color: hasCommand ? 'rgba(59,130,246,0.95)' : 'rgba(255,255,255,0.2)', transition: 'color 0.2s ease', flexShrink: 0 }}
            >
                {hasCommand ? <Send size={16} strokeWidth={1.5} /> : <Mic size={16} strokeWidth={1.5} />}
            </button>
        </>
    );
}));

export default CommandInput;
