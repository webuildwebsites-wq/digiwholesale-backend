import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

let browser;
let page;

const getLinuxExecutablePath = () => {
    const candidates = [
        process.env.CHROME_PATH,
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ].filter(Boolean);

    for (const path of candidates) {
        if (existsSync(path)) return path;
    }

    return null;
};

const getBrowser = async () => {

    if (browser?.connected) return browser;

    let executablePath;

    if (process.platform === "linux") {

        executablePath = getLinuxExecutablePath();

        if (!executablePath) {
            throw new Error("Chrome/Chromium not found.");
        }

    } else if (process.platform === "darwin") {

        executablePath =
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

    } else {

        executablePath =
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

    }

    browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--metrics-recording-only",
            "--mute-audio",
        ],
    });

    browser.on("disconnected", () => {
        browser = null;
        page = null;
    });

    return browser;
};

const getPage = async () => {

    if (page && !page.isClosed()) {
        return page;
    }

    const browser = await getBrowser();

    page = await browser.newPage();

    await page.setViewport({
        width: 1200,
        height: 1700,
    });

    return page;
};

const generatePDF = async (html) => {

    const page = await getPage();

    await page.setContent(html, {
        waitUntil: "domcontentloaded",
    });

    const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
};

export default generatePDF;