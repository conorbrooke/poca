import { derivePayeeLabel, normalizeSearchText } from "../spending/period";

export type RuleMatch = {
  categoryName: string;
  payeeLabel: string;
  matchText: string;
  priority: number;
  source: string;
  tagIds: string[];
};

export function matchTransaction(
  description: string,
  merchant: string | null | undefined,
  rules: Array<{
    matchText: string;
    payeeLabel: string;
    priority: number;
    source: string;
    category: { name: string };
    tags?: Array<{ tagId: string }>;
  }>,
): RuleMatch | null {
  const haystack = normalizeSearchText(description, merchant);
  let best: RuleMatch | null = null;

  for (const rule of rules) {
    const candidate: RuleMatch = {
      categoryName: rule.category.name,
      payeeLabel: rule.payeeLabel,
      matchText: rule.matchText,
      priority: rule.priority,
      source: rule.source,
      tagIds: rule.tags?.map((tag) => tag.tagId) ?? [],
    };

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
