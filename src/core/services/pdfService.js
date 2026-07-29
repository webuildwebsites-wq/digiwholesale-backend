import puppeteer from "puppeteer-core";
import PQueue from "p-queue";
import { existsSync } from "fs";

let browser = null;
let idleTimer = null;

const queue = new PQueue({
    concurrency: 3,
});

const IDLE_TIMEOUT = 5 * 60 * 1000;

const getExecutablePath = () => {
    const candidates = [
        process.env.CHROME_PATH,
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
    ].filter(Boolean);

    for (const path of candidates) {
        if (existsSync(path)) {
            return path;
        }
    }

    throw new Error("Chrome/Chromium executable not found.");
};

const launchBrowser = async () => {
    if (browser && browser.connected) {
        return browser;
    }

    const executablePath =
        process.platform === "linux"
            ? getExecutablePath()
            : process.platform === "darwin"
            ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

    browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-features=site-per-process",
        ],
    });

    browser.on("disconnected", () => {
        console.warn("[PDF] Browser disconnected.");
        browser = null;
    });

    console.log("[PDF] Browser launched.");

    return browser;
};

const resetIdleTimer = () => {
    clearTimeout(idleTimer);

    idleTimer = setTimeout(async () => {
        if (!browser) return;

        try {
            await browser.close();
            console.log("[PDF] Idle browser closed.");
        } catch {}

        browser = null;
    }, IDLE_TIMEOUT);
};

export const initBrowserPool = async () => {
    await launchBrowser();
};

const generatePDFInternal = async (html) => {
    const browser = await launchBrowser();

    const page = await browser.newPage();

    try {
        await page.setContent(html, {
            waitUntil: "networkidle0",
        });

        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
        });

        return Buffer.from(pdf);
    } finally {
        await page.close();
        resetIdleTimer();
    }
};

const generatePDF = async (html) => {
    return queue.add(() => generatePDFInternal(html));
};

export default generatePDF;