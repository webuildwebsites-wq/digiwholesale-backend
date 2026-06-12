import puppeteer from "puppeteer-core";

const generatePDF = async (html) => {
    let browser;

    if (process.env.NODE_ENV === "production") {
        const chromium = await import("@sparticuz/chromium");
        browser = await puppeteer.launch({
            args:           chromium.default.args,
            executablePath: await chromium.default.executablePath(),
            headless:       chromium.default.headless,
        });
    } else {
        const executablePath =
            process.platform === "win32"
                ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
                : process.platform === "darwin"
                ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                : "/usr/bin/google-chrome";

        browser = await puppeteer.launch({
            headless:       true,
            executablePath,
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
