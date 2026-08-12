import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { derivePayeeLabel, normalizeSearchText } from "../spending/period";

function resolveRulesPath(): string {
  const candidates = [
    join(__dirname, "category-rules.ie.json"),
    join(process.cwd(), "src/categorize/category-rules.ie.json"),
    join(process.cwd(), "apps/api/src/categorize/category-rules.ie.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error("category-rules.ie.json not found");
}

export type SystemRule = {
  category: string;
  payeeLabel: string;
  matchText: string;
  priority: number;
  source: string;
};

export type RuleMatch = {
  categoryName: string;
  payeeLabel: string;
  matchText: string;
  priority: number;
  source: string;
};

type RulesFile = {
  rules: SystemRule[];
};

let cachedSystemRules: SystemRule[] | null = null;

export function loadSystemRules(): SystemRule[] {
  if (cachedSystemRules) return cachedSystemRules;
  const raw = readFileSync(resolveRulesPath(), "utf8");
  cachedSystemRules = (JSON.parse(raw) as RulesFile).rules;
  return cachedSystemRules;
}

export function matchTransaction(
  description: string,
  merchant: string | null | undefined,
  userRules: Array<{
    matchText: string;
    payeeLabel: string;
    priority: number;
    source: string;
    category: { name: string };
  }>,
): RuleMatch | null {
  const haystack = normalizeSearchText(description, merchant);
  let best: RuleMatch | null = null;

  const candidates: RuleMatch[] = [
    ...userRules.map((rule) => ({
      categoryName: rule.category.name,
      payeeLabel: rule.payeeLabel,
      matchText: rule.matchText,
      priority: rule.priority + 10_000,
      source: rule.source,
    })),
    ...loadSystemRules().map((rule) => ({
      categoryName: rule.category,
      payeeLabel: rule.payeeLabel,
      matchText: rule.matchText,
      priority: rule.priority,
      source: rule.source,
    })),
  ];

  for (const candidate of candidates) {
    if (!haystack.includes(candidate.matchText.toLowerCase())) continue;
    if (!best || candidate.priority > best.priority) {
      best = candidate;
    }
  }

  return best;
}

export function buildFallbackPayee(
  description: string,
  merchant?: string | null,
): string {
  return derivePayeeLabel(description, merchant);
}

export function extractRuleMatchText(
  description: string,
  merchant?: string | null,
): string {
  const payee = derivePayeeLabel(description, merchant);
  const token = payee.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
  if (token.length >= 4) return token;
  return normalizeSearchText(description, merchant).slice(0, 40);
}
