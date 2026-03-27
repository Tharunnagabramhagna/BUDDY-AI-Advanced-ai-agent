const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "..", ".env") })
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
console.log("MAIN FILE EXECUTED");
console.log("OPENAI_API_KEY loaded:", process.env.OPENAI_API_KEY ? "YES" : "NO")
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } = require("electron")
app.disableHardwareAcceleration()
const fs = require("fs")
const http = require("http")
const { exec } = require("child_process")
const { spawn } = require("child_process")
const { GoogleGenerativeAI } = require("@google/generative-ai")
const puppeteer = require('puppeteer-core')

function sanitizeActionForLog(action) {
    if (!action || typeof action !== 'object') return action;
    const safe = { ...action };
    if (safe.credentials) {
        safe.credentials = {
            email: safe.credentials.email ? '[REDACTED_EMAIL]' : '',
            password: safe.credentials.password ? '[REDACTED_PASSWORD]' : ''
        };
    }
    return safe;
}

// Find Chrome executable path on Windows
function getChromeExecutablePath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const p of paths) {
        if (!p) continue;
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
                if (action.selectedProduct) {
                    console.log('[Agent] Navigating to selected product:', action.selectedProduct);
                    await page.goto(action.selectedProduct, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
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
                    break;
                }

                if (action.loadMoreOptions) {
                    console.log('[Agent] Loading more options (scrolling down)...');
                    await page.evaluate(() => window.scrollBy(0, 1500));
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    console.log('[Agent] Waiting for Amazon search results... budget:', action.budget !== null && action.budget !== undefined ? action.budget : 'none');
                    await Promise.race([
                        page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 8000 }),
                        page.waitForSelector('.s-result-item[data-asin]', { timeout: 8000 }),
                        page.waitForSelector('.s-main-slot', { timeout: 8000 }),
                    ]).catch(() => {});
                    await new Promise(r => setTimeout(r, 2000));
                    await checkLoginBreak();
                }

                // Get all product cards with their prices, links, and ratings
                const products = await page.evaluate(() => {
                    const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
                    const results = [];

                    cards.forEach(card => {
                        // Try multiple price selectors
                        const priceEl = card.querySelector('.a-price .a-offscreen') ||
                                        card.querySelector('.a-price-whole') ||
                                        card.querySelector('[data-a-color="price"] .a-offscreen');

                        // Try multiple link selectors
                        const linkEl = card.querySelector('h2 a[href*="/dp/"]') ||
                                       card.querySelector('a[href*="/dp/"]');
                                       
                        const ratingEl = card.querySelector('.a-icon-alt');

                        if (!linkEl) return;

                        let price = null;
                        if (priceEl) {
                            // Clean price string — remove ₹, commas, spaces
                            const priceText = priceEl.textContent.replace(/[₹,\s]/g, '').trim();
                            const parsed = parseFloat(priceText);
                            if (!isNaN(parsed)) price = parsed;
                        }

                        let rating = 0;
                        if (ratingEl) {
                            const ratingMatches = ratingEl.textContent.match(/([\d.]+)\s*out of/);
                            if (ratingMatches && ratingMatches[1]) {
                                rating = parseFloat(ratingMatches[1]);
                            } else {
                                const parsed = parseFloat(ratingEl.textContent);
                                if (!isNaN(parsed)) rating = parsed;
                            }
                        }

                        results.push({
                            url: linkEl.href,
                            price: price,
                            rating: rating,
                            title: card.querySelector('h2')?.textContent?.trim() || 'Unknown product'
                        });
                    });

                    return results;
                });

                console.log('[Agent] Found products:', products.map(p => `${p.title.slice(0,30)} - ₹${p.price} ⭐${p.rating}`));

                const budget = action.budget ? parseFloat(action.budget) : null;

                if (budget && !isNaN(budget)) {
                    console.log(`[Agent] Applying budget filter: ₹${budget}`);
                    const validProducts = products.filter(p => p.price !== null && p.price <= budget);

                    if (validProducts.length === 0) {
                        const priced = products.filter(p => p.price !== null).sort((a, b) => a.price - b.price);
                        const cheapestItem = priced[0] || null;
                        console.log('[Agent] No products within budget');
                        return {
                            success: false,
                            budgetExceeded: true,
                            cheapestAvailable: cheapestItem ? cheapestItem.price : null,
                            cheapestTitle: cheapestItem ? cheapestItem.title.slice(0, 50) : null,
                            originalBudget: budget,
                            error: `No products found within ₹${budget}`
                        };
                    }

                    // Sort valid products intelligently
                    const ranked = validProducts.sort((a, b) => {
                        // Tie breaker: sort by rating descending
                        if (b.price !== a.price) return b.price - a.price; // closer to budget
                        return b.rating - a.rating;
                    });

                    const topOptions = ranked.slice(0, 5);

                    console.log("Skipping selection temporarily");
                    return {
                        success: true,
                        selectedOption: topOptions[0] || null,
                        message: topOptions[0] ? 'Selection skipped temporarily' : 'No selectable option available'
                    };
                } else {
                    // No budget — pick first product that has a valid URL
                    const selectedProduct = products.find(p => p.url);
                    console.log('[Agent] No budget set — picking first product');
                    
                    if (!selectedProduct || !selectedProduct.url) {
                        console.log('[Agent] No products found on this page.');
                        return { success: false, error: 'No products found on this page.' };
                    }
    
                    // Navigate to product page
                    console.log('[Agent] Navigating to:', selectedProduct.url);
                    await page.goto(selectedProduct.url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
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
                    break;
                }
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


async function executeAmazonStableFlow(page, action) {
    let productUrl = null;

    if (action.selectedProduct) {
        productUrl = action.selectedProduct;
    } else {
        const searchUrl = 'https://www.amazon.in/s?k=' + encodeURIComponent(action.query || 'product');
        console.log('[Agent] Searching Amazon for:', action.query, '| budget:', action.budget);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });

        const products = await page.evaluate(() => {
            const items = document.querySelectorAll('[data-component-type="s-search-result"]');

            return Array.from(items).map(item => {
                const link = item.querySelector("a[href*='/dp/']")?.href || null;
                const priceText = item.querySelector('.a-price .a-offscreen')?.innerText || null;
                const price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;

                return { link, price };
            }).filter(p => p.link && p.price);
        });

        const budget = action.budget ? parseInt(action.budget, 10) : null;
        const valid = budget ? products.filter(p => p.price <= budget) : products;
        productUrl = valid[0]?.link || null;
    }

    if (!productUrl) {
        throw new Error('No valid product found');
    }

    console.log('🛒 Selected product:', productUrl);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#add-to-cart-button', { timeout: 10000 });

    await page.evaluate(() => {
        const btn = document.querySelector('#add-to-cart-button');
        if (btn) btn.click();
    });

    console.log('✅ Added to cart');
    await new Promise(r => setTimeout(r, 2500));

    await page.goto('https://www.amazon.in/gp/cart/view.html', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const proceedBtn = await page.$("input[name='proceedToRetailCheckout']");
    if (proceedBtn) {
        await proceedBtn.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    }

    return { success: true, message: 'Added to cart and proceeded to checkout', productUrl, currentUrl: page.url() };
}

async function executeAgentAction(action) {
    console.log("🚀 EXECUTION START:", sanitizeActionForLog(action));
    if (!action) {
        throw new Error("Invalid action");
    }
    if (!action.query) {
        action.query = "";
    }
    // Reuse existing page for selectedProduct, loadMoreOptions, or checkout steps
    let existingPage = action.page || null;
    if (!existingPage && global.activePage && (action.selectedProduct || action.loadMoreOptions)) {
        existingPage = global.activePage;
    }

    let browser = null, page;
    if (existingPage) {
        page = existingPage;
        console.log('[Agent] Using existing active browser page');
    } else {
        console.log('[Agent] Action received:', action.type, '| budget:', action.budget);
        const chromePath = getChromeExecutablePath();
        console.log('[Agent] Chrome path found:', chromePath);
        
        if (!chromePath) {
            console.error('[Agent] ERROR: Chrome not found on this system');
            throw new Error('Chrome not found on this system. Please install Google Chrome.');
        }

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

        console.log('[Agent] Launching browser...');
        try {
            browser = await puppeteer.launch({
                executablePath: chromePath,
                headless: false,
                defaultViewport: { width: 1280, height: 800 },
                args: ['--start-maximized', '--window-size=1280,800']
            });
            console.log('[Agent] Browser launched successfully');
        } catch (launchError) {
            console.error('[Agent] FAILED to launch browser:', launchError.message);
            throw new Error(`Failed to launch browser: ${launchError.message}`);
        }

        // Use the first page that's automatically opened
        const pages = await browser.pages();
        page = pages.length > 0 ? pages[0] : await browser.newPage();
        if (!page) {
            page = await browser.newPage();
        }
        global.activePage = page;
        global.activeBrowser = browser; // Store browser reference

        browser.on('disconnected', () => {
            if (global.activePage === page) {
                global.activePage = null;
                global.activeBrowser = null;
                console.log('[Agent] Browser closed — session ended');
            }
        });
    }

    const checkLoginBreak = async () => {
        try {
            const needsLogin = await detectLoginRequirement(page);
            if (needsLogin) {
                console.log('[Agent] Login wall detected, pausing automation');
                throw new Error('LOGIN_REQUIRED');
            }
        } catch (e) {
            if (e.message === 'LOGIN_REQUIRED') throw e;
            console.warn('[Agent] Login check failed (non-critical):', e.message);
        }
    };

    try {
        console.log('[Agent] Executing action type:', action.type);
        if (action.type === 'amazon_search') {
            await page.goto(`https://www.amazon.in/s?k=${encodeURIComponent(action.query)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 3000));

            const budget = action.budget ? parseFloat(action.budget) : null;

            const products = await page.evaluate(() => {
                const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
                const results = [];
                cards.forEach(card => {
                    const linkEl = card.querySelector('h2 a[href*="/dp/"]') || card.querySelector('a[href*="/dp/"]');
                    const priceEl = card.querySelector('.a-price .a-offscreen');
                    if (!linkEl) return;
                    let price = null;
                    if (priceEl) {
                        const cleaned = priceEl.textContent.replace(/[₹,\s]/g, '').trim();
                        const parsed = parseFloat(cleaned);
                        if (!isNaN(parsed)) price = parsed;
                    }
                    results.push({
                        url: linkEl.href,
                        price,
                        title: card.querySelector('h2')?.textContent?.trim() || ''
                    });
                });
                return results;
            });

            console.log('[Agent] Products found:', products.length);
            console.log('[Agent] Budget:', budget);
            products.forEach(p => console.log(`  ₹${p.price} - ${p.title?.slice(0,40)}`));

            let selected = null;
            if (budget && !isNaN(budget)) {
                selected = products.find(p => p.price !== null && p.price <= budget);
                if (!selected) {
                    const sorted = products.filter(p => p.price !== null).sort((a, b) => a.price - b.price);
                    const cheapest = sorted[0];
                    return {
                        success: false,
                        budgetExceeded: true,
                        cheapestAvailable: cheapest?.price || null,
                        cheapestTitle: cheapest?.title?.slice(0, 50) || null,
                        originalBudget: budget,
                        error: `No products within ₹${budget}`
                    };
                }
            } else {
                selected = products[0];
            }

            if (!selected) return { success: false, error: 'No products found' };

            console.log('[Agent] Selected:', selected.title?.slice(0,40), '₹', selected.price);
            await page.goto(selected.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 2000));

            const addedToCart = await page.evaluate(() => {
                const btn = document.querySelector('#add-to-cart-button') ||
                    document.querySelector('input[name="submit.add-to-cart"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add to Cart'));
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });

            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
                success: true,
                addedToCart,
                productTitle: selected.title?.slice(0, 50),
                productPrice: selected.price
            };
        }
        // ... rest of the logic ...

        // ── Checkout / poll steps (operate on existing page, return directly) ──
        if (action.type === 'amazon_goto_checkout') {
            try {
                await page.goto('https://www.amazon.in/gp/cart/view.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(resolve => setTimeout(resolve, 3000));

                const clicked = await page.evaluate(() => {
                    const selectors = ['#sc-buy-box-ptc-button', 'input[name="proceedToRetailCheckout"]'];
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            el.click();
                            return true;
                        }
                    }
                    const all = Array.from(document.querySelectorAll('input,button,a'));
                    const btn = all.find(e => (e.value || e.textContent || '').includes('Proceed to Buy'));
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
                const url = page.url();
                return { success: true, needsLogin: url.includes('signin') || url.includes('ap/'), currentUrl: url, clicked };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'amazon_poll_login') {
            try {
                const url = page.url();
                const onLoginPage = url.includes('signin') || url.includes('ap/signin') || url.includes('ap/login');
                if (!onLoginPage) {
                    const isLoggedIn = await page.evaluate(() => !document.querySelector('#ap_email, #signInSubmit'));
                    return { success: true, isLoggedIn, currentUrl: url };
                }
                return { success: true, isLoggedIn: false, currentUrl: url };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'amazon_poll_address') {
            try {
                const addressMissing = await page.evaluate(() =>
                    document.body.innerText.includes("Add delivery address") ||
                    !!document.querySelector("input[name='address-ui-widgets-enterAddressFullName']")
                );
                return { success: true, hasAddress: !addressMissing, currentUrl: page.url() };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'amazon_submit_address') {
            try {
                console.log("[Agent] Address added - resuming flow");
                const deliverBtn = await page.$("input[name='shipToThisAddress'], input[data-testid='Address_selectShipToThisAddress']");
                if (deliverBtn) {
                    await deliverBtn.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                } else {
                    await page.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('input[type="submit"], button, a'));
                        const btn = btns.find(b => {
                            const t = (b.value || b.textContent || '').toLowerCase();
                            return t.includes('deliver to this address') || t.includes('use this address');
                        });
                        if (btn) btn.click();
                    });
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                }
                const currentUrl = page.url();
                const needsLogin = currentUrl.includes('signin') || currentUrl.includes('ap/signin') || currentUrl.includes('ap/login');
                return { success: true, needsLogin, currentUrl };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'flipkart_goto_checkout') {
            try {
                await page.goto('https://www.flipkart.com/viewcart', { waitUntil: 'networkidle2', timeout: 15000 });
                const placeOrderBtn = await page.$('button[class*="place"], a[class*="place"], button[class*="checkout"]');
                if (placeOrderBtn) {
                    await placeOrderBtn.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                }
                const currentUrl = page.url();
                const needsLogin = currentUrl.includes('login') || await page.evaluate(() =>
                    !!document.querySelector('input[type="tel"], input[placeholder*="mobile"], input[placeholder*="email"]')
                );
                return { success: true, needsLogin, currentUrl };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'flipkart_poll_login') {
            try {
                const isLoggedIn = await page.evaluate(() =>
                    !document.querySelector('input[type="tel"], input[placeholder*="mobile"]')
                );
                return { success: true, isLoggedIn, currentUrl: page.url() };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'zomato_goto_checkout' || action.type === 'swiggy_goto_checkout') {
            try {
                const isZomato = action.type === 'zomato_goto_checkout';
                console.log(`[Agent] Navigating to ${isZomato ? 'Zomato' : 'Swiggy'} cart...`);
                
                const cartClicked = await page.evaluate((isZomato) => {
                    const selectors = isZomato 
                        ? ['a[href*="/cart"]', 'div[class*="cart"]', 'span[class*="cart"]']
                        : ['a[href*="/checkout"]', 'span[class*="Cart"]', 'div[class*="Cart"]'];
                    
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el && el.offsetWidth > 0) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }, isZomato);

                if (!cartClicked) {
                    // Fallback to direct URL if button not found
                    await page.goto(isZomato ? 'https://www.zomato.com/cart' : 'https://www.swiggy.com/checkout', { waitUntil: 'networkidle2' });
                }

                await new Promise(r => setTimeout(r, 3000));
                await checkLoginBreak();
                return { success: true, message: `Reached ${isZomato ? 'Zomato' : 'Swiggy'} checkout!` };
            } catch (err) { return { success: false, error: err.message }; }
        }

        if (action.type === 'amazon_select_payment') {
            try {
                console.log('[Agent] Selecting payment method:', action.method);
                await page.waitForSelector('.payment-method, #pmts-form, .a-section', { timeout: 15000 }).catch(() => {});
                const { method } = action;
                
                const selected = await page.evaluate((method) => {
                    const labels = Array.from(document.querySelectorAll('label, span, div, input'));
                    const termMap = {
                        cod: ['Cash on Delivery', 'Pay on Delivery', 'POD'],
                        upi: ['UPI', 'Net Banking/UPI'],
                        card: ['Credit', 'Debit', 'Credit/Debit'],
                        netbanking: ['Net Banking', 'NetBanking'],
                        amazonpay: ['Amazon Pay'],
                    };
                    const terms = termMap[method] || [];
                    
                    // Find the label or input that contains the text
                    for (const term of terms) {
                        const el = labels.find(l => l.textContent.includes(term));
                        if (el) {
                            el.scrollIntoView({ block: 'center' });
                            el.click();
                            return term;
                        }
                    }
                    return null;
                }, method);

                console.log('[Agent] Payment selection result:', selected);

                if (method === 'upi' && action.upiId) {
                    console.log('[Agent] Entering UPI ID...');
                    await page.waitForSelector('input[placeholder*="UPI"], input[name*="upi"]', { timeout: 8000 }).catch(() => {});
                    const upiInputs = await page.$$('input[placeholder*="UPI"], input[name*="upi"]');
                    if (upiInputs.length > 0) {
                        await upiInputs[0].type(action.upiId, { delay: 50 });
                    }
                }

                console.log('[Agent] Clicking Continue...');
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a, span'));
                    const cont = btns.find(b => {
                        const t = (b.textContent || b.getAttribute?.('value') || '').toLowerCase();
                        return t.includes('use this payment') || t.includes('continue') || t.includes('use this method');
                    });
                    if (cont) {
                        cont.scrollIntoView({ block: 'center' });
                        cont.click();
                    }
                });
                
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                return { success: true, paymentSelected: method };
            } catch (err) { 
                console.error('[Agent] Payment selection error:', err.message);
                return { success: false, error: err.message }; 
            }
        }

        if (action.type === 'amazon_place_order') {
            try {
                await page.waitForSelector('#submitOrderButtonId, input[name="placeYourOrder1"]', { timeout: 10000 }).catch(() => {});
                const placeBtn = await page.$('#submitOrderButtonId, input[name="placeYourOrder1"]');
                if (placeBtn) {
                    await placeBtn.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
                }
                const orderPlaced = await page.evaluate(() =>
                    document.body.innerText.includes('order has been placed') ||
                    document.body.innerText.includes('Thank you') ||
                    document.querySelector('.a-alert-success') !== null
                );
                return { success: true, orderPlaced, message: orderPlaced ? 'Order placed successfully! \uD83C\uDF89' : 'Reached order confirmation page' };
            } catch (err) { return { success: false, error: err.message }; }
        }

        // ── Amazon shopping flow ──────────────────────────────────────────────
        if (action.type === 'amazon_search') {
            if (action.selectedProduct) {
                // User picked from selection card — navigate directly to the product
                console.log('[Agent] Navigating to user-selected product:', action.selectedProduct);
                await page.goto(action.selectedProduct, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2500));
                await checkLoginBreak();
            } else {
                if (action.loadMoreOptions) {
                    console.log('[Agent] Loading more options (scrolling down)...');
                    await page.evaluate(() => window.scrollBy(0, 1500));
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    // First search: navigate to Amazon and search
                    console.log('[Agent] Searching Amazon for:', action.query, '| budget:', action.budget);
                    await page.goto('https://www.amazon.in', { waitUntil: 'networkidle2' });
                    await page.waitForSelector("input[name='field-keywords']", { timeout: 8000 });
                    await page.type("input[name='field-keywords']", action.query, { delay: 60 });
                    await page.keyboard.press('Enter');
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
                    console.log('[Agent] Amazon search done, now on:', page.url());
                    await Promise.race([
                        page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 8000 }),
                        page.waitForSelector('.s-main-slot', { timeout: 8000 }),
                    ]).catch(() => {});
                    await new Promise(r => setTimeout(r, 1500));
                    await checkLoginBreak();
                }

                // Extract all products from search results
                const products = await page.evaluate(() => {
                    const cards = document.querySelectorAll('[data-component-type="s-search-result"], .s-result-item[data-asin]');
                    const results = [];
                    cards.forEach(card => {
                        // Price selectors
                        const priceEl = card.querySelector('.a-price .a-offscreen') ||
                                        card.querySelector('.a-price-whole') ||
                                        card.querySelector('[data-a-color="price"] .a-offscreen') ||
                                        card.querySelector('.a-color-price');

                        // Link selectors
                        const linkEl = card.querySelector('h2 a[href*="/dp/"]') ||
                                       card.querySelector('a[href*="/dp/"]') ||
                                       card.querySelector('a.a-link-normal[href*="/dp/"]');
                                       
                        const ratingEl = card.querySelector('.a-icon-alt') || 
                                         card.querySelector('[aria-label*="out of 5 stars"]');

                        if (!linkEl || !linkEl.href) return;

                        let price = null;
                        if (priceEl) {
                            const priceText = priceEl.textContent.replace(/[₹,\s\u20B9]/g, '').trim();
                            const parsed = parseFloat(priceText);
                            if (!isNaN(parsed)) price = parsed;
                        }

                        let rating = 0;
                        if (ratingEl) {
                            const text = ratingEl.getAttribute('aria-label') || ratingEl.textContent;
                            const m = text.match(/([\d.]+)\s*out of/);
                            if (m) rating = parseFloat(m[1]);
                            else { const p = parseFloat(text); if (!isNaN(p)) rating = p; }
                        }

                        results.push({
                            url: linkEl.href,
                            price,
                            rating,
                            title: card.querySelector('h2, .a-size-medium, .a-size-base-plus')?.textContent?.trim() || 'Product'
                        });
                    });
                    return results;
                });

                console.log('[Agent] Products extracted:', products.length);

                const budget = action.budget ? parseFloat(action.budget) : null;
                if (budget && !isNaN(budget)) {
                    const validProducts = products.filter(p => p.price !== null && p.price <= budget);
                    if (validProducts.length === 0) {
                        const priced = products.filter(p => p.price !== null).sort((a, b) => a.price - b.price);
                        return {
                            success: false,
                            budgetExceeded: true,
                            cheapestAvailable: priced[0]?.price ?? null,
                            cheapestTitle: priced[0]?.title?.slice(0, 50) ?? null,
                            originalBudget: budget,
                            error: 'No products found within \u20B9' + budget
                        };
                    }
                    // Sort by price closest to budget, then by rating
                    validProducts.sort((a, b) => b.price !== a.price ? b.price - a.price : b.rating - a.rating);
                    console.log('[Agent] Presenting', Math.min(validProducts.length, 5), 'options to user');
                    console.log("Skipping selection temporarily");
                    const autoPick = validProducts[0];
                    if (!autoPick) return { success: false, error: 'No valid products available.' };
                    await page.goto(autoPick.url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                } else {
                    // No budget — auto pick first product
                    const pick = products.find(p => p.url);
                    if (!pick) return { success: false, error: 'No products found on this page.' };
                    console.log('[Agent] No budget — picking first product:', pick.title.slice(0, 40));
                    await page.goto(pick.url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                }
            }

            // Add to cart (runs for: selectedProduct path + no-budget auto-pick path)
            console.log('[Agent] On product page:', page.url());
            const cartClicked = await page.evaluate(() => {
                const addToCartInput = document.querySelector('#add-to-cart-button');
                if (addToCartInput && addToCartInput.offsetWidth > 0) {
                    addToCartInput.scrollIntoView({ block: 'center' });
                    addToCartInput.click();
                    return '#add-to-cart-button';
                }
                const els = Array.from(document.querySelectorAll('input[type="submit"], button'));
                for (const el of els) {
                    const text = (el.value || el.innerText || '').toLowerCase();
                    if ((text.includes('add to cart') || text.includes('add to basket')) && el.offsetWidth > 0) {
                        el.scrollIntoView({ block: 'center' });
                        el.click();
                        return 'fallback:' + text.slice(0, 30);
                    }
                }
                return null;
            });
            console.log('[Agent] Add to Cart result:', cartClicked);
            if (!cartClicked) return { success: false, error: 'Could not find Add to Cart button on product page.' };
            await new Promise(r => setTimeout(r, 2500));
            await checkLoginBreak();
            return { success: true, message: 'Added to cart!' };
        }

        // ── Flipkart ──────────────────────────────────────────────────────────
        if (action.type === 'flipkart_search') {
            if (action.selectedProduct) {
                console.log('[Agent] Navigating to user-selected Flipkart product:', action.selectedProduct);
                await page.goto(action.selectedProduct, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2500));
                await checkLoginBreak();
            } else {
                console.log('[Agent] Navigating to Flipkart search for:', action.query);
                await page.goto('https://www.flipkart.com/search?q=' + encodeURIComponent(action.query), { waitUntil: 'networkidle2' });
                await new Promise(r => setTimeout(r, 2500));
                await checkLoginBreak();

                // Extract products from Flipkart
                const products = await page.evaluate(() => {
                    const cards = document.querySelectorAll('div[data-id]');
                    const results = [];
                    cards.forEach(card => {
                        const linkEl = card.querySelector('a[href*="/p/"]');
                        if (!linkEl) return;

                        // Flipkart has different layouts, try multiple selectors
                        const priceEl = card.querySelector('div[class*="_30jeq3"]') || 
                                        card.querySelector('div[class*="Nx9Wp0"]') ||
                                        card.querySelector('div._30jeq3');
                        
                        const titleEl = card.querySelector('a[title]') || 
                                        card.querySelector('div[class*="_4rR01T"]') ||
                                        card.querySelector('a.IRpwTa');

                        const ratingEl = card.querySelector('div[class*="_3LWZlK"]');

                        let price = null;
                        if (priceEl) {
                            const priceText = priceEl.textContent.replace(/[₹,\s]/g, '').trim();
                            const parsed = parseFloat(priceText);
                            if (!isNaN(parsed)) price = parsed;
                        }

                        let rating = 0;
                        if (ratingEl) {
                            const parsed = parseFloat(ratingEl.textContent);
                            if (!isNaN(parsed)) rating = parsed;
                        }

                        results.push({
                            url: linkEl.href,
                            price,
                            rating,
                            title: titleEl?.textContent?.trim() || titleEl?.getAttribute('title') || 'Product'
                        });
                    });
                    return results;
                });

                console.log('[Agent] Flipkart products extracted:', products.length);

                const budget = action.budget ? parseFloat(action.budget) : null;
                if (budget && !isNaN(budget)) {
                    const validProducts = products.filter(p => p.price !== null && p.price <= budget);
                    if (validProducts.length === 0) {
                        const priced = products.filter(p => p.price !== null).sort((a, b) => a.price - b.price);
                        return {
                            success: false,
                            budgetExceeded: true,
                            cheapestAvailable: priced[0]?.price ?? null,
                            cheapestTitle: priced[0]?.title?.slice(0, 50) ?? null,
                            originalBudget: budget,
                            error: 'No products found within ₹' + budget
                        };
                    }
                    validProducts.sort((a, b) => b.price !== a.price ? b.price - a.price : b.rating - a.rating);
                    console.log("Skipping selection temporarily");
                    const autoPick = validProducts[0];
                    if (!autoPick) return { success: false, error: 'No valid products available.' };
                    await page.goto(autoPick.url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                } else {
                    const pick = products.find(p => p.url);
                    if (!pick) return { success: false, error: 'No products found on this page.' };
                    await page.goto(pick.url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    await checkLoginBreak();
                }
            }

            // Add to cart for Flipkart
            console.log('[Agent] On Flipkart product page:', page.url());
            const cartClicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const addBtn = btns.find(btn => {
                    const text = btn.innerText.toLowerCase();
                    return (text.includes('add to cart') || text.includes('buy now')) && btn.offsetWidth > 0;
                });
                if (addBtn) {
                    addBtn.scrollIntoView({ block: 'center' });
                    addBtn.click();
                    return true;
                }
                return false;
            });

            console.log('[Agent] Flipkart Add to Cart result:', cartClicked);
            if (!cartClicked) return { success: false, error: 'Could not find Add to Cart button on Flipkart.' };
            
            await new Promise(r => setTimeout(r, 2500));
            await checkLoginBreak();
            return { success: true, message: 'Added to cart on Flipkart!' };
        }

        // ── Food ──────────────────────────────────────────────────────────────
        if (action.type === 'zomato_search' || action.type === 'swiggy_search') {
            const isZomato = action.type === 'zomato_search';
            
            if (action.selectedProduct) {
                console.log(`[Agent] Navigating to user-selected ${isZomato ? 'Zomato' : 'Swiggy'} restaurant:`, action.selectedProduct);
                await page.goto(action.selectedProduct, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2500));
                await checkLoginBreak();
                await automateFoodOrder(page, checkLoginBreak);
                return { success: true, message: `Added items to cart on ${isZomato ? 'Zomato' : 'Swiggy'}!` };
            }

            const url = isZomato
                ? 'https://www.zomato.com/search?q=' + encodeURIComponent(action.query)
                : 'https://www.swiggy.com/search?query=' + encodeURIComponent(action.query);
            
            console.log(`[Agent] Navigating to ${isZomato ? 'Zomato' : 'Swiggy'} for:`, action.query);
            await page.goto(url, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 2000));
            await checkLoginBreak();

            // Extract restaurants
            const restaurants = await page.evaluate((isZomato) => {
                const selector = isZomato 
                    ? 'a[href*="/restaurants/"], div[class*="jumbo-tracker"] a'
                    : 'a[href*="/restaurants/"], div[class*="RestaurantCard"] a';
                
                const links = Array.from(document.querySelectorAll(selector));
                const results = [];
                links.forEach(link => {
                    if (link.offsetWidth > 0 && link.offsetHeight > 0 && link.href) {
                        const card = link.closest('div[class*="jumbo"], div[class*="RestaurantCard"]') || link.parentElement;
                        const title = card?.innerText?.split('\n')[0] || 'Restaurant';
                        const rating = card?.innerText?.match(/(\d+\.\d+)\s*★/)?.[1] || '0';
                        results.push({
                            url: link.href,
                            title: title,
                            rating: parseFloat(rating),
                            price: 0 // We don't have a price for restaurants
                        });
                    }
                });
                return results;
            }, isZomato);

            console.log(`[Agent] Found ${restaurants.length} restaurants on ${isZomato ? 'Zomato' : 'Swiggy'}`);

            if (restaurants.length > 0) {
                // Return restaurants for selection
                return { 
                    success: false, 
                    needsSelection: true, 
                    options: restaurants.slice(0, 5).map(r => ({ ...r, title: `🍴 ${r.title}` }))
                };
            } else {
                // If no restaurants found, attempt generic automation
                await automateFoodOrder(page, checkLoginBreak);
                return { success: true, message: `Attempted to add items on ${isZomato ? 'Zomato' : 'Swiggy'}.` };
            }
        }

        // ── Other platforms ───────────────────────────────────────────────────
        if (action.type === 'google_search') {
            await page.goto('https://www.google.com/search?q=' + encodeURIComponent(action.query), { waitUntil: 'networkidle2' });
            return { success: true };
        }
        if (action.type === 'open_url') {
            await page.goto(action.url, { waitUntil: 'networkidle2' });
            return { success: true };
        }
        if (action.type === 'ola_open') {
            await page.goto('https://book.olacabs.com/', { waitUntil: 'networkidle2' });
            if (action.destination) {
                await page.waitForSelector('input[placeholder*="destination"], input[placeholder*="Where to"]', { timeout: 5000 }).catch(() => {});
                await page.type('input[placeholder*="destination"], input[placeholder*="Where to"]', action.destination);
            }
            return { success: true };
        }
        if (action.type === 'uber_open') {
            await page.goto('https://m.uber.com/looking', { waitUntil: 'networkidle2' });
            return { success: true };
        }
        if (action.type === 'bookmyshow_search') {
            await page.goto('https://in.bookmyshow.com/explore/movies/' + (action.city || 'chennai'), { waitUntil: 'networkidle2' });
            return { success: true };
        }

        throw new Error('Unknown action type: ' + action.type);

    } catch (err) {
        console.error('❌ AGENT ERROR:', err);
        if (err.message === 'LOGIN_REQUIRED') {
            (async () => {
                const loggedIn = await waitForLoginComplete(page);
                if (loggedIn && !page.isClosed()) {
                    console.log('[Agent] Login complete, resuming...');
                    await executeAgentAction({ ...action, page }).catch(e => console.error('Resume error:', e));
                }
            })().catch(e => console.error('Background task error:', e));
            return { success: false, error: 'Please log in in the browser. I will resume automatically after login.' };
        }
        if (browser) await browser.close().catch(() => {});
        return { success: false, error: err.message };
    }
}

async function executeMinimalAgentAction(action) {
    console.log("🚀 EXECUTE AGENT:", sanitizeActionForLog(action));

    if (!action) {
        throw new Error("Action is undefined");
    }

    if (!action.query) {
        action.query = "";
    }

    const chromePath = getChromeExecutablePath() || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    if (!fs.existsSync(chromePath)) {
        throw new Error(`Chrome not found at ${chromePath}`);
    }

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ["--start-maximized", "--window-size=1280,800"]
    });

    const page = await browser.newPage();
    global.activeBrowser = browser;
    global.activePage = page;

    let productUrl = action.selectedProduct || null;
    const budget = action.budget ? parseInt(action.budget, 10) : null;

    if (!productUrl) {
        await page.goto("https://www.amazon.in", {
            waitUntil: "networkidle2",
            timeout: 60000
        });
        console.log("➡️ Page loaded");

        await page.waitForSelector("input[name='field-keywords']", { timeout: 15000 });
        await page.click("input[name='field-keywords']", { clickCount: 3 });
        await page.type("input[name='field-keywords']", action.query || "");
        await page.keyboard.press("Enter");
        await page.waitForSelector("[data-component-type='s-search-result']", { timeout: 20000 });
        console.log("➡️ Search results loaded");

        const products = await page.evaluate(() => {
            const items = document.querySelectorAll("[data-component-type='s-search-result']");

            return Array.from(items).map((item) => {
                const link = item.querySelector("a[href*='/dp/']")?.href || null;
                const priceText = item.querySelector('.a-price .a-offscreen')?.innerText || null;
                const price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;
                const title = item.querySelector('h2')?.innerText?.trim() || 'Product';

                return { link, price, title };
            }).filter((product) => product.link && product.price);
        });

        const validProducts = budget && !isNaN(budget)
            ? products.filter(product => product.price <= budget)
            : products;

        if (budget && !isNaN(budget)) {
            console.log(`[Agent] Applying budget filter: ₹${budget}`);
        }

        if (!validProducts.length) {
            if (budget && !isNaN(budget)) {
                const cheapestPrice = products
                    .filter(product => product.price !== null)
                    .sort((a, b) => a.price - b.price)[0];

                console.log('[Agent] No products within budget');
                return {
                    success: false,
                    budgetExceeded: true,
                    cheapestAvailable: cheapestPrice ? cheapestPrice.price : null,
                    cheapestTitle: cheapestPrice ? cheapestPrice.title.slice(0, 50) : null,
                    originalBudget: budget,
                    error: `No products found under budget`
                };
            }

            throw new Error("No products found");
        }

        productUrl = validProducts[0].link;
    }

    if (!productUrl) {
        throw new Error("No valid product found");
    }

    await page.goto(productUrl, { waitUntil: "networkidle2", timeout: 60000 });
    console.log("➡️ Product opened");
    await page.waitForSelector("body", { timeout: 20000 });

    const isLoginPage = await page.evaluate(() => {
        return document.body.innerText.includes("Sign in")
            && !!document.querySelector("input[type='password']");
    });
    console.log("➡️ Login check done");
    if (isLoginPage) {
        console.log("🔐 LOGIN REQUIRED - waiting for user");
        await page.waitForFunction(() => {
            return !document.body.innerText.includes("Sign in")
                && !!document.querySelector("#add-to-cart-button");
        }, { timeout: 0 });
        console.log("✅ LOGIN DETECTED - resuming");
    }

    await page.waitForSelector("#add-to-cart-button", { timeout: 20000 });
    console.log("➡️ Clicking Add to Cart");
    await page.click("#add-to-cart-button");

    await page.waitForFunction(() => {
        return document.body.innerText.includes("Added to Cart")
            || document.body.innerText.includes("Proceed to checkout")
            || document.body.innerText.includes("Added to cart");
    }, { timeout: 20000 });
    console.log("✅ ITEM ADDED TO CART");

    console.log("➡️ Verifying cart contents");
    await page.goto("https://www.amazon.in/gp/cart/view.html", { waitUntil: "networkidle2", timeout: 60000 });
    console.log("➡️ Page loaded");

    const cartValid = await page.evaluate(() => {
        return !document.body.innerText.includes("Your Amazon Cart is empty");
    });

    if (!cartValid) {
        throw new Error("Cart is still empty after add-to-cart");
    }

    console.log("✅ CART VERIFIED");

    return {
        success: true,
        stage: "added_to_cart"
    };
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

process.on("uncaughtException", (err) => {
    console.error("🔥 UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
    console.error("🔥 UNHANDLED PROMISE:", err);
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
            show: true,
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

        mainWindow.webContents.on("console-message", (_, level, message, line, sourceId) => {
            console.log(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
        });

        mainWindow.webContents.on("render-process-gone", (_, details) => {
            console.error("Buddy renderer process gone:", details);
        });

        const revealWindow = () => {
            if (!mainWindow || mainWindow.isDestroyed() || hasRevealedWindow) return

            hasRevealedWindow = true
            console.log("Revealing Buddy window");
            showMainWindow()
        }

        setTimeout(() => {
            console.log("Buddy fallback reveal timer fired");
            revealWindow()
        }, 1500)

        mainWindow.webContents.once("did-finish-load", () => {
            console.log("Buddy window finished loading");
            console.log("Buddy window ready to show");
            mainWindow.webContents.executeJavaScript(`
                (() => {
                    const root = document.getElementById('root');
                    return {
                        title: document.title,
                        bodyBg: getComputedStyle(document.body).backgroundColor,
                        bodyText: (document.body.innerText || '').slice(0, 200),
                        rootExists: !!root,
                        rootChildren: root ? root.childElementCount : -1,
                        rootHtml: root ? root.innerHTML.slice(0, 500) : ''
                    };
                })();
            `).then((info) => {
                console.log("Renderer snapshot:", info);
            }).catch((error) => {
                console.error("Renderer snapshot failed:", error);
            });
            revealWindow()
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
        revealWindow()
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
    try {
        tray = new Tray(path.join(__dirname, "tray.png"))
    } catch (error) {
        console.error("Buddy tray failed to initialize:", error)
        tray = null
        return
    }

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
        
        // ── A. Food ──────────────────────────────────────────────
        if (lower.includes('zomato') || lower.includes('food') || lower.includes('eat')) {
            const q = lower.replace(/\b(open|can you|please|order|food|from|zomato|on|me|i want|get|some|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'zomato_search', query: q || 'food' };
        } else if (lower.includes('swiggy')) {
            const q = lower.replace(/\b(open|can you|please|order|food|from|swiggy|on|me|i want|get|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'swiggy_search', query: q || 'food' };
        // ── B. Shopping ──────────────────────────────────────────
        } else if (lower.includes('amazon') || lower.includes('buy') || lower.includes('product') || lower.includes('order') || lower.includes('get')) {
            // Check for flipkart explicitly first
            if (lower.includes('flipkart')) {
                const q = lower.replace(/\b(open|can you|please|order|buy|get|from|flipkart|on|me|i want|product|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
                action = { type: 'flipkart_search', query: q || 'product' };
            } else {
                // Default to Amazon for generic shopping
                const q = lower.replace(/\b(open|can you|please|order|buy|get|from|amazon|on|me|i want|product|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
                action = { type: 'amazon_search', query: q || 'product' };
            }
        // ── C. Cabs ──────────────────────────────────────────────
        } else if (lower.includes('ola') || (lower.includes('book') && lower.includes('cab'))) {
            const dest = lower.replace(/\b(open|can you|please|book|cab|ola|ride|to|a|an|me|from|and)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'ola_open', destination: dest };
        } else if (lower.includes('uber')) {
            action = { type: 'uber_open' };
        // ── D. Movies ────────────────────────────────────────────
        } else if (lower.includes('bookmyshow') || (lower.includes('book') && lower.includes('movie'))) {
            const movie = lower.replace(/\b(open|can you|please|book|ticket|tickets|movie|on|bookmyshow|for|me|watch|search|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'bookmyshow_search', movie: movie };
        // ── E. Google Search ─────────────────────────────────────
        } else if (lower.includes('search') && !lower.includes('youtube')) {
            const q = lower.replace(/\b(open|can you|please|search|for|on|google|and|the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
            action = { type: 'google_search', query: q };
        }

        if (action) {
            console.log("Routing to agent for approval:", command, "| Intent:", action.type);
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
    try {
        console.log("🚀 EXECUTE AGENT:", sanitizeActionForLog(action));
        if (!action) throw new Error("Action is undefined");
        const result = await executeAgentAction(action);
        return result || { success: true };
    } catch (err) {
        console.error("❌ AGENT ERROR:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('agent-checkout-step', async (event, action) => {
    try {
        if (!global.activePage) {
            return { success: false, error: 'No active browser session. Please start a new order.' };
        }
        action.page = global.activePage;
        console.log('[Agent Checkout] Step:', sanitizeActionForLog(action));
        const result = await executeAgentAction(action);
        return result;
    } catch (error) {
        console.error('[Agent Checkout]', error.message);
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
    try {
        startSTTServer()
    } catch (error) {
        console.error("STT startup failed:", error)
    }
    try {
        createTray()
    } catch (error) {
        console.error("Tray startup failed:", error)
    }
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
