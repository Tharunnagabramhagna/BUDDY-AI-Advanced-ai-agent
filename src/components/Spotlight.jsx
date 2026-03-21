import { Sparkles, ChevronDown } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import CommandInput from './CommandInput';
import { addMessage, addMessages, getHistory, setHistory } from '../store/chatStore';

const APP_KEYWORDS = [
    'chrome', 'vscode', 'vs code', 'visual studio code', 'code',
    'notepad', 'paint', 'edge', 'spotify',
    'explorer', 'file explorer', 'terminal', 'cmd', 'powershell',
    'word', 'excel', 'powerpoint', 'outlook', 'teams', 'discord',
    'steam', 'vlc', 'zoom', 'slack', 'notion', 'obsidian', 'brave',
    'firefox', 'opera', 'photoshop', 'premiere', 'illustrator'
];

const COMMAND_TRIGGERS = ['open ', 'launch ', 'start ', 'run ', 'search google for ', 'search youtube for '];
const SIDEBAR_SUGGESTIONS = ['Ask me anything', 'Open Chrome', 'Search YouTube', 'Search Google'];

const LOCAL_RESPONSES = {
    greetings: {
        triggers: ['hi', 'hello', 'hey', 'hiya', 'howdy', 'sup', 'what\'s up', 'whats up', 'yo'],
        responses: [
            "Hey there! 👋 What can I help you with?",
            "Hello! Great to see you. What's on your mind?",
            "Hey! I'm here and ready. What do you need?",
            "Hi! Ask me anything or tell me to open an app 😊",
            "Hey! What's good? How can I help? 😄",
            "Yo! Ready when you are. What do you need?",
            "Hello there! What are we working on today?",
        ]
    },
    farewells: {
        triggers: ['see you', 'see ya', 'later', 'good night', 'goodnight', 'cya', 'take care', 'farewell'],
        responses: [
            "Goodbye! Press Ctrl+Alt+B whenever you need me 👋",
            "See you later! I'll be right here when you need me.",
            "Take care! Come back anytime 😊",
            "Bye! Just press Ctrl+Alt+B to wake me up again.",
            "Later! You know where to find me 🚀",
            "Peace out! Ctrl+Alt+B brings me back anytime.",
            "Catch you on the flip side! 👋",
        ]
    },
    thanks: {
        triggers: ['thank you', 'thanks', 'thx', 'ty', 'thank u', 'many thanks', 'appreciate it', 'appreciated'],
        responses: [
            "You're welcome! Anything else I can help with? 😊",
            "Happy to help! What's next?",
            "Anytime! That's what I'm here for.",
            "Glad I could help! Let me know if you need anything else.",
            "No problem at all! Need anything else?",
            "Always happy to help! What's next?",
            "That's what I'm here for! 🚀",
        ]
    },
    howAreYou: {
        triggers: ['how are you', 'how r you', 'how are u', 'you ok', 'you good', 'hows it going', 'how\'s it going', 'how do you do'],
        responses: [
            "I'm doing great, thanks for asking! 🚀 How about you?",
            "Running at full power and ready to help! What do you need?",
            "Always good when there's someone to help! What's up?",
            "Fantastic! Better now that you're here. What can I do for you?",
            "Never been better! What can I do for you?",
            "All systems go! What do you need?",
        ]
    },
    compliments: {
        triggers: ['you\'re great', 'your great', 'you are great', 'good job', 'well done', 'amazing', 'awesome', 'you\'re awesome', 'you\'re the best', 'love you', 'great job', 'nice work', 'you\'re smart', 'you\'re cool'],
        responses: [
            "Aww, thank you! That means a lot 😊 What else can I do for you?",
            "You're making me blush! 😄 How can I help?",
            "Thanks! I try my best. What do you need next?",
            "That's so kind! I'm here to serve 🚀",
            "You're too kind! 😄 What can I do for you?",
            "Appreciate it! Now, how can I help?",
        ]
    },
    whoAreYou: {
        triggers: ['who are you', 'what are you', 'what can you do', 'what do you do', 'tell me about yourself', 'introduce yourself', 'your name', 'what is buddy', 'what\'s buddy'],
        responses: [
            "I'm Buddy — your personal desktop AI assistant! 🤖\n\nI can:\n• Answer your questions\n• Open apps (Chrome, VS Code, etc.)\n• Search Google & YouTube\n• Have a conversation\n\nWhat would you like to do?",
            "Hey, I'm Buddy! ✨ Think of me as your always-on desktop assistant.\n\nJust tell me what you need — open apps, search the web, or just chat!",
            "I'm Buddy! 🤖 Your personal desktop sidekick.\n\nTell me to open apps, search the web, or just chat — I'm here for all of it!",
        ]
    },
    ok: {
        triggers: ['ok', 'okay', 'ok buddy', 'ok', 'got it', 'alright', 'sure', 'cool'],
        responses: [
            "👍 Let me know if you need anything!",
            "Sounds good! I'm here if you need me.",
            "Perfect! What's next?",
            "Roger that! Anything else?",
        ]
    },
    good: {
        triggers: ['good', 'good morning', 'good evening', 'good afternoon', 'morning', 'evening'],
        responses: [
            "Good morning! Ready to have a productive day? ☀️",
            "Hey! Hope your day is going great 😊",
            "Good to see you! What are we doing today?",
            "Hey! Always a good time when you're here 🚀",
        ]
    },
    testing: {
        triggers: ['test', 'testing', 'are you there', 'you there', 'hello?', 'anyone there', 'ping'],
        responses: [
            "Yep, I'm here! 👋 Loud and clear.",
            "Online and ready! What do you need?",
            "Present! What's up?",
            "Right here! Fire away 🚀",
        ]
    },
    laugh: {
        triggers: ['haha', 'hehe', 'lol', 'lmao', '😂', 'funny', 'hilarious', 'ha'],
        responses: [
            "Haha glad I could make you laugh 😄",
            "😄 Always here for a good time!",
            "Lol! What else can I do for you?",
            "Ha! That's what I'm here for 😄",
        ]
    },
    currentTime: {
        triggers: ["what's the time", "what is the time", "current time", "time now", "what time is it", "tell me the time", "the time"],
        responses: ['DYNAMIC_TIME']
    },
    currentDate: {
        triggers: ["what's today's date", "what is today's date", "today's date", "current date", "what date is it", "today date", "what day is today", "what's the date"],
        responses: ['DYNAMIC_DATE']
    },
    currentDay: {
        triggers: ["what day is it", "which day is today", "what's today", "today is", "what day today"],
        responses: ['DYNAMIC_DAY']
    },
    calendarFacts: {
        triggers: ["days in a week", "how many days in a week", "days in week", "how many days a week"],
        responses: ["There are 7 days in a week 📅\nMonday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday."]
    },
    monthsInYear: {
        triggers: ["how many months", "months in a year", "how many months in a year"],
        responses: ["There are 12 months in a year 📅\nJan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec."]
    },
    daysInYear: {
        triggers: ["how many days in a year", "days in a year"],
        responses: ["A regular year has 365 days 📅 A leap year has 366 days. Leap years happen every 4 years!"]
    },
    weeksInYear: {
        triggers: ["how many weeks in a year", "weeks in a year"],
        responses: ["There are 52 weeks in a year (plus 1 or 2 extra days) 📅"]
    },
    leapYear: {
        triggers: ["what is a leap year", "leap year", "when is leap year", "next leap year"],
        responses: ["A leap year has 366 days instead of 365 🗓️ It happens every 4 years. The next leap year is 2028!"]
    },
    worldCapital: {
        triggers: ["capital of india", "india capital"],
        responses: ["The capital of India is New Delhi 🇮🇳"]
    },
    usCapital: {
        triggers: ["capital of usa", "capital of america", "usa capital", "us capital", "capital of united states"],
        responses: ["The capital of the USA is Washington, D.C. 🇺🇸"]
    },
    ukCapital: {
        triggers: ["capital of uk", "capital of england", "uk capital", "capital of britain"],
        responses: ["The capital of the UK is London 🇬🇧"]
    },
    worldLargestCountry: {
        triggers: ["largest country", "biggest country", "largest country in the world"],
        responses: ["Russia is the largest country in the world 🌍 It covers about 17.1 million square kilometers!"]
    },
    worldSmallestCountry: {
        triggers: ["smallest country", "smallest country in the world"],
        responses: ["Vatican City is the smallest country in the world 🌍 It's only about 0.44 square kilometers!"]
    },
    worldPopulation: {
        triggers: ["world population", "how many people in the world", "population of the world", "world's population"],
        responses: ["The world population is approximately 8.1 billion people 🌍 and growing every second!"]
    },
    indiaPopulation: {
        triggers: ["population of india", "india population", "how many people in india"],
        responses: ["India's population is approximately 1.44 billion people 🇮🇳 making it the most populous country in the world!"]
    },
    continents: {
        triggers: ["how many continents", "list of continents", "continents in the world", "name the continents"],
        responses: ["There are 7 continents 🌍\n1. Asia\n2. Africa\n3. North America\n4. South America\n5. Antarctica\n6. Europe\n7. Australia (Oceania)"]
    },
    oceans: {
        triggers: ["how many oceans", "list of oceans", "name the oceans", "oceans in the world"],
        responses: ["There are 5 oceans 🌊\n1. Pacific Ocean (largest)\n2. Atlantic Ocean\n3. Indian Ocean\n4. Southern Ocean\n5. Arctic Ocean"]
    },
    ww2: {
        triggers: ["when was world war 2", "when did world war 2 start", "world war 2", "ww2", "second world war"],
        responses: ["World War 2 started on September 1, 1939 and ended on September 2, 1945 ⚔️\nIt involved most of the world's nations and was the deadliest conflict in human history."]
    },
    ww1: {
        triggers: ["when was world war 1", "world war 1", "ww1", "first world war"],
        responses: ["World War 1 started on July 28, 1914 and ended on November 11, 1918 ⚔️\nIt was one of the deadliest conflicts in history involving major world powers."]
    },
    moonLanding: {
        triggers: ["moon landing", "first moon landing", "when did humans land on moon", "neil armstrong moon"],
        responses: ["The first Moon landing was on July 20, 1969 🌕\nNeil Armstrong became the first human to walk on the Moon during NASA's Apollo 11 mission."]
    },
    independenceIndia: {
        triggers: ["india independence", "when did india get independence", "india independence day", "indian independence"],
        responses: ["India gained independence on August 15, 1947 🇮🇳\nIt marks the end of British rule and is celebrated every year as Independence Day!"]
    },
    internetInvention: {
        triggers: ["when was internet invented", "who invented internet", "history of internet", "internet invention"],
        responses: ["The Internet was invented in 1969 as ARPANET 🌐\nTim Berners-Lee created the World Wide Web in 1989, making it accessible to everyone!"]
    },
    firstComputer: {
        triggers: ["first computer", "who invented computer", "when was computer invented", "history of computer"],
        responses: ["The first electronic computer, ENIAC, was built in 1945 💻\nCharles Babbage is considered the 'father of the computer' for his mechanical designs in the 1800s."]
    },
    speedOfLight: {
        triggers: ["speed of light", "how fast is light", "light speed"],
        responses: ["The speed of light is approximately 299,792,458 meters per second ⚡\nThat's about 186,282 miles per second — fast enough to circle Earth 7.5 times in one second!"]
    },
    planetsInSolarSystem: {
        triggers: ["how many planets", "planets in solar system", "list of planets", "name the planets"],
        responses: ["There are 8 planets in our solar system 🪐\n1. Mercury\n2. Venus\n3. Earth\n4. Mars\n5. Jupiter\n6. Saturn\n7. Uranus\n8. Neptune"]
    },
    sunDistance: {
        triggers: ["distance from earth to sun", "how far is the sun", "earth to sun distance", "sun distance"],
        responses: ["The average distance from Earth to the Sun is about 150 million kilometers (93 million miles) ☀️\nLight from the Sun takes about 8 minutes to reach Earth!"]
    },

    // Political Leaders
    pmIndia: {
        triggers: ["who is the pm of india", "prime minister of india", "india pm", "pm of india", "who is india's prime minister", "current pm of india"],
        responses: ["The Prime Minister of India is Narendra Modi 🇮🇳\nHe has been serving as PM since May 2014 and leads the BJP party."]
    },
    presidentIndia: {
        triggers: ["president of india", "who is the president of india", "india president", "current president of india"],
        responses: ["The President of India is Droupadi Murmu 🇮🇳\nShe became the 15th President of India on July 25, 2022."]
    },
    presidentUSA: {
        triggers: ["president of usa", "us president", "president of america", "who is the president", "current us president", "president of united states"],
        responses: ["The President of the United States is Donald Trump 🇺🇸\nHe is serving his second term as the 47th President of the United States."]
    },
    pmUK: {
        triggers: ["prime minister of uk", "uk pm", "pm of uk", "who is uk prime minister", "british prime minister"],
        responses: ["The Prime Minister of the United Kingdom is Keir Starmer 🇬🇧\nHe became PM in July 2024 as leader of the Labour Party."]
    },
    presidentRussia: {
        triggers: ["president of russia", "russia president", "who is putin", "russian president"],
        responses: ["The President of Russia is Vladimir Putin 🇷🇺\nHe has been the dominant political figure in Russia since 2000."]
    },
    presidentChina: {
        triggers: ["president of china", "china president", "who leads china", "chinese president"],
        responses: ["The President of China is Xi Jinping 🇨🇳\nHe has been General Secretary of the Communist Party since 2012."]
    },
    pmAustralia: {
        triggers: ["prime minister of australia", "australia pm", "pm of australia"],
        responses: ["The Prime Minister of Australia is Anthony Albanese 🇦🇺\nHe became PM in May 2022 leading the Australian Labor Party."]
    },
    pmCanada: {
        triggers: ["prime minister of canada", "canada pm", "pm of canada"],
        responses: ["The Prime Minister of Canada is Mark Carney 🇨🇦\nHe became PM in March 2025."]
    },

    // Political Parties
    bjp: {
        triggers: ["what is bjp", "bjp party", "about bjp"],
        responses: ["BJP (Bharatiya Janata Party) is India's ruling political party 🇮🇳\nFounded in 1980, it follows Hindu nationalist ideology and is currently led by PM Narendra Modi."]
    },
    congress: {
        triggers: ["what is congress", "congress party india", "inc party", "indian national congress"],
        responses: ["The Indian National Congress (INC) is one of India's oldest political parties 🇮🇳\nFounded in 1885, it led India's independence movement. Currently led by Mallikarjun Kharge."]
    },

    // Fruits
    appleFruit: {
        triggers: ["what is apple", "apple fruit", "benefits of apple", "apple benefits", "is apple healthy"],
        responses: ["🍎 Apple is one of the most popular fruits!\n\nBenefits:\n• Rich in fiber and Vitamin C\n• Supports heart health\n• Helps with digestion\n• Low in calories\n\n'An apple a day keeps the doctor away!' 😄"]
    },
    banana: {
        triggers: ["what is banana", "banana fruit", "benefits of banana", "banana benefits", "is banana healthy"],
        responses: ["🍌 Banana is a tropical fruit loved worldwide!\n\nBenefits:\n• Rich in potassium\n• Great energy source\n• Supports heart and digestive health\n• Natural mood booster (contains serotonin)"]
    },
    mango: {
        triggers: ["what is mango", "mango fruit", "benefits of mango", "mango benefits", "is mango healthy"],
        responses: ["🥭 Mango is the King of Fruits!\n\nBenefits:\n• Rich in Vitamin A and C\n• Boosts immunity\n• Good for skin and hair\n• High in antioxidants\n\nIndia is the world's largest producer of mangoes! 🇮🇳"]
    },
    orange: {
        triggers: ["what is orange", "orange fruit", "benefits of orange", "orange benefits"],
        responses: ["🍊 Orange is a citrus fruit packed with nutrients!\n\nBenefits:\n• Very high in Vitamin C\n• Boosts immunity\n• Good for skin health\n• Helps lower cholesterol"]
    },
    grapes: {
        triggers: ["what is grapes", "grapes fruit", "benefits of grapes", "grapes benefits"],
        responses: ["🍇 Grapes are small but mighty!\n\nBenefits:\n• Rich in antioxidants\n• Supports heart health\n• Contains resveratrol (anti-aging)\n• Good for eyes and brain health"]
    },
    strawberry: {
        triggers: ["what is strawberry", "strawberry fruit", "benefits of strawberry"],
        responses: ["🍓 Strawberry is a delicious and nutritious fruit!\n\nBenefits:\n• High in Vitamin C\n• Rich in antioxidants\n• Supports heart health\n• Low in calories, great for weight management"]
    },
    watermelon: {
        triggers: ["what is watermelon", "watermelon fruit", "benefits of watermelon"],
        responses: ["🍉 Watermelon is the perfect summer fruit!\n\nBenefits:\n• 92% water — great for hydration\n• Rich in Vitamin A and C\n• Contains lycopene (antioxidant)\n• Natural electrolytes"]
    },

    // Vegetables
    tomato: {
        triggers: ["what is tomato", "tomato vegetable", "benefits of tomato", "tomato benefits", "is tomato a fruit or vegetable"],
        responses: ["🍅 Tomato — technically a fruit but used as a vegetable!\n\nBenefits:\n• Rich in lycopene (powerful antioxidant)\n• High in Vitamin C and K\n• Supports heart health\n• Good for skin"]
    },
    potato: {
        triggers: ["what is potato", "potato vegetable", "benefits of potato", "potato benefits"],
        responses: ["🥔 Potato is one of the world's most important food crops!\n\nBenefits:\n• Good source of Vitamin B6 and C\n• High in potassium\n• Rich in fiber\n• Great energy source"]
    },
    carrot: {
        triggers: ["what is carrot", "carrot vegetable", "benefits of carrot", "carrot benefits"],
        responses: ["🥕 Carrot is a root vegetable packed with nutrients!\n\nBenefits:\n• Very high in beta-carotene (Vitamin A)\n• Excellent for eyesight\n• Boosts immunity\n• Good for skin and teeth"]
    },
    spinach: {
        triggers: ["what is spinach", "spinach vegetable", "benefits of spinach", "spinach benefits"],
        responses: ["🥬 Spinach is a superfood green vegetable!\n\nBenefits:\n• Very high in iron\n• Rich in Vitamin K, A, and C\n• Supports bone health\n• Great for muscle strength (just like Popeye! 💪)"]
    },
    onion: {
        triggers: ["what is onion", "onion vegetable", "benefits of onion", "onion benefits"],
        responses: ["🧅 Onion is one of the most used vegetables in cooking!\n\nBenefits:\n• Rich in antioxidants\n• Anti-inflammatory properties\n• Supports heart health\n• Boosts immunity"]
    },
    garlic: {
        triggers: ["what is garlic", "garlic vegetable", "benefits of garlic", "garlic benefits"],
        responses: ["🧄 Garlic is a powerful medicinal food!\n\nBenefits:\n• Boosts immunity strongly\n• Reduces blood pressure\n• Antibacterial and antiviral\n• Rich in Vitamin C and B6\n\nUsed in medicine for thousands of years!"]
    },
    broccoli: {
        triggers: ["what is broccoli", "broccoli vegetable", "benefits of broccoli", "broccoli benefits"],
        responses: ["🥦 Broccoli is one of the healthiest vegetables!\n\nBenefits:\n• Very high in Vitamin C and K\n• Rich in fiber\n• Contains cancer-fighting compounds\n• Great for bone and heart health"]
    },

    // General food facts
    healthiestFruit: {
        triggers: ["healthiest fruit", "most healthy fruit", "best fruit to eat", "which fruit is healthiest"],
        responses: ["Top 5 healthiest fruits 🏆\n1. 🫐 Blueberries — highest in antioxidants\n2. 🍎 Apple — great for digestion\n3. 🍌 Banana — best energy source\n4. 🥭 Mango — richest in vitamins\n5. 🍊 Orange — highest in Vitamin C"]
    },
    healthiestVegetable: {
        triggers: ["healthiest vegetable", "most healthy vegetable", "best vegetable to eat", "which vegetable is healthiest"],
        responses: ["Top 5 healthiest vegetables 🏆\n1. 🥬 Spinach — highest in iron\n2. 🥦 Broccoli — cancer fighting\n3. 🥕 Carrot — best for eyesight\n4. 🧄 Garlic — strongest immunity booster\n5. 🍅 Tomato — rich in lycopene"]
    },
    calculatorHelp: {
        triggers: ["calculator", "can you calculate", "do math", "solve math", "math help", "calculate something"],
        responses: ["Sure! I can do math for you 🧮\n\nTry:\n• Basic: 2 + 2, 100 / 5, 3 * 4\n• Powers: 2 ^ 10\n• Percentage: 20% of 500\n• Trig: sin 30, cos 45, tan 60\n• Roots: sqrt 144\n• Logs: log 100, ln 10\n\nJust type the expression!"]
    }
};

const extractAddress = (text) => {
    const lower = text.toLowerCase().trim();
    const addressWords = ['bro', 'macha', 'da', 'man', 'dude', 'buddy', 'mate', 'bud', 'homie', 'boss', 'chief', 'bhai', 'yaar', 'anna'];
    for (const word of addressWords) {
        // Must be a whole word — surrounded by spaces, punctuation, or at start/end
        const regex = new RegExp(`(^|\\s|,)${word}(\\s|,|!|\\?|$)`, 'i');
        if (regex.test(lower)) return word;
    }
    return null;
};

const injectAddress = (response, address) => {
    if (!address) return response;
    
    // Don't add address if response already contains it
    if (response.toLowerCase().includes(address.toLowerCase())) return response;
    
    // Add address naturally — at the end of the first sentence
    if (response.includes('!')) {
        // Replace first exclamation mark with ", {address}!"
        return response.replace('!', `, ${address}!`);
    }
    if (response.includes('?')) {
        return response.replace('?', `, ${address}?`);
    }
    // Add at end of first line
    const lines = response.split('\n');
    lines[0] = lines[0] + `, ${address}`;
    return lines.join('\n');
};

const getLocalResponse = (text, lastUsedResponsesRef) => {
    const lower = text.toLowerCase().trim();
    const address = extractAddress(lower);

    // Dynamic time and date responses
    const timeNow = new Date();
    const timeStr = timeNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = timeNow.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dayStr = timeNow.toLocaleDateString([], { weekday: 'long' });

    const dynamicMap = {
        currentTime: `The current time is ${timeStr} 🕐`,
        currentDate: `Today is ${dateStr} 📅`,
        currentDay: `Today is ${dayStr} 📅`,
    };

    for (const [key, category] of Object.entries(LOCAL_RESPONSES)) {
        const matched = category.triggers.some(t => {
            const tLower = t.toLowerCase();
            // Exact match
            if (lower === tLower || lower === tLower + '?' || lower === tLower + '!') return true;
            // Starts or ends with trigger as whole phrase
            if (lower.startsWith(tLower + ' ') || lower.startsWith(tLower + '?')) return true;
            if (lower.endsWith(' ' + tLower) || lower.endsWith(' ' + tLower + '?')) return true;
            // Contains trigger as whole word/phrase using word boundary
            const escaped = tLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(^|\\s)${escaped}(\\s|\\?|!|$)`);
            return regex.test(lower);
        });
        if (matched) {
            if (dynamicMap[key]) return injectAddress(dynamicMap[key], address);
            const responses = category.responses;
            const lastUsed = lastUsedResponsesRef.current[key];
            const available = responses.filter((_, i) => i !== lastUsed);
            const idx = Math.floor(Math.random() * available.length);
            const originalIdx = responses.indexOf(available[idx]);
            lastUsedResponsesRef.current[key] = originalIdx;
            return injectAddress(available[idx], address);
        }
    }
    return null;
};

const safeEval = (expr) => {
    // Tokenize and evaluate safely without eval or Function()
    const tokens = expr.match(/[\d.]+|[+\-*/()]/g);
    if (!tokens) return null;

    let pos = 0;

    const parseNumber = () => {
        const tok = tokens[pos];
        if (tok === undefined) return null;
        const num = parseFloat(tok);
        if (!isNaN(num)) { pos++; return num; }
        if (tok === '(') {
            pos++; // skip (
            const val = parseAddSub();
            pos++; // skip )
            return val;
        }
        return null;
    };

    const parseMulDiv = () => {
        let left = parseNumber();
        while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
            const op = tokens[pos++];
            const right = parseNumber();
            if (op === '*') left *= right;
            else left = left / right;
        }
        return left;
    };

    const parseAddSub = () => {
        let left = parseMulDiv();
        while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
            const op = tokens[pos++];
            const right = parseMulDiv();
            if (op === '+') left += right;
            else left -= right;
        }
        return left;
    };

    try {
        const result = parseAddSub();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            return parseFloat(result.toFixed(6));
        }
    } catch { return null; }
    return null;
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
    const powerMatch = lower.match(/^([\d.]+)\s*(power|\^|\*\*)\s*([\d.]+)$/);
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

    // CSP-safe recursive descent parser — no eval or Function()
    if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
        const result = safeEval(expr);
        if (result !== null) {
            return `${expr} = ${result} 🧮`;
        }
    }

    return null;
};

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
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '1.5px solid rgba(99,102,241,0.4)', animationDuration: '2.4s' }} />
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '1.5px solid rgba(139,92,246,0.25)', animationDuration: '2.4s', animationDelay: '0.9s' }} />
                    <div className="absolute inset-0 rounded-full animate-ping" style={{ border: '1px solid rgba(59,130,246,0.15)', animationDuration: '2.4s', animationDelay: '1.6s' }} />
                </>
            )}
            <div
                className="relative rounded-full flex items-center justify-center"
                style={{
                    width: dim,
                    height: dim,
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(99,102,241,0.25) 50%, rgba(139,92,246,0.2) 100%)',
                    border: '1px solid rgba(139,92,246,0.5)',
                    boxShadow: '0 0 30px rgba(99,102,241,0.3), 0 0 60px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.15)'
                }}
            >
                <Sparkles size={iconSize} style={{ color: 'rgba(167,139,250,1)' }} />
            </div>
        </div>
    );
});

const Sidebar = React.memo(({ visible }) => (
    <div
        className="fixed right-5 top-1/2 -translate-y-1/2 w-[180px]"
        style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', opacity: visible ? 1 : 0, transform: `translateY(-50%) translateX(${visible ? 0 : 24}px)`, pointerEvents: visible ? 'auto' : 'none' }}
    >
        <div
            style={{
                background: 'rgba(12,12,18,0.82)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderTop: '0.5px solid rgba(99,102,241,0.3)',
                borderRadius: 18,
                padding: '16px',
                boxShadow: '0 24px 56px rgba(0,0,0,0.5), inset 0 1px 0 rgba(99,102,241,0.1)'
            }}
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 10px rgba(52,211,153,1)' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>ONLINE</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Hey, I&apos;m Buddy</p>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>Your personal AI assistant - always one shortcut away.</p>
            <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, letterSpacing: '0.06em', marginBottom: 8 }}>TRY SAYING</p>
            {SIDEBAR_SUGGESTIONS.map((text) => (
                <div key={text} className="flex items-center gap-1.5 mb-1.5">
                    <span style={{ color: 'rgba(139,92,246,0.8)', fontSize: 10 }}>{'>'}</span>
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
                background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%), rgba(0,0,0,0.85)',
                backdropFilter: 'blur(60px)',
                WebkitBackdropFilter: 'blur(60px)',
                opacity: phase === 'dissolve' ? 0 : 1,
                transform: phase === 'dissolve' ? 'scale(0.97)' : 'scale(1)'
            }}
        >
            <div
                className="flex flex-col items-center gap-5 transition-all duration-500"
            >
                <div className="buddy-logo-entrance">
                    <BuddyLogo size="lg" pulse />
                </div>
                <div className="text-center" style={{ marginTop: 8 }}>
                    <h1 className="buddy-title-entrance" style={{ color: 'rgba(255,255,255,0.92)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>Buddy</h1>
                    <p className="buddy-subtitle-entrance" style={{ color: 'rgba(255,255,255,0.36)', fontSize: 13, marginTop: 6, fontWeight: 400 }}>Your personal AI assistant</p>
                </div>
                <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full buddy-shortcut-entrance"
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
            padding: '16px 20px 12px',
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

const ChatPanel = React.memo(({ chatOpen, isLoading, isTyping, messages, onClose, chatEndRef }) => {
    const messageList = useMemo(() => messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        return (
            <div key={index} className={`message-enter flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                    <div
                        className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                        style={{ width: 20, height: 20, background: 'rgba(59,130,246,0.12)', border: '0.5px solid rgba(59,130,246,0.3)' }}
                    >
                        <Sparkles size={9} style={{ color: 'rgba(96,165,250,0.9)' }} />
                    </div>
                )}
                <div className="flex flex-col">
                    <div style={{ position: 'relative' }} className="message-bubble-wrapper">
                        <style>{`.message-bubble-wrapper:hover .copy-btn { opacity: 1; }`}</style>
                        <div
                            style={{
                                maxWidth: '78%',
                                padding: '8px 12px',
                                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                fontSize: 13,
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap',
                                background: isUser ? 'linear-gradient(135deg, rgba(59,130,246,0.28) 0%, rgba(99,102,241,0.22) 50%, rgba(139,92,246,0.18) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 100%)',
                                border: isUser ? '0.5px solid rgba(99,102,241,0.45)' : '0.5px solid rgba(255,255,255,0.09)',
                                color: isUser ? 'rgba(220,225,255,0.95)' : 'rgba(255,255,255,0.75)',
                                backdropFilter: 'blur(8px)',
                                boxShadow: isUser ? '0 4px 16px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                            }}
                        >
                            {isUser ? msg.text : (
                                <div style={{ borderLeft: '2px solid rgba(99,102,241,0.4)', paddingLeft: 8 }}>
                                    {msg.text}
                                </div>
                            )}
                        </div>
                        <button
                            className="copy-btn"
                            onClick={() => navigator.clipboard.writeText(msg.text)}
                            style={{
                                position: 'absolute',
                                top: -8,
                                right: msg.role === 'user' ? 0 : 'auto',
                                left: msg.role === 'buddy' ? 0 : 'auto',
                                opacity: 0,
                                transition: 'opacity 0.2s ease',
                                background: 'rgba(30,30,40,0.9)',
                                border: '0.5px solid rgba(255,255,255,0.12)',
                                borderRadius: 6,
                                padding: '2px 7px',
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                backdropFilter: 'blur(8px)'
                            }}>
                            copy
                        </button>
                    </div>
                    {msg.timestamp && (
                        <span style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.18)',
                            marginTop: 3,
                            display: 'block',
                            textAlign: msg.role === 'user' ? 'right' : 'left',
                            paddingLeft: msg.role === 'buddy' ? 4 : 0,
                            paddingRight: msg.role === 'user' ? 4 : 0,
                        }}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </div>
        );
    }), [messages]);

    return (
        <div
            style={{
                ...glassCard,
                borderRadius: chatOpen ? 0 : '0 0 20px 20px',
                overflow: 'hidden',
                maxHeight: chatOpen ? 380 : 0,
                opacity: chatOpen ? 1 : 0,
                transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease, border-radius 0.35s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: chatOpen ? 'translateY(0)' : 'translateY(8px)',
                background: 'linear-gradient(180deg, rgba(12,12,20,0.88) 0%, rgba(16,14,24,0.85) 100%)',
                backdropFilter: 'blur(40px) saturate(160%)',
                WebkitBackdropFilter: 'blur(40px) saturate(160%)',
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

            <div className="overflow-y-auto px-5 pb-4 flex flex-col gap-[12px]" style={{ maxHeight: 300 }}>
                {messageList}
                {(isLoading || isTyping) && (
                    <div className="message-enter" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div className="typing-avatar" style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', border: '0.5px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                            <Sparkles size={9} style={{ color: 'rgba(139,92,246,0.8)' }} className="animate-pulse" />
                        </div>
                        <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.07) 100%)', border: '0.5px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 4px 12px rgba(99,102,241,0.1)' }}>
                            <style>{`
                                @keyframes typingDot {
                                    0%, 60%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
                                    30% { transform: translateY(-5px) scale(1.1); opacity: 1; }
                                }
                                .typing-dot {
                                    width: 6px; height: 6px; border-radius: 50%;
                                    background: linear-gradient(135deg, rgba(96,165,250,1), rgba(139,92,246,1));
                                    animation: typingDot 1.4s ease-in-out infinite;
                                }
                                .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                                .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                            `}</style>
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
        </div>
    );
});

const InputBar = React.memo(({ chatOpen, isLoading, isListening, sttOnline, onEscape, onSubmit, inputRef }) => (
    <div
        className="buddy-input-bar"
        style={{
            ...glassCard,
            borderRadius: chatOpen ? '0 0 20px 20px' : 20,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transition: 'border-radius 0.3s ease',
            background: 'linear-gradient(135deg, rgba(15,15,22,0.85) 0%, rgba(20,18,30,0.82) 100%)',
            backdropFilter: 'blur(40px) saturate(160%)',
            WebkitBackdropFilter: 'blur(40px) saturate(160%)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderTop: '0.5px solid rgba(99,102,241,0.35)',
            boxShadow: '0 -4px 24px rgba(59,130,246,0.06), 0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)'
        }}
    >
        <div className="flex items-center gap-2 shrink-0" style={{ paddingLeft: 2 }}>
            <BuddyLogo size="xs" pulse={!isLoading} />
            <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(96,165,250,1) 0%, rgba(139,92,246,1) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
            }}>BUDDY</span>
        </div>

        <div style={{ width: '0.5px', height: 18, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        <CommandInput ref={inputRef} isLoading={isLoading} isListening={isListening} sttOnline={sttOnline} onEscape={onEscape} onSubmit={onSubmit} />
    </div>
));

const Spotlight = React.memo(() => {
    const [messages, setMessages] = useState(() => getHistory());
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [showSplash, setShowSplash] = useState(true);
    const [mainVisible, setMainVisible] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [sttOnline, setSttOnline] = useState(false);
    const inputRef = useRef(null);
    const lastUsedResponsesRef = useRef({});
    const chatEndRef = useRef(null);
    const messagesRef = useRef(messages);
    const loadingRef = useRef(isLoading);
    const pollRef = useRef(null);

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

    const handleSubmit = useCallback(async (textOverride = null) => {
        const finalText = typeof textOverride === 'string' ? textOverride.trim() : '';
        if (!finalText || loadingRef.current) {
            return false;
        }

        setChatOpen(true);
        setSidebarVisible(false);
        inputRef.current?.clear();

        if (isAppCommand(finalText)) {
            window.electronAPI?.sendBuddyCommand(finalText);
            setMessages((prev) => {
                const nextMessages = [
                    ...prev,
                    { role: 'user', text: finalText, timestamp: Date.now() },
                    { role: 'buddy', text: `Done! Running: "${finalText}"`, timestamp: Date.now() }
                ];

                addMessages(nextMessages.slice(prev.length));
                return nextMessages;
            });
            return true;
        }

        // Check for math expression first
        const mathResult = evaluateMath(finalText);
        if (mathResult) {
            setSidebarVisible(false);
            setChatOpen(true);
            setIsTyping(true);
            setMessages(prev => [...prev, { role: 'user', text: finalText, timestamp: Date.now() }]);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, { role: 'buddy', text: mathResult, timestamp: Date.now() }]);
            }, 300);
            return true;
        }

        // Check for close/exit commands
        const closeKeywords = [
            'close the app', 'close app', 'close buddy', 'exit', 'exit app',
            'quit', 'quit app', 'close the tab', 'close tab', 'shut down',
            'goodbye buddy', 'bye buddy', 'see you buddy', 'close now'
        ];
        const lowerFinalText = finalText.toLowerCase().trim();
        const isCloseCommand = closeKeywords.some(k => lowerFinalText === k || lowerFinalText.includes(k));

        if (isCloseCommand) {
            setMessages(prev => [...prev,
                { role: 'user', text: finalText, timestamp: Date.now() },
                { role: 'buddy', text: "Goodbye! See you next time 👋\nPress Ctrl+Alt+B to bring me back anytime.", timestamp: Date.now() }
            ]);
            setChatOpen(true);
            setSidebarVisible(false);
            setTimeout(() => {
                if (window.electronAPI?.closeApp) {
                    window.electronAPI.closeApp();
                }
            }, 1500);
            return true;
        }

        const localResponse = getLocalResponse(finalText, lastUsedResponsesRef);
        if (localResponse) {
            setSidebarVisible(false);
            setChatOpen(true);
            setMessages(prev => [...prev, { role: 'user', text: finalText, timestamp: Date.now() }]);
            setIsTyping(true);
            setTimeout(() => {
                setIsTyping(false);
                setMessages(prev => [...prev, { role: 'buddy', text: localResponse, timestamp: Date.now() }]);
            }, 600 + Math.random() * 400); 
            return true;
        }

        const currentMessages = messagesRef.current;
        const userMessage = { role: 'user', text: finalText, timestamp: Date.now() };
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

            const response = await window.buddyAPI.askBuddy(finalText, history);
            const buddyMessage = { role: 'buddy', text: response, timestamp: Date.now() };
            setMessages((prev) => [...prev, buddyMessage]);
            addMessage(buddyMessage);
        } catch {
            const fallbackMessage = { role: 'buddy', text: 'AI unavailable. Check your Gemini API key in .env', timestamp: Date.now() };
            setMessages((prev) => [...prev, fallbackMessage]);
            addMessage(fallbackMessage);
        } finally {
            setIsLoading(false);
        }

        return true;
    }, [isAppCommand]);

    // STT polling — always-on background listener
    useEffect(() => {
        // Notify STT that app is open
        window.buddySTT?.notifyOpen?.()

        // Check STT online status
        const checkStatus = async () => {
            try {
                const s = await window.buddySTT.getStatus()
                setSttOnline(s.status === 'online')
            } catch { setSttOnline(false) }
        }
        checkStatus()

        // Poll every 600ms
        pollRef.current = setInterval(async () => {
            try {
                const result = await window.buddySTT.getResult()

                // Wake word detected — open app (already open) and show ready state
                if (result.wake && result.status === 'wake') {
                    setIsListening(true)
                    setChatOpen(true)
                    setSidebarVisible(false)
                    setMessages(prev => {
                        // Only add wake message if last message wasn't already wake
                        const last = prev[prev.length - 1]
                        if (last?.text === "I'm listening... 🎤") return prev
                        return [...prev, {
                            role: 'buddy',
                            text: "I'm listening... 🎤",
                            timestamp: Date.now()
                        }]
                    })
                    return
                }

                if (result.status === 'success' && result.text && result.text.trim()) {
                    setIsListening(false)
                    const spokenText = result.text.trim()
                    if (inputRef.current) {
                        inputRef.current.setCommand(spokenText)
                    }
                    setTimeout(() => handleSubmit(spokenText), 100)
                } else if (result.status === 'processing') {
                    setIsListening(true)
                } else if (result.status === 'idle') {
                    setIsListening(false)
                }
            } catch { /* STT not available */ }
        }, 600)

        return () => {
            window.buddySTT?.notifyClose?.()
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [handleSubmit])

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
                @keyframes bgShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes floatOrb1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -20px) scale(1.05); }
                    66% { transform: translate(-20px, 15px) scale(0.97); }
                }
                @keyframes floatOrb2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-25px, 20px) scale(1.03); }
                    66% { transform: translate(20px, -15px) scale(0.98); }
                }
                .orb1 { animation: floatOrb1 8s ease-in-out infinite; }
                .orb2 { animation: floatOrb2 10s ease-in-out infinite; }
                @keyframes avatarPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
                    50% { box-shadow: 0 0 0 4px rgba(99,102,241,0); }
                }
                .typing-avatar {
                    animation: avatarPulse 1.4s ease-in-out infinite;
                }
                @keyframes messageIn {
                    0% { opacity: 0; transform: translateY(8px) scale(0.97); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .message-enter {
                    animation: messageIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes logoEntrance {
                    0% { opacity: 0; transform: scale(0.6) translateY(20px); }
                    70% { opacity: 1; transform: scale(1.06) translateY(-4px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .buddy-logo-entrance {
                    animation: logoEntrance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes titleEntrance {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .buddy-title-entrance {
                    animation: titleEntrance 0.5s ease forwards;
                    animation-delay: 0.2s;
                    opacity: 0;
                }
                .buddy-subtitle-entrance {
                    animation: titleEntrance 0.5s ease forwards;
                    animation-delay: 0.4s;
                    opacity: 0;
                }
                .buddy-shortcut-entrance {
                    animation: titleEntrance 0.5s ease forwards;
                    animation-delay: 0.6s;
                    opacity: 0;
                }
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
                @keyframes pulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.15); }
                }
            `}</style>
            {showSplash && <WelcomeSplash onDone={handleSplashDone} />}
            <Sidebar visible={sidebarVisible && mainVisible} />

            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4" style={spotlightStyle}>
                {/* Ambient background orbs */}
                <div className="orb1" style={{
                    position: 'absolute', width: 400, height: 400,
                    borderRadius: '50%', pointerEvents: 'none',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
                    top: '20%', left: '30%', transform: 'translate(-50%, -50%)'
                }} />
                <div className="orb2" style={{
                    position: 'absolute', width: 350, height: 350,
                    borderRadius: '50%', pointerEvents: 'none',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
                    bottom: '20%', right: '30%', transform: 'translate(50%, 50%)'
                }} />
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
                        <ChatPanel chatEndRef={chatEndRef} chatOpen={chatOpen} isLoading={isLoading} isTyping={isTyping} messages={messages} onClose={handleChatClose} />
                        {messages.length === 0 && !chatOpen && (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', padding: '28px 20px', gap: 8
                            }}>
                                <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
                                    Ask me anything, open apps,<br/>or search the web
                                </p>
                                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {['Open Chrome', 'Search YouTube', 'Tell me a joke'].map(s => (
                                        <button key={s} onClick={() => { inputRef.current?.setCommand(s); inputRef.current?.focus(); }}
                                            style={{
                                                padding: '4px 10px', borderRadius: 100, fontSize: 11,
                                                background: 'rgba(99,102,241,0.08)',
                                                border: '0.5px solid rgba(99,102,241,0.25)',
                                                color: 'rgba(167,139,250,0.8)', cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <InputBar chatOpen={chatOpen} inputRef={inputRef} isLoading={isLoading} isListening={isListening} sttOnline={sttOnline} onEscape={handleEscape} onSubmit={handleSubmit} />

                        <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, letterSpacing: '0.02em' }}>
                            Press <kbd style={{ fontFamily: 'monospace' }}>Esc</kbd> to close chat | <kbd style={{ fontFamily: 'monospace' }}>Ctrl+Alt+B</kbd> to toggle
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
});

export default Spotlight;
