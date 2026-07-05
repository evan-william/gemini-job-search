import { mkdir, readFile, writeFile } from "node:fs/promises";

const displayPath = "salary/display.json";
const examplePath = "salary/display.example.json";
const currencyPath = "salary/currency.json";
const currencyExamplePath = "salary/currency.example.json";
const args = process.argv.slice(2);
const command = args[0] || "--show";

const currencyConfig = await readJsonFallback(currencyPath, currencyExamplePath);
const supported = Object.keys(currencyConfig.usdBaseRates || {}).sort();

if (command === "--list" || command === "list") {
  console.log(`Supported currencies: ${supported.join(", ")}`);
  process.exit(0);
}

if (command === "--show" || command === "show") {
  const display = await readDisplay();
  printDisplay(display, supported);
  process.exit(0);
}

const display = await readDisplay();
const mode = args.includes("--primary")
  ? "primaryCurrency"
  : args.includes("--prefer")
    ? "preferCurrency"
    : "secondaryCurrency";
const currency = normalizeCurrency(command);

if (!currency || !supported.includes(currency)) {
  console.error(`Unsupported currency: ${command}`);
  console.error(`Supported currencies: ${supported.join(", ")}`);
  process.exit(1);
}

const next = { ...display, [mode]: currency };
await mkdir("salary", { recursive: true });
await writeFile(displayPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

console.log(`Updated ${displayPath}`);
printDisplay(next, supported);

async function readDisplay() {
  const defaults = {
    primaryCurrency: "USD",
    secondaryCurrency: "IDR",
    preferCurrency: "USD"
  };
  try {
    return { ...defaults, ...JSON.parse(await readFile(displayPath, "utf8")) };
  } catch {
    try {
      return { ...defaults, ...JSON.parse(await readFile(examplePath, "utf8")) };
    } catch {
      return defaults;
    }
  }
}

async function readJsonFallback(primary, fallback) {
  try {
    return JSON.parse(await readFile(primary, "utf8"));
  } catch {
    return JSON.parse(await readFile(fallback, "utf8"));
  }
}

function normalizeCurrency(value) {
  return String(value || "").trim().toUpperCase();
}

function printDisplay(display, supported) {
  console.log(`Primary currency: ${display.primaryCurrency}`);
  console.log(`Secondary currency: ${display.secondaryCurrency}`);
  console.log(`Preferred pay currency: ${display.preferCurrency}`);
  console.log(`Supported currencies: ${supported.join(", ")}`);
}
