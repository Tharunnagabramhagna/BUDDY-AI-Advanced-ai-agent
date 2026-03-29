import sys

NEW_FUNC = r'''async function executeAgentAction(action) {
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

        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });

        page = await browser.newPage();
        global.activePage = page;

        browser.on('disconnected', () => {
            if (global.activePage === page) {
                global.activePage = null;
                console.log('[Agent] Browser closed — session ended');
            }
        });
    }

    const checkLoginBreak = async () => {
        const needsLogin = await detectLoginRequirement(page);
        if (needsLogin) {
            console.log('[Agent] Login wall detected, pausing automation');
            throw new Error('LOGIN_REQUIRED');
        }
    };

    try {
        console.log('[Agent] Executing action type:', action.type);

        // ── Checkout / poll steps (operate on existing page, return directly) ──
        if (action.type === 'amazon_goto_checkout') {
            try {
                await page.goto('https://www.amazon.in/gp/cart/view.html', { waitUntil: 'networkidle2', timeout: 15000 });
                const proceedBtn = await page.$('#sc-buy-box-ptc-button, [name="proceedToRetailCheckout"], input[name="proceedToRetailCheckout"]');
                if (proceedBtn) {
                    await proceedBtn.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                } else {
                    await page.evaluate(() => {
                        const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                        const btn = btns.find(b => b.textContent.includes('Proceed to Buy') || b.textContent.includes('Proceed to Checkout'));
                        if (btn) btn.click();
                    });
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                }
                const currentUrl = page.url();
                const needsLogin = currentUrl.includes('signin') || currentUrl.includes('ap/signin') || currentUrl.includes('ap/login');
                let addressMissing = false;
                if (!needsLogin) {
                    addressMissing = await page.evaluate(() =>
                        document.body.innerText.includes("Add delivery address") ||
                        !!document.querySelector("input[name='address-ui-widgets-enterAddressFullName']")
                    );
                }
                if (addressMissing) {
                    console.log("[Agent] Address required - waiting for user");
                    return { success: false, addressRequired: true, currentUrl, message: "Please add a delivery address in the browser to continue." };
                }
                return { success: true, needsLogin, currentUrl, message: needsLogin ? 'Login required' : 'Reached checkout' };
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

        if (action.type === 'amazon_select_payment') {
            try {
                await page.waitForSelector('.payment-method, #pmts-form, .a-section', { timeout: 15000 }).catch(() => {});
                const { method } = action;
                await page.evaluate((method) => {
                    const labels = Array.from(document.querySelectorAll('label, span, div, input'));
                    const termMap = {
                        cod: ['Cash on Delivery', 'Pay on Delivery'],
                        upi: ['UPI'],
                        card: ['Credit', 'Debit', 'Credit/Debit'],
                        netbanking: ['Net Banking', 'NetBanking'],
                        amazonpay: ['Amazon Pay'],
                    };
                    const terms = termMap[method] || [];
                    const el = labels.find(l => terms.some(t => l.textContent.includes(t)));
                    if (el) el.click();
                }, method);
                if (method === 'upi' && action.upiId) {
                    await page.waitForSelector('input[placeholder*="UPI"], input[name*="upi"]', { timeout: 5000 }).catch(() => {});
                    const upiInput = await page.$('input[placeholder*="UPI"], input[name*="upi"]');
                    if (upiInput) await upiInput.type(action.upiId, { delay: 50 });
                }
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
                    const cont = btns.find(b =>
                        b.textContent.includes('Use this payment') ||
                        b.textContent.includes('Continue') ||
                        (b.getAttribute?.('id') || '').includes('continue') ||
                        (b.getAttribute?.('name') || '').includes('continue')
                    );
                    if (cont) cont.click();
                });
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
                return { success: true, paymentSelected: method };
            } catch (err) { return { success: false, error: err.message }; }
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
                    const cards = document.querySelectorAll('[data-component-type="s-search-result"]');
                    const results = [];
                    cards.forEach(card => {
                        const priceEl = card.querySelector('.a-price .a-offscreen') ||
                                        card.querySelector('.a-price-whole') ||
                                        card.querySelector('[data-a-color="price"] .a-offscreen');
                        const linkEl = card.querySelector('h2 a[href*="/dp/"]') ||
                                       card.querySelector('a[href*="/dp/"]');
                        const ratingEl = card.querySelector('.a-icon-alt');
                        if (!linkEl) return;
                        let price = null;
                        if (priceEl) {
                            const parsed = parseFloat(priceEl.textContent.replace(/[,\s\u20B9]/g, '').trim());
                            if (!isNaN(parsed)) price = parsed;
                        }
                        let rating = 0;
                        if (ratingEl) {
                            const m = ratingEl.textContent.match(/([\d.]+)\s*out of/);
                            if (m) rating = parseFloat(m[1]);
                            else { const p = parseFloat(ratingEl.textContent); if (!isNaN(p)) rating = p; }
                        }
                        results.push({
                            url: linkEl.href,
                            price,
                            rating,
                            title: card.querySelector('h2')?.textContent?.trim() || 'Unknown product'
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
                    return { success: false, needsSelection: true, options: validProducts.slice(0, 5) };
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
            console.log('[Agent] Navigating to Flipkart search...');
            await page.goto('https://www.flipkart.com/search?q=' + encodeURIComponent(action.query), { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 2500));
            await checkLoginBreak();
            const productUrl = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
                for (const link of links) {
                    if (link.offsetWidth > 0 && link.offsetHeight > 0 && link.href) return link.href;
                }
                return null;
            });
            if (productUrl) {
                await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2500));
                await checkLoginBreak();
                await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    for (const btn of btns) {
                        if (btn.innerText.toLowerCase().includes('add to cart') && btn.offsetWidth > 0) {
                            btn.scrollIntoView({ block: 'center' });
                            btn.click();
                            return;
                        }
                    }
                });
                await new Promise(r => setTimeout(r, 2000));
                await checkLoginBreak();
            }
            return { success: true, message: 'Done!' };
        }

        // ── Food ──────────────────────────────────────────────────────────────
        if (action.type === 'zomato_search' || action.type === 'swiggy_search') {
            const url = action.type === 'zomato_search'
                ? 'https://www.zomato.com/search?q=' + encodeURIComponent(action.query)
                : 'https://www.swiggy.com/search?query=' + encodeURIComponent(action.query);
            await page.goto(url, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 1200));
            await checkLoginBreak();
            await automateFoodOrder(page, checkLoginBreak);
            return { success: true, message: 'Done!' };
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
        console.error('[Agent] Error:', err.message);
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

'''

content = open(r'c:\Users\tarun\OneDrive\Desktop\BUDDY-AI\electron\main.cjs', 'r', encoding='utf-8').read()
start_marker = 'async function executeAgentAction(action) {'
end_marker = '\nconst API_KEY = process.env.VITE_GEMINI_API_KEY'
start_idx = content.index(start_marker)
end_idx = content.index(end_marker)
new_content = content[:start_idx] + NEW_FUNC + content[end_idx:]
open(r'c:\Users\tarun\OneDrive\Desktop\BUDDY-AI\electron\main.cjs', 'w', encoding='utf-8').write(new_content)
print('Done. New file size:', len(new_content))
