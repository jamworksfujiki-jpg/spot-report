/**
 * Google Cloud Console 操作補助
 * - 新規 Edge プロファイルで Cloud Console を開く
 * - 各ステップで Enter を押すとスクリーンショットを撮影してファイル保存
 * - ターミナル指示に従ってクリックしてもらう
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(__dirname, '../../.reporting-auth');
const PROFILE_DIR = path.join(AUTH_DIR, 'edge-profile-cloud');
const SCREENSHOT_DIR = path.join(AUTH_DIR, 'cloud-screenshots');

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

console.log('🌐 Google Cloud Console を Edge で開きます（新規プロファイル）...');
const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  channel: 'msedge',
  viewport: { width: 1440, height: 900 },
  locale: 'ja-JP',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // @ts-ignore
  if (!window.chrome) window.chrome = { runtime: {} };
});

const page = context.pages()[0] || (await context.newPage());
await page.goto('https://console.cloud.google.com/', { waitUntil: 'domcontentloaded' });

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ブラウザで Cloud Console が開きました');
console.log('  以下のターミナルに従って進めてください');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) {
  return new Promise((r) => rl.question(q, (a) => r(a)));
}

let stepNo = 0;
async function snap(name) {
  stepNo++;
  const file = path.join(SCREENSHOT_DIR, `${String(stepNo).padStart(2, '0')}-${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    console.log(`📸 保存: ${file}`);
    console.log(`   現在URL: ${page.url()}`);
  } catch (e) {
    console.warn(`⚠️  スクショ失敗: ${e.message}`);
  }
  return file;
}

// 対話ループ: ユーザーがEnter押すたびにスクショ
while (true) {
  const cmd = await ask(
    '\n[Enter] スクショ撮影 / [s 名前] 名前指定で撮影 / [u URL] URL移動 / [q] 終了 > '
  );
  if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') break;
  if (cmd.startsWith('u ')) {
    const url = cmd.slice(2).trim();
    console.log(`➡️  ${url} に移動`);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((e) => console.warn(e.message));
    continue;
  }
  if (cmd.startsWith('s ')) {
    const name = cmd.slice(2).trim().replace(/\s+/g, '-');
    await snap(name);
    continue;
  }
  await snap('step');
}

rl.close();
await context.close();
console.log('セッション終了');
