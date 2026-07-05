import { readText } from "./files.js";

const SYMBOLS = {
  "$": "USD",
  "US$": "USD",
  "Rp": "IDR",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY"
};

const PERIODS = [
  ["hourly", /\b(hourly|per hour|\/hr|\/hour)\b/i],
  ["monthly", /\b(monthly|per month|\/mo|\/month|bulan)\b/i],
  ["annual", /\b(annual|annually|yearly|per year|\/yr|\/year)\b/i]
];

export async function readCurrencyConfig() {
  try {
    return JSON.parse(await readText("salary/currency.json"));
  } catch {
    return JSON.parse(await readText("salary/currency.example.json"));
  }
}

export function normalizeCurrency(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (SYMBOLS[raw]) return SYMBOLS[raw];
  const upper = raw.toUpperCase();
  if (upper === "RP") return "IDR";
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return "";
}

export function extractCompensation(text) {
  const compact = String(text || "").replace(/\s+/g, " ");
  const currency = "USD|IDR|EUR|GBP|SGD|AUD|CAD|JPY|INR|MYR|Rp|US\\$|\\$|€|£|¥";
  const suffix = "k|m|jt|juta|million|rb|ribu";
  const number = "[0-9][0-9.,]*";
  const separator = "(?:-|to|–|—)";

  const minSuffix = `(?<minSuffix>${suffix})?(?![a-z])`;
  const maxSuffix = `(?<maxSuffix>${suffix})?(?![a-z])`;
  const currencyFirst = new RegExp(`(?<currency>${currency})\\s*(?<min>${number})\\s*${minSuffix}\\s*${separator}\\s*(?:${currency}\\s*)?(?<max>${number})\\s*${maxSuffix}`, "i");
  const numberFirst = new RegExp(`(?<min>${number})\\s*${minSuffix}\\s*${separator}\\s*(?<max>${number})\\s*${maxSuffix}\\s*(?<currency>${currency})`, "i");

  let match = compact.match(currencyFirst);
  if (match) {
    const sourceCurrency = normalizeCurrency(match.groups.currency);
    const minSuffix = match.groups.minSuffix || match.groups.maxSuffix;
    const maxSuffix = match.groups.maxSuffix || match.groups.minSuffix;
    return makeCompensation({
      raw: match[0],
      currency: sourceCurrency,
      min: parseAmount(match.groups.min, minSuffix),
      max: parseAmount(match.groups.max, maxSuffix),
      period: detectPeriod(compact)
    });
  }

  match = compact.match(numberFirst);
  if (match) {
    const sourceCurrency = normalizeCurrency(match.groups.currency);
    const minSuffix = match.groups.minSuffix || match.groups.maxSuffix;
    const maxSuffix = match.groups.maxSuffix || match.groups.minSuffix;
    return makeCompensation({
      raw: match[0],
      currency: sourceCurrency,
      min: parseAmount(match.groups.min, minSuffix),
      max: parseAmount(match.groups.max, maxSuffix),
      period: detectPeriod(compact)
    });
  }

  return null;
}

export function convertRange(range, targetCurrency, config) {
  const target = normalizeCurrency(targetCurrency);
  const source = normalizeCurrency(range?.currency);
  const rates = config?.usdBaseRates || {};
  if (!target || !source || !rates[source] || !rates[target]) return null;
  const toTarget = (amount) => (amount / rates[source]) * rates[target];
  return {
    currency: target,
    min: Math.round(toTarget(range.min)),
    max: Math.round(toTarget(range.max)),
    period: range.period || ""
  };
}

export function formatCompensation(compensation, options = {}) {
  if (!compensation) return "Not listed";
  const original = formatRange(compensation);
  const target = normalizeCurrency(options.targetCurrency);
  const converted = target && target !== compensation.currency
    ? convertRange(compensation, target, options.config)
    : null;
  if (!converted) return original;
  return `${original} / approx ${formatRange(converted)}`;
}

export function formatRange(range) {
  const period = range.period ? ` ${range.period}` : "";
  return `${formatMoney(range.min, range.currency)} - ${formatMoney(range.max, range.currency)}${period}`;
}

export function formatMoney(amount, currency) {
  const code = normalizeCurrency(currency) || currency || "";
  const rounded = code === "IDR" || code === "JPY"
    ? Math.round(amount)
    : Math.round(amount / 100) * 100;
  return `${code} ${rounded.toLocaleString("en-US")}`;
}

function makeCompensation(value) {
  if (!value.currency || !Number.isFinite(value.min) || !Number.isFinite(value.max)) return null;
  return value.min <= value.max ? value : { ...value, min: value.max, max: value.min };
}

function parseAmount(value, suffix) {
  let cleaned = String(value).trim();
  cleaned = cleaned.replace(/[,.](?=\d{3}(\D|$))/g, "");
  cleaned = cleaned.replace(/,/g, "");
  let amount = Number.parseFloat(cleaned);
  const unit = String(suffix || "").toLowerCase();
  if (["k", "rb", "ribu"].includes(unit)) amount *= 1000;
  if (["m", "jt", "juta", "million"].includes(unit)) amount *= 1000000;
  return amount;
}

function detectPeriod(text) {
  for (const [period, pattern] of PERIODS) {
    if (pattern.test(text)) return period;
  }
  return "";
}
