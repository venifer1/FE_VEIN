// Headless-Chrome smoke test: logs in, visits every route, captures console
// errors / page errors / failed requests, screenshots each. Uses the installed
// system Chrome via puppeteer-core. Run: node scripts/smoke.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
// 자격증명은 하드코딩하지 않는다. 환경변수로 주입한다:
//   VEIN_EMAIL=... VEIN_PW=... node scripts/smoke.mjs
const EMAIL = process.env.VEIN_EMAIL;
const PW = process.env.VEIN_PW;
if (!EMAIL || !PW) {
  console.error('VEIN_EMAIL / VEIN_PW 환경변수가 필요합니다. 예:');
  console.error('  VEIN_EMAIL=tester@example.local VEIN_PW=**** node scripts/smoke.mjs');
  process.exit(2);
}
const OUT = process.env.OUT || path.join(os.tmpdir(), 'vein_shots');

const ROUTES = [
  ['home', '/'],
  ['scanner', '/scanner'],
  ['news', '/news'],
  ['data', '/data'],
  ['admin', '/admin'],
  ['settings', '/settings'],
];

fs.mkdirSync(OUT, { recursive: true });

const errors = []; // {route, type, text}
function attach(page, routeRef) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push({ route: routeRef.v, type: 'console', text: m.text().slice(0, 300) });
  });
  page.on('pageerror', (e) => errors.push({ route: routeRef.v, type: 'pageerror', text: String(e.message).slice(0, 300) }));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.includes('/api/')) errors.push({ route: routeRef.v, type: 'reqfail', text: `${u} ${r.failure()?.errorText || ''}`.slice(0, 200) });
  });
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/api/') && res.status() >= 400) errors.push({ route: routeRef.v, type: 'http' + res.status(), text: u.slice(0, 200) });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=420,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });
  const routeRef = { v: 'login' };
  attach(page, routeRef);

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);
  try {
    await page.type('input[type="email"], input[name="email"]', EMAIL, { delay: 10 });
    await page.type('input[type="password"], input[name="password"]', PW, { delay: 10 });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    ]);
  } catch (e) {
    errors.push({ route: 'login', type: 'login-fail', text: String(e.message).slice(0, 200) });
  }
  await sleep(1500);
  await page.screenshot({ path: `${OUT}\\login.png` }).catch(() => {});

  // Visit routes
  for (const [name, path] of ROUTES) {
    routeRef.v = name;
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2500); // let polling + client render settle
      // Detect Next.js error overlay
      const overlay = await page.evaluate(() => {
        const t = document.body.innerText || '';
        return t.includes('Unhandled Runtime Error') || t.includes('Application error') ? t.slice(0, 200) : '';
      });
      if (overlay) errors.push({ route: name, type: 'overlay', text: overlay });
      await page.screenshot({ path: `${OUT}\\${name}.png`, fullPage: true }).catch(() => {});
    } catch (e) {
      errors.push({ route: name, type: 'nav', text: String(e.message).slice(0, 200) });
    }
  }

  // Exercise the condition-builder tab and its live on-demand scan endpoint.
  routeRef.v = 'condition-scanner';
  try {
    await page.goto(`${BASE}/scanner`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);
    const clicked = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((item) => item.textContent?.trim() === '조건검색');
      if (!button) return false;
      button.click();
      return true;
    });
    if (!clicked) {
      errors.push({ route: routeRef.v, type: 'missing-tab', text: 'Condition scanner tab not found' });
    } else {
      await sleep(500);
      const ran = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('button'))
          .find((item) => item.textContent?.trim() === '조건검색 실행');
        if (!button) return false;
        button.click();
        return true;
      });
      if (!ran) {
        errors.push({ route: routeRef.v, type: 'missing-run', text: 'Condition scan button not found' });
      }
      await sleep(2500);
      await page.screenshot({ path: `${OUT}\\condition_scanner.png`, fullPage: true }).catch(() => {});
    }
  } catch (e) {
    errors.push({ route: routeRef.v, type: 'nav', text: String(e.message).slice(0, 200) });
  }

  // Exercise liquidation aggregation cards and the live summary endpoint.
  routeRef.v = 'liquidation-summary';
  try {
    await page.goto(`${BASE}/data`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(500);
    const clicked = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((item) => item.textContent?.trim() === '청산');
      if (!button) return false;
      button.click();
      return true;
    });
    if (!clicked) {
      errors.push({ route: routeRef.v, type: 'missing-tab', text: 'Liquidation tab not found' });
    } else {
      await sleep(1500);
      const hasSummary = await page.evaluate(() => document.body.innerText.includes('시간대별 전체 청산'));
      if (!hasSummary) {
        errors.push({ route: routeRef.v, type: 'missing-summary', text: 'Liquidation summary cards not found' });
      }
      await page.screenshot({ path: `${OUT}\\liquidation_summary.png`, fullPage: true }).catch(() => {});
    }
  } catch (e) {
    errors.push({ route: routeRef.v, type: 'nav', text: String(e.message).slice(0, 200) });
  }

  // Follow one live signal from the scanner so detail-only APIs and panels are
  // covered by every smoke run.
  routeRef.v = 'signal-detail';
  try {
    await page.goto(`${BASE}/scanner`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1500);
    const signalPath = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a'))
        .find((a) => a.getAttribute('href')?.startsWith('/signals/'));
      return link?.getAttribute('href') || null;
    });
    if (signalPath) {
      await page.goto(`${BASE}${signalPath}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2500);
      await page.screenshot({ path: `${OUT}\\signal_detail.png`, fullPage: true }).catch(() => {});
    } else {
      errors.push({ route: routeRef.v, type: 'missing-link', text: 'No signal detail link found on scanner' });
    }
  } catch (e) {
    errors.push({ route: routeRef.v, type: 'nav', text: String(e.message).slice(0, 200) });
  }

  // Onboarding "시작하기" checklist on home (new user has undone steps → card shows).
  routeRef.v = 'onboarding';
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    const hasOnboarding = await page.evaluate(() => (document.body.innerText || '').includes('시작하기'));
    if (!hasOnboarding) {
      errors.push({ route: routeRef.v, type: 'missing-onboarding', text: 'Onboarding card not found on home' });
    }
    await page.screenshot({ path: `${OUT}\\onboarding.png`, fullPage: true }).catch(() => {});
  } catch (e) {
    errors.push({ route: routeRef.v, type: 'nav', text: String(e.message).slice(0, 200) });
  }

  // Exercise the notification digest card + its live GET /notifications/digest.
  routeRef.v = 'notification-digest';
  try {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    const hasDigest = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return t.includes('알림 요약') && t.includes('최근 24시간');
    });
    if (!hasDigest) {
      errors.push({ route: routeRef.v, type: 'missing-digest', text: 'Notification digest card not found' });
    }
    await page.screenshot({ path: `${OUT}\\notification_digest.png`, fullPage: true }).catch(() => {});
  } catch (e) {
    errors.push({ route: routeRef.v, type: 'nav', text: String(e.message).slice(0, 200) });
  }

  await browser.close();
  const summary = {};
  for (const e of errors) summary[e.route] = (summary[e.route] || 0) + 1;
  console.log('=== SMOKE RESULT ===');
  console.log('errors_total:', errors.length);
  console.log('by_route:', JSON.stringify(summary));
  for (const e of errors.slice(0, 40)) console.log(`[${e.route}] ${e.type}: ${e.text}`);
  console.log('screenshots:', OUT);
  process.exit(errors.length ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE CRASHED:', e);
  process.exit(2);
});
