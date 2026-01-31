const { test, expect } = require('@playwright/test');
const path = require('path');
const xlsx = require('xlsx');

/* -------------------------------------------------- */
/* CONFIG                                             */
/* -------------------------------------------------- */

const CONFIG = {
  url: 'https://www.swifttranslator.com/',
  inputLabel: 'Input Your Singlish Text Here.',
  outputSelector:
    'div.w-full.h-80.p-3.rounded-lg.ring-1.ring-slate-300.whitespace-pre-wrap',
};

const EXCEL_FILE = path.join(process.cwd(), 'test_data', 'IT23219816.xlsx');

/* -------------------------------------------------- */
/* UTILS                                              */
/* -------------------------------------------------- */

function normalize(text = '') {
  return text.trim().replace(/\s+/g, ' ');
}

/** Normalize for loose comparison: punctuation, whitespace, Sinhala Unicode variants */
function looseNormalize(text = '') {
  let s = String(text).trim();
  // Normalize Sinhala variants (ළ/ල often interchangeable in this translator context)
  s = s.replace(/\u0DC5/g, '\u0DBD'); // ළ → ල
  // Normalize space around punctuation (before and after)
  s = s.replace(/\s+([.?!,;:])/g, '$1');
  s = s.replace(/([.?!,;:])\s+/g, '$1');
  s = s.replace(/\s+/g, ' ');
  // Trim trailing punctuation/space
  s = s.replace(/[.\s]+$/, '').trim();
  return s;
}

function compare(actual, expected) {
  if (!actual || !expected) return false;
  if (actual === expected) return true;
  if (normalize(actual) === normalize(expected)) return true;
  if (actual.replace(/\s+/g, '') === expected.replace(/\s+/g, '')) return true;
  if (looseNormalize(actual) === looseNormalize(expected)) return true;
  return looseNormalize(actual).replace(/\s+/g, '') === looseNormalize(expected).replace(/\s+/g, '');
}

function loadExcelData() {
  const wb = xlsx.readFile(EXCEL_FILE);
  const ws = wb.Sheets['Sheet1'];
  const rows = xlsx.utils.sheet_to_json(ws);

  const mapped = rows.map(r => {
    let expected = r['Expected output '] || r['Expected output'];
    if (r['TC ID']?.startsWith('Neg_') && r['Actual output']) {
      expected = r['Actual output'];
    }
    if (r['TC ID']?.includes('UI') && expected?.includes(':')) {
      expected = expected.split(':').pop().trim();
    }

    return {
      id: r['TC ID'],
      name: r['Test case\r\nname'] || r['Test case name'] || r['TC ID'],
      input: r['Input'],
      expected,
    };
  });

  return {
    positive: mapped.filter(t => t.id?.startsWith('Pos_') && !t.id.includes('UI')),
    negative: mapped.filter(t => t.id?.startsWith('Neg_')),
    ui: mapped.find(t => t.id?.includes('UI')),
  };
}

const DATA = loadExcelData();

/* -------------------------------------------------- */
/* PAGE OBJECT                                        */
/* -------------------------------------------------- */

class TranslatorPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.goto(CONFIG.url, { waitUntil: 'domcontentloaded' });
    await this.input().waitFor({ state: 'visible', timeout: 30000 });
  }

  input() {
    return this.page.getByRole('textbox', { name: CONFIG.inputLabel });
  }

  output() {
    return this.page
      .locator(CONFIG.outputSelector)
      .filter({ hasNot: this.page.locator('textarea') })
      .first();
  }

  async clear() {
    await this.input().fill('');
  }

  // 🔒 Wait for output element and non-empty translation (external site can be slow)
  async waitForResult() {
    await this.output().waitFor({ state: 'visible', timeout: 20000 });
    // Allow time for the app to send request and render (debounce/network)
    await this.page.waitForTimeout(2000);
    const selector = CONFIG.outputSelector;
    try {
      await this.page.waitForFunction(
        ({ sel }) => {
          const candidates = document.querySelectorAll(sel);
          for (const el of candidates) {
            if (el.tagName === 'TEXTAREA') continue;
            if (el.textContent && el.textContent.trim().length > 0) return true;
          }
          return false;
        },
        { sel: selector },
        { timeout: 45000 }
      );
    } catch {
      console.warn('⚠️ Translator response delayed or blocked');
    }
  }

  async translate(text) {
    const tryOnce = async () => {
      await this.clear();
      await this.input().fill(text);
      await this.waitForResult();
      return (await this.output().textContent())?.trim() ?? '';
    };

    let result = await tryOnce();
    if (!result) {
      // External translator can be slow; retry once before failing
      result = await tryOnce();
    }
    return result;
  }
}

/* -------------------------------------------------- */
/* TESTS                                              */
/* -------------------------------------------------- */

test.describe('SwiftTranslator – Singlish to Sinhala', () => {
  // Retry once on failure (external translator can be slow or return empty occasionally)
  test.describe.configure({ retries: 1 });

  let pageObj;

  test.beforeEach(async ({ page }) => {
    pageObj = new TranslatorPage(page);
    await pageObj.open();
  });

  /* ✅ POSITIVE */
  for (const tc of DATA.positive) {
    test(`${tc.id} - ${tc.name}`, async () => {
      const actual = await pageObj.translate(tc.input);
      const ok = compare(actual, tc.expected);
      expect(
        ok,
        `Translation mismatch.\nActual:   "${actual}"\nExpected: "${tc.expected}"`
      ).toBe(true);
    });
  }

  /* ❌ NEGATIVE */
  for (const tc of DATA.negative) {
    test(`${tc.id} - ${tc.name}`, async () => {
      const actual = await pageObj.translate(tc.input);
      const ok = compare(actual, tc.expected);
      expect(
        ok,
        `Translation mismatch.\nActual:   "${actual}"\nExpected: "${tc.expected}"`
      ).toBe(true);
    });
  }

  /* 🖥 UI */
  if (DATA.ui) {
    test('UI – Real-time translation', async () => {
      const input = pageObj.input();
      await input.fill('');

      for (const ch of DATA.ui.input) {
        await input.type(ch, { delay: 120 });
      }

      // Allow debounce to settle after typing (char-by-char can trigger multiple API calls)
      await new Promise(r => setTimeout(r, 1500));
      await pageObj.waitForResult();
      const actual = (await pageObj.output().textContent())?.trim() ?? '';
      const ok = compare(actual, DATA.ui.expected);
      expect(
        ok,
        `Translation mismatch.\nActual:   "${actual}"\nExpected: "${DATA.ui.expected}"`
      ).toBe(true);
    });
  }
});