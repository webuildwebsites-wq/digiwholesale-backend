import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const getLinuxExecutablePath = () => {
    const candidates = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        process.env.CHROME_PATH,
    ].filter(Boolean);

    for (const p of candidates) {
        if (existsSync(p)) return p;
    }
    return null;
};

const generatePDF = async (html) => {
    let browser;

    if (process.platform === "linux") {
        const systemChrome = getLinuxExecutablePath();

        if (systemChrome) {
            browser = await puppeteer.launch({
                headless:       true,
                executablePath: systemChrome,
                args:           ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            });
        } else {
            const chromium = await import("@sparticuz/chromium");
            browser = await puppeteer.launch({
                args:           [...chromium.default.args, "--no-sandbox", "--disable-setuid-sandbox"],
                executablePath: await chromium.default.executablePath(),
                headless:       chromium.default.headless,
            });
        }
    } else if (process.platform === "darwin") {
        browser = await puppeteer.launch({
            headless:       true,
            executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        });
    } else {
        browser = await puppeteer.launch({
            headless:       true,
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
        format:          "A4",
        printBackground: true,
    });

    await browser.close();
    return pdfBuffer;
};

export default generatePDF;
