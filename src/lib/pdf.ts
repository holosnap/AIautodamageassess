import "server-only";
import type { Browser } from "puppeteer-core";
import { renderReportHtml, type ReportPdfInput } from "@/lib/pdf-template";

const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.AWS_EXECUTION_ENV,
);

async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    // Vercel / AWS Lambda: no bundled browser binary fits in the deployment
    // package, so use the lambda-optimized Chromium build.
    const { default: chromium } = await import("@sparticuz/chromium");
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local development / traditional server: full `puppeteer` ships its own
  // Chrome binary, which is simpler than wiring up a system Chrome path.
  // `--no-sandbox` is required when the process runs as root (common in
  // containers/CI); Chrome refuses to start without it in that case.
  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Browser;
}

export async function generateReportPdf(input: ReportPdfInput): Promise<Buffer> {
  const html = renderReportHtml(input);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "a4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
