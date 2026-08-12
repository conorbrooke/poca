#!/usr/bin/env node
/**
 * Generates category-rules.ie.json from patterns found in the user's transactions.
 * Run: node scripts/generate-category-rules.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rows = execSync(
  `PGPASSWORD=poca psql -h localhost -U poca -d poca -t -A -F '|' -c "SELECT UPPER(description), COUNT(*) FROM \\"Transaction\\" WHERE amount < 0 GROUP BY 1"`,
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [description, count] = line.split("|");
    return { description, count: Number(count) };
  });

/** Order matters — first match wins (more specific rules should come first). */
const ruleDefinitions = [
  { category: "Bank Fees", payee: "FX / card fee", patterns: ["NEPOSCHG", "NECLSCHG", "GOVT DUTY"] },
  { category: "Income", payee: "Salary", patterns: ["SALARY"] },
  { category: "Transfers", payee: "Revolut transfer", patterns: ["REVOLUT**"] },
  { category: "Transfers", payee: "Bank transfer", patterns: ["TO A/C", "TPP CONOR BROOKE", "B365 DAD NEW ACCOU"] },
  { category: "ATM", payee: "Cash withdrawal", patterns: ["ATMD ", "ATM15", "ATM23", "ATM25", "ATM28"] },
  { category: "Insurance", payee: "AXA Insurance", patterns: ["AXA INSURANC"] },
  { category: "Utilities", payee: "Electric Ireland", patterns: ["ELECTRIC PI"] },
  { category: "Utilities", payee: "Tesco Mobile", patterns: ["TESCO MOBILE"] },
  { category: "Subscriptions", payee: "Spotify", patterns: ["SPOTIFY"] },
  { category: "Subscriptions", payee: "Cursor", patterns: ["CURSOR, AI"] },
  { category: "Subscriptions", payee: "OpenAI", patterns: ["OPENAI *CHAT"] },
  { category: "Subscriptions", payee: "Apple", patterns: ["APPLE.COM/BI"] },
  { category: "Restaurants", payee: "Just Eat", patterns: ["JUST EAT"] },
  { category: "Restaurants", payee: "Rite Bite", patterns: ["RITE BITE"] },
  { category: "Restaurants", payee: "Thuisbezorgd", patterns: ["THUISBEZORGD"] },
  { category: "Restaurants", payee: "Domino's", patterns: ["DOMINO'S PIZ"] },
  { category: "Restaurants", payee: "Supermac's", patterns: ["SUPERMACS"] },
  { category: "Restaurants", payee: "JD Wetherspoon", patterns: ["JD WETHERSPO"] },
  { category: "Restaurants", payee: "The Railway", patterns: ["THE RAILWAY"] },
  { category: "Restaurants", payee: "The Anvil", patterns: ["THE ANVIL"] },
  { category: "Restaurants", payee: "The Garavogue", patterns: ["THE GARAVOG"] },
  { category: "Restaurants", payee: "Madigan's", patterns: ["MADIGAN EVE"] },
  { category: "Restaurants", payee: "Bad Bobs", patterns: ["BAD BOBS"] },
  { category: "Restaurants", payee: "Vibe Bar", patterns: ["VIBE BAR"] },
  { category: "Restaurants", payee: "Beach Club", patterns: ["BEACH CLUB"] },
  { category: "Restaurants", payee: "Goa", patterns: ["GOA BV"] },
  { category: "Restaurants", payee: "The Strand", patterns: ["THE STRAND"] },
  { category: "Restaurants", payee: "TP Smiths", patterns: ["TP SMITHS"] },
  { category: "Restaurants", payee: "Awesome Walls", patterns: ["AWESOME WAL"] },
  { category: "Restaurants", payee: "Gaelic Corner", patterns: ["GAELIC CORN"] },
  { category: "Restaurants", payee: "S&E Food Tavern", patterns: ["S&E F. TAVE"] },
  { category: "Restaurants", payee: "RTE Youth Bar", patterns: ["RTE. Y BARE"] },
  { category: "Restaurants", payee: "Apache Pizza", patterns: ["MOL*APACHE", "APACHE P"] },
  { category: "Restaurants", payee: "Dines", patterns: ["DINES* DUBX"] },
  { category: "Restaurants", payee: "Oriental Kitchen", patterns: ["ORIENTAL NEW"] },
  { category: "Restaurants", payee: "Junction 14", patterns: ["JUNCTION 14"] },
  { category: "Restaurants", payee: "Quinlan's", patterns: ["QUINLAN"] },
  { category: "Restaurants", payee: "Griffins", patterns: ["GRIFFINS"] },
  { category: "Restaurants", payee: "Zontafs", patterns: ["ZONTAFS", "SP ZONTAFS"] },
  { category: "Restaurants", payee: "Alexandra Deli", patterns: ["ALEXANDRA DE"] },
  { category: "Restaurants", payee: "Hotel Apple", patterns: ["HOTEL APPLE"] },
  { category: "Groceries", payee: "Tesco", patterns: ["TESCO STORE", "TESCO PARKI"] },
  { category: "Groceries", payee: "Dunnes", patterns: ["DUNNES"] },
  { category: "Groceries", payee: "Lidl", patterns: ["LIDL IRELAN", "LIDL IREL"] },
  { category: "Groceries", payee: "Spar", patterns: ["SPAR "] },
  { category: "Groceries", payee: "SuperValu", patterns: ["SUPERVALU"] },
  { category: "Groceries", payee: "Gala", patterns: ["GALA KILLEN", "GALA "] },
  { category: "Fuel", payee: "Maxol", patterns: ["MAXOL"] },
  { category: "Fuel", payee: "Circle K", patterns: ["CIRCLE K"] },
  { category: "Fuel", payee: "Applegreen", patterns: ["APPLEGREEN"] },
  { category: "Fuel", payee: "Inver Energy", patterns: ["INVER ENERG"] },
  { category: "Transport", payee: "Uber", patterns: ["UBR* PENDING", "UBR*"] },
  { category: "Transport", payee: "Irish Rail", patterns: ["IRISH RAIL"] },
  { category: "Transport", payee: "City Bus", patterns: ["CITI BUS"] },
  { category: "Transport", payee: "eFlow", patterns: ["EFLOW.IE"] },
  { category: "Transport", payee: "DirectRoute", patterns: ["DIRECTROUTE"] },
  { category: "Transport", payee: "Parking", patterns: ["WWW.PARKING", "MIDLANDS PA"] },
  { category: "Transport", payee: "NYA Smart Route", patterns: ["NYA*SMART R", "NYA*AIRVEND"] },
  { category: "Travel", payee: "Ryanair", patterns: ["RYANAIR"] },
  { category: "Travel", payee: "Booking.com", patterns: ["BKG*BOOKING"] },
  { category: "Travel", payee: "Clayton Hotel", patterns: ["CLAYTON DUB"] },
  { category: "Travel", payee: "PLL Hotels", patterns: ["PLL HOTELS"] },
  { category: "Travel", payee: "Avolta", patterns: ["AVOLTA TENE"] },
  { category: "Travel", payee: "Sauna Experience", patterns: ["WWW.SAUNAEX", "SAUNA SESSIO"] },
  { category: "Travel", payee: "WillWeGo", patterns: ["WWW.WILLWEGO"] },
  { category: "Travel", payee: "Costa Adeje ATM", patterns: ["COSTA ADEJE"] },
  { category: "Entertainment", payee: "Steam", patterns: ["STEAMGAMES"] },
  { category: "Entertainment", payee: "PlayStation", patterns: ["PLAYSTATION"] },
  { category: "Entertainment", payee: "Odeon", patterns: ["ODEON PORTL"] },
  { category: "Entertainment", payee: "Ticketmaster", patterns: ["TM *TICKETMA"] },
  { category: "Entertainment", payee: "The Nightmare", patterns: ["THE NIGHTMAR"] },
  { category: "Entertainment", payee: "G2A", patterns: ["G2A.COM", "G2ABVSHOP"] },
  { category: "Shopping", payee: "Amazon", patterns: ["AMZN MKTP"] },
  { category: "Shopping", payee: "IKEA", patterns: ["IKEA IRELAN"] },
  { category: "Shopping", payee: "Penneys", patterns: ["PENNEYS"] },
  { category: "Shopping", payee: "Gymshark", patterns: ["SP GYMSHARK"] },
  { category: "Shopping", payee: "E-Smoke", patterns: ["E-SMOKE4U"] },
  { category: "Shopping", payee: "Coca Cola", patterns: ["COCA COLA"] },
  { category: "Health & Fitness", payee: "Burn Gym", patterns: ["BURN GYM"] },
  { category: "Health & Fitness", payee: "UL Sport", patterns: ["UL SPORT CLI"] },
  { category: "Education", payee: "Road Safety", patterns: ["ROAD SAFETY"] },
  { category: "Education", payee: "Driving Test", patterns: ["WWW.DRIVINGT", "BOGDAN DRIVI"] },
  { category: "Education", payee: "Central SQ", patterns: ["SQ *CENTRAL"] },
];

const descriptions = new Set(rows.map((r) => r.description));
const rules = [];
const matched = new Set();
let priority = 1000;

for (const def of ruleDefinitions) {
  for (const pattern of def.patterns) {
    const upperPattern = pattern.toUpperCase();
    const hits = rows.filter((r) => r.description.includes(upperPattern));
    if (hits.length === 0) continue;

    for (const hit of hits) {
      matched.add(hit.description);
    }

    rules.push({
      category: def.category,
      payeeLabel: def.payee,
      matchText: pattern.toLowerCase(),
      priority,
      source: "system",
    });
    priority -= 1;
  }
}

const unmatched = rows.filter((r) => !matched.has(r.description));
const output = {
  generatedAt: new Date().toISOString(),
  transactionExpenseDescriptions: rows.length,
  matchedDescriptions: matched.size,
  unmatchedDescriptions: unmatched.length,
  rules,
  unmatchedSample: unmatched.slice(0, 40).map((r) => r.description),
};

const outPath = join(
  __dirname,
  "../apps/api/src/categorize/category-rules.ie.json",
);
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${rules.length} rules (${matched.size}/${rows.length} descriptions matched)`);
console.log(`Output: ${outPath}`);
