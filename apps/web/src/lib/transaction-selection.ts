import type { SpendingTransaction } from "../lib/types";

export function transactionSelectionKey(tx: SpendingTransaction) {
  return `${tx.kind}:${tx.id}`;
}

export function parseTransactionSelectionKey(key: string) {
  const [kind, ...rest] = key.split(":");
  if (kind !== "transaction" && kind !== "split") return null;
  const id = rest.join(":");
  if (!id) return null;
  return { kind, id } as { kind: "transaction" | "split"; id: string };
}
