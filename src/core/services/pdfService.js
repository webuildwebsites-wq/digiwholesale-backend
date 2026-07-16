import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const POOL_SIZE  = 3;
const pool       = [];
let   initialised = false;

const getExecutablePath = () => {
    const candidates = [
        process.env.CHROME_PATH,
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
    ].filter(Boolean);
    for (const p of candidates) {
        if (existsSync(p)) return p;
    }
    return null;
};

const launchBrowser = async () => {
    const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];

    if (process.platform === "linux") {
        const systemChrome = getExecutablePath();
        if (systemChrome) {
            return puppeteer.launch({ headless: true, executablePath: systemChrome, args });
        }
        const chromium = await import("@sparticuz/chromium");
        return puppeteer.launch({
            args:           [...chromium.default.args, ...args],
            executablePath: await chromium.default.executablePath(),
            headless:       chromium.default.headless,
        });
    }
    if (process.platform === "darwin") {
        return puppeteer.launch({
            headless:       true,
            executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            args,
        });
    }
    return puppeteer.launch({
        headless:       true,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        args,
    });
};

export const initBrowserPool = async () => {
    if (initialised) return;
    initialised = true;
    console.log(`[BrowserPool] Initialising ${POOL_SIZE} browser(s)...`);
    for (let i = 0; i < POOL_SIZE; i++) {
        try {
            const browser = await launchBrowser();
            browser.on("disconnected", () => {
                const idx = pool.findIndex(e => e.browser === browser);
                if (idx !== -1) pool.splice(idx, 1);
                console.warn(`[BrowserPool] Browser ${i} disconnected — removing from pool`);
            });
            pool.push({ browser, busy: false });
            console.log(`[BrowserPool] Browser ${i + 1}/${POOL_SIZE} ready`);
        } catch (err) {
            console.error(`[BrowserPool] Failed to launch browser ${i}:`, err.message);
        }
    }
};

const acquireBrowser = async (retries = 10, delay = 300) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        const entry = pool.find(e => !e.busy && e.browser.connected);
        if (entry) {
            entry.busy = true;
            return entry;
        }
        await new Promise(r => setTimeout(r, delay));
    }
    const browser = await launchBrowser();
    const entry   = { browser, busy: true, temp: true };
    pool.push(entry);
    return entry;
};

const releaseBrowser = (entry) => {
    if (entry.temp) {
        const idx = pool.indexOf(entry);
        if (idx !== -1) pool.splice(idx, 1);
        entry.browser.close().catch(() => {});
    } else {
        entry.busy = false;
    }
};

const generatePDF = async (html) => {
    const entry = await acquireBrowser();
    const page  = await entry.browser.newPage();
    try {
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
        return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    } finally {
        await page.close();
        releaseBrowser(entry);
    }
};

export default generatePDF;
