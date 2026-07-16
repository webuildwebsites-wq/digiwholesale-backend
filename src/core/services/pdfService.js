import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

let browserInstance = null;

const getLinuxExecutablePath = () => {
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

const getBrowser = async () => {
    if (browserInstance && browserInstance.connected) return browserInstance;

    if (process.platform === "linux") {
        const systemChrome = getLinuxExecutablePath();

        if (systemChrome) {
            browserInstance = await puppeteer.launch({
                headless:       true,
                executablePath: systemChrome,
                args:           ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            });
        } else {
            const chromium = await import("@sparticuz/chromium");
            browserInstance = await puppeteer.launch({
                args:           [...chromium.default.args, "--no-sandbox", "--disable-setuid-sandbox"],
                executablePath: await chromium.default.executablePath(),
                headless:       chromium.default.headless,
            });
        }
    } else if (process.platform === "darwin") {
        browserInstance = await puppeteer.launch({
            headless:       true,
            executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        });
    } else {
        browserInstance = await puppeteer.launch({
            headless:       true,
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        });
    }

    browserInstance.on("disconnected", () => { browserInstance = null; });

    return browserInstance;
};

const generatePDF = async (html) => {
    const browser = await getBrowser();
    const page    = await browser.newPage();

    try {
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
        return Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    } finally {
        await page.close();
    }
};

export default generatePDF;
