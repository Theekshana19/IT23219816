# Playwright – Swift Translator (Singlish to Sinhala)

Automated end-to-end tests for the Swift Translator web application (https://www.swifttranslator.com/), validating Singlish-to-Sinhala translation functionality using Playwright.

## Prerequisites

- **Node.js** (LTS recommended) – [Download](https://nodejs.org/)
- **npm** (included with Node.js)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd IT23219816
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers** (required for first run)
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Run all tests (headless)
```bash
npm test
```
or
```bash
npx playwright test
```

### Run tests in headed mode (visible browser)
```bash
npx playwright test --headed
```

### Run with UI mode (interactive)
```bash
npx playwright test --ui
```

### View HTML report after a run
```bash
npx playwright show-report
```

## Project Structure

```
IT23219816/
├── tests/
│   ├── swift-translator-tests.spec.js   # Main test suite
│   └── example.spec.js                  # Example tests
├── test_data/
│   └── IT23219816.xlsx                 # Test case data (inputs & expected outputs)
├── .github/workflows/
│   └── playwright.yml                  # CI workflow (GitHub Actions)
├── playwright.config.js                # Playwright configuration
├── package.json
└── README.md
```

## Test Configuration

- **Browser:** Chromium only
- **Workers:** 1 (sequential execution to avoid overloading the external translator)
- **Timeout:** 90 seconds per test
- **Test data:** Loaded from `test_data/IT23219816.xlsx`

## Notes

- Tests require an internet connection (they target a live external website).
- The translator can be slow; tests include retries and extended timeouts.
- Ensure `test_data/IT23219816.xlsx` exists and contains the required sheets (e.g. `Sheet1` with columns: TC ID, Input, Expected output).
