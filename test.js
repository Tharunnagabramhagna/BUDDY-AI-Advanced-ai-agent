const APP_KEYWORDS = [
    'chrome', 'vscode', 'vs code', 'visual studio code', 'code',
    'notepad', 'calculator', 'calc', 'paint', 'edge', 'spotify',
    'explorer', 'file explorer', 'terminal', 'cmd', 'powershell',
    'word', 'excel', 'powerpoint', 'outlook', 'teams', 'discord',
    'steam', 'vlc', 'zoom', 'slack', 'notion', 'obsidian', 'brave',
    'firefox', 'opera', 'photoshop', 'premiere', 'illustrator'
];

const COMMAND_TRIGGERS = ['open ', 'launch ', 'start ', 'run ', 'search google for ', 'search youtube for '];

const isAppCommand = (text) => {
    const lower = text.toLowerCase().trim();
    if (COMMAND_TRIGGERS.some((keyword) => lower.startsWith(keyword))) {
        return true;
    }
    return APP_KEYWORDS.some((app) => lower === app || lower === `open ${app}` || lower.includes(app));
};

const evaluateMath = (text) => {
    const lower = text.toLowerCase().trim();
    
    // Trig functions
    const trigMap = {
        'sin': (x) => Math.sin(x * Math.PI / 180),
        'cos': (x) => Math.cos(x * Math.PI / 180),
        'tan': (x) => Math.tan(x * Math.PI / 180),
        'sqrt': (x) => Math.sqrt(x),
        'log': (x) => Math.log10(x),
        'ln': (x) => Math.log(x),
    };

    // Check for trig/math function patterns like "sin 30", "cos(45)", "sqrt 16"
    for (const [fn, calc] of Object.entries(trigMap)) {
        const trigRegex = new RegExp(`^${fn}\\s*\\(?([\\d.]+)\\)?$`);
        const match = lower.match(trigRegex);
        if (match) {
            const val = parseFloat(match[1]);
            const result = calc(val);
            return `${fn}(${val}) = ${parseFloat(result.toFixed(6))} 🧮`;
        }
    }

    // Check for percentage: "20% of 500", "15 percent of 200"
    const percentMatch = lower.match(/^([\d.]+)\s*(%|percent)\s*of\s*([\d.]+)$/);
    if (percentMatch) {
        const result = (parseFloat(percentMatch[1]) / 100) * parseFloat(percentMatch[3]);
        return `${percentMatch[1]}% of ${percentMatch[3]} = ${parseFloat(result.toFixed(4))} 🧮`;
    }

    // Check for power: "2 power 10", "2^10", "2**10"
    const powerMatch = lower.match(/^([\d.]+)\s*(power|\\^|\\*\\*)\s*([\d.]+)$/);
    if (powerMatch) {
        const result = Math.pow(parseFloat(powerMatch[1]), parseFloat(powerMatch[3]));
        return `${powerMatch[1]} ^ ${powerMatch[3]} = ${result} 🧮`;
    }

    // Detect basic arithmetic expressions like "2 + 2", "100 / 5", "3 * 4", "10 - 3"
    // Also handle: "what is 2 + 2", "calculate 5 * 6", "solve 10 / 2"
    let expr = lower
        .replace(/^(what is|calculate|calc|solve|evaluate|compute)\s+/i, '')
        .replace(/x/g, '*')
        .replace(/divided by/g, '/')
        .replace(/multiplied by/g, '*')
        .replace(/times/g, '*')
        .replace(/plus/g, '+')
        .replace(/minus/g, '-')
        .trim();

    // Only evaluate if it looks like a math expression
    if (/^[\d\s\+\-\*\/\.\(\)\%]+$/.test(expr)) {
        try {
            // eslint-disable-next-line no-eval
            const result = Function('"use strict"; return (' + expr + ')')();
            if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                return `${expr} = ${parseFloat(result.toFixed(6))} 🧮`;
            }
        } catch (e) {
            console.log("Error in Function:", e);
            return null;
        }
    }

    return null;
};

console.log("isApp('2 + 2'):", isAppCommand("2 + 2"));
console.log("evalMath('2 + 2'):", evaluateMath("2 + 2"));
console.log("evalMath('what is 10 * 5'):", evaluateMath("what is 10 * 5"));
