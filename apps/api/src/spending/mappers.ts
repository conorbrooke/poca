import type { TagOption } from "@poca/shared";

export function toNumber(value: { toString(): string }): number {
  return parseFloat(value.toString());
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function mapTag(tag: {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}): TagOption {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon,
  };
}

export function splitsOutOfBalance(
  parentAmount: number,
  splitAmounts: number[],
): boolean {
  const splitTotal = splitAmounts.reduce((sum, amount) => sum + toCents(amount), 0);
  return toCents(parentAmount) !== splitTotal;
}
