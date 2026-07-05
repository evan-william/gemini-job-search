# Compensation Benchmarks

Compensation benchmarking is optional, local-first, and currency-aware.

Create a private file:

```text
salary/benchmarks.json
```

Use this shape:

```json
{
  "metadata": {
    "source": "Personal research",
    "currency": "USD",
    "period": "annual",
    "note": "Do not commit private compensation data."
  },
  "companies": [
    {
      "company": "Example Corp",
      "location": "Remote",
      "roles": {
        "junior_ai_engineer": {
          "min": 60000,
          "mid": 80000,
          "max": 105000,
          "notes": "Public salary posts and recruiter calls"
        }
      }
    }
  ]
}
```

The private benchmark file is ignored by git.

For currency conversion, create another private file:

```text
salary/currency.json
```

Use `salary/currency.example.json` as the template and replace the example
rates with fresh rates. Rates are stored as USD-base values, for example:

```json
{
  "usdBaseRates": {
    "USD": 1,
    "IDR": 16200
  }
}
```

Run:

```bash
npm run salary
node src/cli.js salary --company "Example Corp" --target-currency IDR
```

The command keeps the original currency and adds an approximate converted
range when `--target-currency` is provided.

For scrape display preferences, create:

```text
salary/display.json
```

Use `salary/display.example.json` as the template, or run:

```bash
npm run currency:show
npm run change_currency:idr
npm run change_currency:eur
npm run change_currency:sgd
```

`display.json` controls the secondary currency shown in scrape output. It is
local and ignored by git.
