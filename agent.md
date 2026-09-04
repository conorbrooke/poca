# Póca product rules for agents

Póca is an Ireland / EUR household ledger. Figures on screen must come from money that actually exists in the system — bank balances, imported transactions, or items the user has explicitly added as real assets/liabilities. Never invent, type in, or “log” a balance that cannot be traced back to one of those sources.

## Traceability (non-negotiable)

Every amount that grows, shrinks, or sits in a pot must be traceable to the money:

- **Goals / savings pots** follow a linked account’s balance and/or specific transactions the user assigned (transfer into savings, ATM cash withdrawal, and similar). They must not expose a free-typed “saved so far” or “add €” that is not a transaction. If there is no linked account and no assigned transactions, the pot is €0.
- **Spending, income, bills, and budgets** are derived from categorised transactions for the selected period. Bills are expense categories, not a parallel ledger.
- **Net worth** is linked account balances plus wealth items the user added (pension, property, vehicle, mortgage, and so on). Empty template rows are not assets.
- **Pension inflows** are the monthly euro amounts the user recorded for that pot (payslip), not a yearly figure dressed up as growth.
- Do not add features that let a number jump without a matching transaction, account balance, or explicitly created wealth item.

If a UI needs to show progress, show the trail (the account, the transactions) next to the number. If the trail is empty, the number is zero.

## Other invariants

- Default to calendar-month (and custom from/to) periods, consistent across Spending, Income, and Wealth.
- Do not treat recurring bills as unbudgeted leaks when the category is marked as a bill.
- Keep copy Irish-household-plain; education, not tax advice.
