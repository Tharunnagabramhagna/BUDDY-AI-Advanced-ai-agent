const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
console.log("OPENAI_API_KEY loaded:", process.env.OPENAI_API_KEY ? "YES" : "NO")
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require("electron")
app.disableHardwareAcceleration()
const fs = require("fs")
const http = require("http")
const { exec } = require("child_process")
const { spawn } = require("child_process")
const { GoogleGenerativeAI } = require("@google/generative-ai")
const puppeteer = require('puppeteer-core')

// Find Chrome executable path on Windows
function getChromeExecutablePath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const fs = require('fs');
    for (const p of paths) {
        try {
            if (fs.existsSync(p)) return p;
        } catch {}
    }
    return null;
}

// Only detect login when there's a real login WALL (modal, full-page form)
// NOT when there's just a navbar Sign-in link (Amazon, Flipkart always have those)
async function detectLoginRequirement(page) {
    try {
        const url = page.url().toLowerCase();
        // Full page redirected to login URL
        if (url.includes('/login') || url.includes('/signin') || url.includes('/ap/signin')) return true;

        return await page.evaluate(() => {
            const isVisible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;

            // 1. Visible password field = definite login form
            const pwdFields = Array.from(document.querySelectorAll('input[type="password"]'));
            if (pwdFields.some(isVisible)) return true;

            // 2. Modal/dialog that contains an input AND login text
            // Must be a modal/overlay — not just any page element
            const modals = Array.from(document.querySelectorAll(
                '[role="dialog"], [role="alertdialog"], .modal-container, .login-modal, [class*="LoginModal"], [class*="loginModal"], [id*="loginModal"]'
            ));
            for (const modal of modals) {
                if (!isVisible(modal)) continue;
                const text = (modal.innerText || '').toLowerCase();
                const hasLoginText = text.includes('login') || text.includes('sign in') || text.includes('log in');
                const hasInput = modal.querySelectorAll('input').length > 0;
                if (hasLoginText && hasInput) return true;
            }

            return false;
        });
    } catch { return false; }
}

async function automateFoodOrder(page, checkLoginBreak) {
    let isMenu = await page.evaluate(() => window.location.href.includes('/order') || document.querySelector('button')?.innerText.includes('Add'));
    
    if (!isMenu) {
        let found = false;
        let attempts = 0;
        
        while (!found && attempts < 10) {
            await checkLoginBreak();

            found = await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('a, div[tabindex], div[class*="jumbo"]')).filter(el => el.offsetWidth > 100 && el.offsetHeight > 100);
                for (const card of cards) {
                    const text = card.innerText.toLowerCase();
                    if (text.includes('currently offline') || text.includes('not delivering') || text.includes('closed')) continue;
                    
                    const hasOrderText = text.includes('order') || text.includes('delivery') || text.includes('₹') || text.match(/\d+(\.\d+)?\s*★/);
                    if (hasOrderText) {
                        const btn = card.querySelector('button') || card;
                        if (btn.disabled) continue;
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        btn.click();
                        return true;
                    }
                }
                return false;
            });

            if (found) break;

            await page.evaluate(() => window.scrollBy(0, 800));
            await new Promise(r => setTimeout(r, 1500));
            attempts++;
        }

        if (!found) return;

        // Wait for navigation
        await new Promise(r => setTimeout(r, 3000));
        await checkLoginBreak();
    }

    // Menu logic
    await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button'));
        const orderTab = tabs.find(t => t.innerText.toLowerCase().includes('order online'));
        if (orderTab) orderTab.click();
    });

    await new Promise(r => setTimeout(r, 2000));
    await checkLoginBreak();

    let added = false;
    let menuAttempts = 0;
    while (!added && menuAttempts < 8) {
        await checkLoginBreak();

        added = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"], i'));
            const addBtns = buttons.filter(b => {
                 const t = b.innerText.trim().toLowerCase();
                 return (t === 'add' || t === '+' || t === 'add to cart' || t.includes('+')) && !b.disabled;
            });
            const visibleBtns = addBtns.filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);
            if (visibleBtns.length > 0) {
                visibleBtns[0].scrollIntoView({ block: 'center' });
                visibleBtns[0].click();
                return true;
            }
            return false;
        });

        if (added) break;
        await page.evaluate(() => window.scrollBy(0, 600));
        await new Promise(r => setTimeout(r, 1000));
        menuAttempts++;
    }

    if (added) {
        await new Promise(r => setTimeout(r, 2000));
        await checkLoginBreak();

        // Checkout / View Cart
        await page.evaluate(() => {
             const buttons = Array.from(document.querySelectorAll('button, a'));
             const cartBtns = buttons.filter(b => {
                 const t = b.innerText.trim().toLowerCase();
                 return (t.includes('view cart') || t.includes('checkout') || t.includes('continue')) && b.offsetWidth > 0 && b.offsetHeight > 0;
             });
             if (cartBtns.length > 0) {
                 const prominentBtn = cartBtns[cartBtns.length - 1]; // Usually fixed at bottom
                 prominentBtn.scrollIntoView({ block: 'center' });
                 prominentBtn.click();
             }
        });
        await new Promise(r => setTimeout(r, 2000));
        await checkLoginBreak();
    }
}

async function waitForLoginComplete(page) {
    return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            if (page.isClosed()) {
                clearInterval(checkInterval);
                return resolve(false);
            }
            try {
                const stillNeedsLogin = await detectLoginRequirement(page);
                if (!stillNeedsLogin) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            } catch { }
        }, 3000);
    });
}

async function resumeAgentAction(page, action, checkLoginBreak) {
    try {
        switch (action.type) {
            case 'zomato_search':
            case 'swiggy_search':
                await automateFoodOrder(page, checkLoginBreak);
                break;

            case 'amazon_search': {
                console.log('[Agent] Waiting for Amazon search results... budget:', action.budget || 'none');
                await Promise.race([
                    page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 8000 }),
                    page.waitForSelector('.s-result-item[data-asin]', { timeout: 8000 }),
                    page.waitForSelector('.s-main-slot', { timeout: 8000 }),
                ]).catch(() => {});
                await new Promise(r => setTimeout(r, 2000));
                await checkLoginBreak();

                // Extract product URL, optionally filtered by budget
                const budget = action.budget || null;
                const productUrl = await page.evaluate((maxBudget) => {
                    const selectors = [
                        'h2 a[href*="/dp/"]',
                        '[data-component-type="s-search-result"] a[href*="/dp/"]',
                        '.s-result-item[data-asin] a[href*="/dp/"]',
                        'a[href*="/dp/"]',
                    ];

                    // Build list of result cards with their prices
                    const cards = Array.from(document.querySelectorAll(
                        '[data-component-type="s-search-result"], .s-result-item[data-asin]'
                    ));

                    for (const card of cards) {
                        // Skip sponsored if budget is set — they tend to be pricier
                        const link = card.querySelector('h2 a[href*="/dp/"]') ||
                                     card.querySelector('a[href*="/dp/"]');
                        if (!link || link.offsetWidth === 0 || !link.href) continue;

                        if (maxBudget) {
                            // Try to extract price from the card
                            const priceEl = card.querySelector('.a-price .a-offscreen, .a-price-whole, [data-a-color="base"] .a-offscreen');
                            if (priceEl) {
                                const raw = priceEl.textContent.replace(/[₹,\s]/g, '').trim();
                                const price = parseFloat(raw);
                                if (!isNaN(price) && price > maxBudget) {
                                    console.log('[skip]', link.href.substring(0, 60), 'price:', price, '> budget:', maxBudget);
                                    continue; // skip this — over budget
                                }
                                console.log('[pick]', link.href.substring(0, 60), 'price:', price);
                            }
                        }
                        return link.href;
                    }

                    // Fallback: if budget found nothing, just return first link
                    for (const sel of ['h2 a[href*="/dp/"]', 'a[href*="/dp/"]']) {
                        const links = Array.from(document.querySelectorAll(sel));
                        const visible = links.find(l => l.offsetWidth > 0 && l.href);
                        if (visible) return visible.href;
                    }
                    return null;
                }, budget);

                console.log('[Agent] Amazon product URL:', productUrl);

                if (productUrl) {
                    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                    console.log('[Agent] On product page:', page.url());

                    const cartClicked = await page.evaluate(() => {
                        const addToCartInput = document.querySelector('#add-to-cart-button');
                        if (addToCartInput && addToCartInput.offsetWidth > 0) {
                            addToCartInput.scrollIntoView({ block: 'center' });
                            addToCartInput.click();
                            return 'input#add-to-cart-button';
                        }
                        const els = Array.from(document.querySelectorAll('input[type="submit"], button'));
                        for (const el of els) {
                            const text = (el.value || el.innerText || '').toLowerCase();
                            if ((text.includes('add to cart') || text.includes('add to basket')) && el.offsetWidth > 0) {
                                el.scrollIntoView({ block: 'center' });
                                el.click();
                                return 'fallback: ' + text.substring(0, 30);
                            }
                        }
                        return null;
                    });

                    console.log('[Agent] Add to Cart clicked via:', cartClicked);
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                } else {
                    console.log('[Agent] No product URL found — page title:', await page.title().catch(() => 'n/a'));
                }
                break;
            }


            case 'flipkart_search': {
                console.log('[Agent] Waiting for Flipkart results...');
                await new Promise(r => setTimeout(r, 2500));
                await checkLoginBreak();

                // Extract product URL directly
                const productUrl = await page.evaluate(() => {
                    // Flipkart product links contain /p/ in the path
                    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
                    for (const link of links) {
                        if (link.offsetWidth > 0 && link.offsetHeight > 0 && link.href) {
                            return link.href;
                        }
                    }
                    return null;
                });

                console.log('[Agent] Flipkart product URL:', productUrl);

                if (productUrl) {
                    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                    console.log('[Agent] On Flipkart product page:', page.url());

                    const cartClicked = await page.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        for (const btn of btns) {
                            const text = (btn.innerText || '').toLowerCase();
                            if (text.includes('add to cart') && btn.offsetWidth > 0) {
                                btn.scrollIntoView({ block: 'center' });
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    });

                    console.log('[Agent] Flipkart Add to Cart clicked:', cartClicked);
                    await new Promise(r => setTimeout(r, 2000));
                    await checkLoginBreak();
                }
                break;
            }


            case 'google_search':
                await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
                break;

            case 'ola_open':
                if (action.destination) {
                    await page.waitForSelector('input[placeholder*="destination"], input[placeholder*="Where to"]', { timeout: 5000 }).catch(()=>{});
                    await page.type('input[placeholder*="destination"], input[placeholder*="Where to"]', action.destination);
                }
                break;

            case 'bookmyshow_search':
                if (action.movie && !page.url().includes('search')) {
                    await page.goto(`https://in.bookmyshow.com/search?q=${encodeURIComponent(action.movie)}`, { waitUntil: 'networkidle2' });
                }
                await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
                break;
        }
        await new Promise(resolve => setTimeout(resolve, 800));
    } catch (e) {
        console.error("Agent resume error:", e.message);
    }
}


async function executeAgentAction(action) {
    console.log("[Agent] Triggered with action:", JSON.stringify(action));
    const chromePath = getChromeExecutablePath();
    if (!chromePath) throw new Error('Chrome not found on this system');

    // Normalize 'order' type from frontend into proper typed action
    if (action.type === 'order' || !action.type) {
        const plat = (action.platform || '').toLowerCase();
        if (plat.includes('amazon')) {
            action.type = 'amazon_search';
            action.query = action.query || action.description || 'product';
        } else if (plat.includes('flipkart')) {
            action.type = 'flipkart_search';
            action.query = action.query || action.description || 'product';
        } else if (plat.includes('zomato')) {
            action.type = 'zomato_search';
            action.query = action.query || action.description || 'food';
        } else if (plat.includes('swiggy')) {
            action.type = 'swiggy_search';
            action.query = action.query || action.description || 'food';
        } else {
            action.type = 'amazon_search';
            action.query = action.query || action.description || 'product';
        }
        console.log('[Agent] Normalized action type to:', action.type, 'query:', action.query);
    }

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    try {
        console.log('[Agent] Navigating for type:', action.type);
        switch (action.type) {
            case 'zomato_search':
                await page.goto(`https://www.zomato.com/search?q=${encodeURIComponent(action.query)}`, { waitUntil: 'networkidle2' });
                break;
            case 'swiggy_search':
                await page.goto(`https://www.swiggy.com/search?query=${encodeURIComponent(action.query)}`, { waitUntil: 'networkidle2' });
                break;
            case 'amazon_search':
                await page.goto('https://www.amazon.in', { waitUntil: 'networkidle2' });
                if (action.query) {
                    await page.waitForSelector("input[name='field-keywords']", { timeout: 8000 });
                    await page.type("input[name='field-keywords']", action.query, { delay: 60 });
                    await page.keyboard.press('Enter');
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
                    console.log('[Agent] Amazon search done, now on:', page.url());
                }
                break;
            case 'flipkart_search':
                await page.goto(`https://www.flipkart.com/search?q=${encodeURIComponent(action.query)}`, { waitUntil: 'networkidle2' });
                break;
            case 'ola_open':
                await page.goto('https://book.olacabs.com/', { waitUntil: 'networkidle2' });
                break;
            case 'uber_open':
                await page.goto('https://m.uber.com/looking', { waitUntil: 'networkidle2' });
                break;
            case 'bookmyshow_search':
                await page.goto(`https://in.bookmyshow.com/explore/movies/${action.city || 'chennai'}`, { waitUntil: 'networkidle2' });
                break;
            case 'google_search':
                await page.goto(`https://www.google.com/search?q=${encodeURIComponent(action.query)}`, { waitUntil: 'networkidle2' });
                break;
            case 'open_url':
                await page.goto(action.url, { waitUntil: 'networkidle2' });
                break;
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }

        // Brief wait for modals
        await new Promise(resolve => setTimeout(resolve, 1200));

        const checkLoginBreak = async () => {
            const needsLogin = await detectLoginRequirement(page);
            if (needsLogin) {
                console.log('[Agent] Login wall detected, pausing automation');
                throw new Error('LOGIN_REQUIRED');
            }
        };

        const needsLogin = await detectLoginRequirement(page);
        console.log('[Agent] Login check result:', needsLogin);
        if (needsLogin) throw new Error('LOGIN_REQUIRED');

        console.log('[Agent] Calling resumeAgentAction for:', action.type);
        await resumeAgentAction(page, action, checkLoginBreak);
        console.log('[Agent] Done!');
        return { success: true, message: 'Done! You can continue from the browser.' };

    } catch (err) {
        console.error('[Agent] Caught error:', err.message);
        if (err.message === 'LOGIN_REQUIRED') {
            (async () => {
                const loggedIn = await waitForLoginComplete(page);
                if (loggedIn && !page.isClosed()) {
                    console.log('[Agent] Login complete, resuming...');
                    await resumeAgentAction(page, action, async () => {});
                }
            })().catch(e => console.error('Agent background task error:', e));
            return { success: false, error: 'Please log in in the browser. I will resume automatically after login.' };
        }
        await browser.close().catch(() => {});
        throw err;
    }
}

const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) console.error("ERROR: No Gemini API key found in .env!");
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
console.log("Gemini key loaded:", API_KEY ? API_KEY.substring(0, 8) + "..." : "MISSING");

let mainWindow
let tray
let sttProcess = null
let isCreatingWindow = false
const DEV_SERVER_URL = "http://localhost:5173"
const DIST_INDEX_PATH = path.join(__dirname, "..", "dist", "index.html")

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
    console.log("Another Buddy instance is already running. Quitting duplicate instance.")
    app.quit()
    process.exit(0)
}

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception in main process:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection in main process:", error);
});

function isDevServerAvailable(url) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume()
            resolve(true)
        })

        request.on("error", () => resolve(false))
        request.setTimeout(1500, () => {
            request.destroy()
            resolve(false)
        })
    })
}

function showMainWindow() {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) {
        mainWindow.restore()
    }

    if (!mainWindow.isVisible()) {
        mainWindow.show()
    }

    mainWindow.focus()
}

function hideMainWindow() {
    if (!mainWindow) return

    mainWindow.hide()
}

async function loadRenderer() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error("Cannot load renderer without an active window.")
    }

    const canUseDevServer = await isDevServerAvailable(DEV_SERVER_URL)

    if (canUseDevServer) {
        console.log("Loading Buddy from dev server")
        await mainWindow.loadURL(DEV_SERVER_URL)
        return
    }

    if (fs.existsSync(DIST_INDEX_PATH)) {
        console.log("Loading Buddy from dist fallback")
        await mainWindow.loadFile(DIST_INDEX_PATH)
        return
    }

    throw new Error("No renderer source available. Start Vite or build the app first.")
}

async function createWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow
    }

    if (isCreatingWindow) {
        return mainWindow
    }

    isCreatingWindow = true
    console.log("Creating Buddy window");
    let hasRevealedWindow = false

    try {
        mainWindow = new BrowserWindow({
            width: 700,
            height: 580,
            show: false,
            backgroundColor: "#0b1120",
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false
            }
        })

        mainWindow.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
            console.error("Buddy window failed to load:", errorCode, errorDescription);
        });

        const revealWindow = () => {
            if (!mainWindow || mainWindow.isDestroyed() || hasRevealedWindow) return

            hasRevealedWindow = true
            console.log("Revealing Buddy window");
            showMainWindow()
        }

        mainWindow.webContents.once("did-finish-load", () => {
            console.log("Buddy window finished loading");
            console.log("Buddy window ready to show");
            revealWindow()
        })

        mainWindow.on("close", (event) => {
            if (!app.isQuiting) {
                event.preventDefault()
                hideMainWindow()
            }
        })

        mainWindow.on("closed", () => {
            mainWindow = null
        })

        // Notify STT when window shows or hides
        mainWindow.on("show", async () => {
            try { await fetch("http://localhost:5050/app-open") } catch { }
        })
        mainWindow.on("hide", async () => {
            try { await fetch("http://localhost:5050/app-close") } catch { }
        })

        await loadRenderer()
        return mainWindow
    } finally {
        isCreatingWindow = false
    }
}

function startSTTServer() {
    const pythonScript = path.join(__dirname, "../python/buddy_stt.py")
    console.log("[STT] Starting Python script at:", pythonScript)

    // Try 'python' first, fall back to 'python3'
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

    sttProcess = spawn(pythonCmd, [pythonScript], {
        detached: false,
        stdio: "pipe",
        cwd: path.join(__dirname, "../python")
    })

    sttProcess.stdout.on("data", (data) => {
        console.log("[STT]", data.toString().trim())
    })
    sttProcess.stderr.on("data", (data) => {
        console.error("[STT Error]", data.toString().trim())
    })
    sttProcess.on("error", (err) => {
        console.error("[STT] Failed to start process:", err.message)
    })
    sttProcess.on("close", (code) => {
        console.log("[STT] Process exited with code:", code)
    })
}

function createTray() {
    console.log("Creating Buddy tray");

    tray = new Tray(path.join(__dirname, "tray.png"))

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Open Buddy",
            click: () => {
                showMainWindow()
            }
        },
        {
            label: "Quit",
            click: () => {
                app.isQuiting = true
                app.quit()
            }
        }
    ])

    tray.setToolTip("Buddy AI Assistant")
    tray.setContextMenu(contextMenu)

    tray.on("click", () => {
        showMainWindow()
    })
}

function registerShortcut() {
    console.log("Registering Buddy shortcut");

    globalShortcut.unregisterAll()

    const spotlightRegistered = globalShortcut.register("Control+Alt+B", () => {

        if (!mainWindow) return

        if (mainWindow.isVisible() && !mainWindow.isMinimized() && mainWindow.isFocused()) {
            hideMainWindow()
        } else {
            showMainWindow()
        }

    })

    console.log("Shortcut registered:", spotlightRegistered);

}

function handleCommand(command, event) {
    console.log("Buddy command received:", command);
    const lower = command.toLowerCase().trim();

    // 1. Browser automation intercept
    const agentKeywords = ['order', 'buy', 'book', 'search', 'zomato', 'swiggy', 'amazon', 'flipkart', 'uber', 'ola'];
    if (agentKeywords.some(w => lower.includes(w))) {
        let action = null;
        
        if (lower.includes('zomato') || lower.includes('food') || lower.includes('eat') || ((lower.includes('order') || lower.includes('get')) && !lower.includes('amazon') && !lower.includes('flipkart') && !lower.includes('product'))) {
            const q = lower.replace(/\b(open|can you|please|order|food|from|zomato|on|me|i want|get|some|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'zomato_search', query: q || 'food' };
        } else if (lower.includes('swiggy')) {
            const q = lower.replace(/\b(open|can you|please|order|food|from|swiggy|on|me|i want|get|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'swiggy_search', query: q || 'food' };
        } else if (lower.includes('amazon') || lower.includes('buy') || lower.includes('product')) {
            const q = lower.replace(/\b(open|can you|please|order|buy|get|from|amazon|on|me|i want|product|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'amazon_search', query: q || 'product' };
        } else if (lower.includes('flipkart')) {
            const q = lower.replace(/\b(open|can you|please|order|buy|get|from|flipkart|on|me|i want|product|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'flipkart_search', query: q || 'product' };
        } else if (lower.includes('ola') || (lower.includes('book') && lower.includes('cab'))) {
            const dest = lower.replace(/\b(open|can you|please|book|cab|ola|ride|to|a|an|me|from|and)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'ola_open', destination: dest };
        } else if (lower.includes('uber')) {
            action = { type: 'uber_open' };
        } else if (lower.includes('bookmyshow') || (lower.includes('book') && lower.includes('movie'))) {
            const movie = lower.replace(/\b(open|can you|please|book|ticket|tickets|movie|on|bookmyshow|for|me|watch|search|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'bookmyshow_search', movie: movie };
        } else if (lower.includes('search') && !lower.includes('youtube')) {
            const q = lower.replace(/\b(open|can you|please|search|for|on|google|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'google_search', query: q };
        }

        if (action) {
            console.log("Routing to agent for approval:", command);
            let platform = action.type.split('_')[0].charAt(0).toUpperCase() + action.type.split('_')[0].slice(1);
            if (action.type === 'bookmyshow_search') platform = 'BookMyShow';

            let description = `Open ${platform} for you`;
            let emoji = '🤖';
            if (action.type === 'zomato_search') { description = `Search for "${action.query}" on Zomato`; emoji = '🍔'; }
            if (action.type === 'swiggy_search') { description = `Search for "${action.query}" on Swiggy`; emoji = '🍕'; }
            if (action.type === 'amazon_search') { description = `Search for "${action.query}" on Amazon`; emoji = '📦'; }
            if (action.type === 'flipkart_search') { description = `Search for "${action.query}" on Flipkart`; emoji = '🛍️'; }
            if (action.type === 'ola_open') { description = action.destination ? `Book an Ola cab to "${action.destination}"` : 'Book an Ola cab'; emoji = '🚕'; }
            if (action.type === 'uber_open') { description = 'Open Uber to book a ride'; emoji = '🚗'; }
            if (action.type === 'bookmyshow_search') { description = `Search for "${action.movie || 'movies'}" on BookMyShow`; emoji = '🎬'; }
            if (action.type === 'google_search') { description = `Search for "${action.query}" on Google`; emoji = '🔍'; }

            const UIAction = { ...action, platform, description, emoji, message: "Do you want me to execute this action?" };

            if (event && event.reply) {
                event.reply("agent-approval", UIAction);
            } else if (mainWindow) {
                mainWindow.webContents.send("agent-approval", UIAction);
            }

            if (mainWindow) mainWindow.show();
            return;
        }
    }

    if (lower.includes("search google for")) {
        const query = lower.split("search google for")[1].trim();
        exec(`start chrome "https://www.google.com/search?q=${encodeURIComponent(query)}"`);
        if (mainWindow) mainWindow.hide();
        return;
    }
    if (lower.includes("search youtube for")) {
        const query = lower.split("search youtube for")[1].trim();
        exec(`start chrome "https://www.youtube.com/results?search_query=${encodeURIComponent(query)}"`);
        if (mainWindow) mainWindow.hide();
        return;
    }

    const appMap = {
        'chrome': 'start chrome',
        'vscode': 'code .',
        'vs code': 'code .',
        'visual studio code': 'code .',
        'code': 'code .',
        'notepad': 'start notepad',
        'calculator': 'start calc',
        'calc': 'start calc',
        'paint': 'start mspaint',
        'edge': 'start msedge',
        'spotify': 'start spotify',
        'explorer': 'start explorer',
        'file explorer': 'start explorer',
        'terminal': 'start cmd',
        'cmd': 'start cmd',
        'powershell': 'start powershell',
        'discord': 'start discord',
        'steam': 'start steam',
        'vlc': 'start vlc',
        'zoom': 'start zoom',
        'slack': 'start slack',
        'brave': 'start brave',
        'firefox': 'start firefox',
        'opera': 'start opera',
    };

    // Strip action words to get app name
    let appName = lower;
    for (const action of ['open ', 'launch ', 'start ', 'run ', 'can you open ', 'please open ', 'i need ', 'i want to open ', "let's open ", 'could you open ']) {
        if (appName.startsWith(action)) {
            appName = appName.replace(action, '').trim();
            break;
        }
    }
    // Also strip trailing words like "for me", "please", "now"
    appName = appName.replace(/( for me| please| now| app)$/g, '').trim();

    const cmd = appMap[appName];
    if (cmd) {
        console.log("Opening:", appName, "->", cmd);
        exec(cmd, (err) => { if (err) console.error("Failed to open:", appName, err.message); });
        if (mainWindow) mainWindow.hide();
        return;
    }

    // Fuzzy fallback — check if any known app keyword appears anywhere in command
    for (const [key, cmd] of Object.entries(appMap)) {
        if (lower.includes(key)) {
            console.log("Fuzzy match:", key, "->", cmd);
            exec(cmd, (err) => { if (err) console.error("Fuzzy open failed:", err.message); });
            if (mainWindow) mainWindow.hide();
            return;
        }
    }

    console.log("No app matched for:", lower);
}

ipcMain.on("buddy-command", (event, command) => {
    handleCommand(command, event);
});

ipcMain.on("close-app", () => {
    if (mainWindow) mainWindow.hide();
    console.log("[Buddy] Window hidden via close-app command");
});

ipcMain.handle("execute-agent", async (event, action) => {
    console.log("🔥 AGENT EXECUTION STARTED:", action);
    try {
        const result = await executeAgentAction(action);
        return { success: true, ...(result || {}) };
    } catch (error) {
        console.error('[Agent] Error:', error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle("window-minimize", () => {
    if (!mainWindow) return false;

    mainWindow.minimize();
    return true;
});

ipcMain.handle("window-toggle-maximize", () => {
    if (!mainWindow) return false;

    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        showMainWindow();
        console.log("Window restored");
        return "restored";
    }

    mainWindow.maximize();
    showMainWindow();
    console.log("Window maximized");
    return "maximized";
});

ipcMain.handle("window-close", () => {
    if (!mainWindow) return false;

    hideMainWindow();
    console.log("Window hidden to tray");
    return true;
});

ipcMain.handle("ask-buddy", async (event, prompt, history = []) => {
    try {
        if (!genAI) {
            throw new Error("Gemini API key is missing.")
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const validHistory = (Array.isArray(history) ? history : []).filter(
            m => m && m.role && Array.isArray(m.parts) && m.parts.length > 0 && m.parts[0].text
        );
        const chat = model.startChat({ history: validHistory });
        const result = await chat.sendMessage(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
});

app.whenReady().then(async () => {
    console.log("Electron app is ready");
    startSTTServer()
    createTray()
    await createWindow()
    registerShortcut()

    // Poll for wake word when app is hidden
    setInterval(async () => {
        if (mainWindow && !mainWindow.isVisible()) {
            try {
                const res = await fetch("http://localhost:5050/result")
                const data = await res.json()
                if (data.wake === true) {
                    mainWindow.show()
                    mainWindow.focus()
                    console.log("[Buddy] Wake word detected — showing window")
                }
            } catch { }
        }
    }, 600)
}).catch((error) => {
    console.error("Buddy failed during app startup:", error)
})

app.on("second-instance", () => {
    console.log("Second Buddy instance requested focus")
    showMainWindow()
})

app.on("activate", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        await createWindow()
        return
    }

    showMainWindow()
})

app.on("window-all-closed", () => {
    console.log("All Buddy windows closed");
    if (process.platform !== "darwin") app.quit()
});

app.on("browser-window-created", () => {
    console.log("Buddy browser window created");
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll()
    if (sttProcess) {
        sttProcess.kill()
        sttProcess = null
    }
    if (tray) {
        tray.destroy()
    }
})

ipcMain.handle("get-stt-result", async () => {
    try {
        const response = await fetch("http://localhost:5050/result")
        return await response.json()
    } catch { return { status: "error", text: "", wake: false } }
})

ipcMain.handle("get-stt-status", async () => {
    try {
        const response = await fetch("http://localhost:5050/status")
        return await response.json()
    } catch { return { status: "offline" } }
})

ipcMain.handle("stt-app-open", async () => {
    try { await fetch("http://localhost:5050/app-open") } catch { }
})

ipcMain.handle("stt-app-close", async () => {
    try { await fetch("http://localhost:5050/app-close") } catch { }
})
