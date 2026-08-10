import puppeteer from "puppeteer-core";
import PQueue from "p-queue";
import { existsSync } from "fs";

let browser = null;
let idleTimer = null;

const queue = new PQueue({ concurrency: 2 });
const IDLE_TIMEOUT = 5 * 60 * 1000;

const MAC_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const LINUX_CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/snap/bin/chromium",
].filter(Boolean);

const getExecutablePath = async () => {
  if (process.platform === "darwin") {
    for (const p of MAC_CHROME_PATHS) {
      if (existsSync(p)) {
        console.log("[PDF] Mac Chrome at:", p);
        return { executablePath: p, args: [] };
      }
    }
    throw new Error("Chrome not found on Mac. Install Google Chrome.");
  }

  if (process.platform === "linux") {
    for (const p of LINUX_CHROME_PATHS) {
      if (existsSync(p)) {
        console.log("[PDF] Linux Chrome at:", p);
        return {
          executablePath: p,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        };
      }
    }

    try {
      const chromium = await import("@sparticuz/chromium");
      const executablePath = await chromium.default.executablePath();
      console.log("[PDF] Using @sparticuz/chromium at:", executablePath);
      return {
        executablePath,
        args: chromium.default.args,
      };
    } catch {
      throw new Error(
        `Chrome/Chromium not found on server. ` +
        `Install chromium: sudo apt-get install -y chromium-browser ` +
        `OR set CHROME_PATH in .env ` +
        `OR install @sparticuz/chromium package.`
      );
    }
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
};

const launchBrowser = async () => {
  if (browser && browser.connected) return browser;

  const { executablePath, args } = await getExecutablePath();

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args,
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
    try { await browser.close(); } catch {}
    browser = null;
    console.log("[PDF] Idle browser closed.");
  }, IDLE_TIMEOUT);
};

export const initBrowserPool = async () => {
  await launchBrowser();
};

const generatePDFInternal = async (html) => {
  const b    = await launchBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      format:            "A4",
      printBackground:   true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
    resetIdleTimer();
  }
};

const generatePDF = (html) => queue.add(() => generatePDFInternal(html));

export default generatePDF;
