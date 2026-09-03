import { z } from "zod";

export const BILL_CADENCES = ["WEEKLY", "MONTHLY", "YEARLY"] as const;
export const SAVINGS_GOAL_KINDS = [
  "EMERGENCY",
  "HOUSE",
  "CAR",
  "HOLIDAY",
  "GENERAL",
] as const;
export const WEALTH_SIDES = ["ASSET", "LIABILITY"] as const;
export const WEALTH_CLASSES = [
  "BANK_CASH",
  "PROPERTY",
  "VEHICLE",
  "PENSION",
  "INVESTMENT",
  "OTHER",
  "MORTGAGE",
  "LOAN",
  "CREDIT_CARD",
  "PERSONAL",
] as const;
export const PENSION_KINDS = [
  "MYFUTUREFUND",
  "OCCUPATIONAL",
  "PRSA",
  "AVC",
] as const;

export const PENSION_KIND_OPTIONS = [
  {
    id: "MYFUTUREFUND" as const,
    label: "MyFutureFund",
    hint: "State auto-enrolment. In 2026 you pay 1.5% of gross, your employer matches 1.5%, and the State adds 0.5%. Enter the monthly euro amounts from your payslip.",
  },
  {
    id: "OCCUPATIONAL" as const,
    label: "Occupational / workplace",
    hint: "A scheme run through your employer. Enter the monthly amounts leaving your pay, plus any employer contribution.",
  },
  {
    id: "PRSA" as const,
    label: "PRSA",
    hint: "Personal Retirement Savings Account. Track the pot value and what you put in each month.",
  },
  {
    id: "AVC" as const,
    label: "AVC",
    hint: "Additional Voluntary Contributions on top of a workplace scheme.",
  },
] as const;

export const MYFUTUREFUND_2026 = {
  employeeRate: 0.015,
  employerRate: 0.015,
  stateRate: 0.005,
} as const;

export const IRISH_BILL_PRESETS = [
  { name: "Rent", cadence: "MONTHLY" as const, essential: true },
  { name: "Electricity", cadence: "MONTHLY" as const, essential: true },
  { name: "Gas", cadence: "MONTHLY" as const, essential: true },
  { name: "Broadband", cadence: "MONTHLY" as const, essential: true },
  { name: "Bin charges", cadence: "MONTHLY" as const, essential: true },
  { name: "Phone", cadence: "MONTHLY" as const, essential: true },
  { name: "Health insurance", cadence: "MONTHLY" as const, essential: true },
  { name: "Car insurance", cadence: "YEARLY" as const, essential: true },
  { name: "Motor tax", cadence: "YEARLY" as const, essential: true },
  { name: "NCT", cadence: "YEARLY" as const, essential: true },
  { name: "TV licence", cadence: "YEARLY" as const, essential: false },
  { name: "Gym", cadence: "MONTHLY" as const, essential: false },
] as const;

export const IRISH_BROKERS = [
  "Revolut",
  "Trading 212",
  "DEGIRO",
  "Interactive Brokers",
  "Other",
] as const;

export const IRISH_WEALTH_NOTES = {
  dirt:
    "Deposit interest in Ireland is usually subject to DIRT at 33%. The after-DIRT figure is a hint, not a Revenue calculation.",
  pension:
    "MyFutureFund (Ireland’s auto-enrolment scheme) takes a monthly slice of gross pay — in 2026, 1.5% from you, 1.5% from your employer, and 0.5% from the State. Occupational pensions, PRSAs, and AVCs work the same way here: pot value plus monthly inflows. Tax relief and drawdown rules are education, not advice.",
  cgt:
    "Direct shares are typically capital gains tax (currently 33%) in Ireland, with an annual exemption that changes — check Revenue before you rely on a number.",
  funds:
    "Many ETFs and funds used by Irish residents can be exit tax / 8-year deemed disposal (often 41%) depending on domicile. Check the product; Póca does not classify ISINs.",
} as const;

export const wealthMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type WealthMonthQuery = z.infer<typeof wealthMonthQuerySchema>;

export const upsertBudgetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  overallCap: z.number().nonnegative().nullable().optional(),
  lines: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .default([]),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;

export const copyBudgetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  fromActuals: z.boolean().default(true),
});

export type CopyBudgetInput = z.infer<typeof copyBudgetSchema>;

export const upsertBillSchema = z.object({
  name: z.string().min(1).max(80),
  categoryId: z.string().min(1).nullable().optional(),
  typicalAmount: z.number().nonnegative().optional(),
  cadence: z.enum(BILL_CADENCES).default("MONTHLY"),
  isEssential: z.boolean().default(true),
  icon: z.string().max(32).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type UpsertBillInput = z.infer<typeof upsertBillSchema>;

export const upsertGoalSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(SAVINGS_GOAL_KINDS).default("GENERAL"),
  targetAmount: z.number().positive(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  currentAmount: z.number().nonnegative().default(0),
  accountId: z.string().min(1).nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
});

export type UpsertGoalInput = z.infer<typeof upsertGoalSchema>;

export const upsertWealthItemSchema = z.object({
  name: z.string().min(1).max(80),
  side: z.enum(WEALTH_SIDES),
  class: z.enum(WEALTH_CLASSES),
  currentValue: z.number().nonnegative(),
  accountId: z.string().min(1).nullable().optional(),
  interestRate: z.number().min(0).max(1).nullable().optional(),
  minimumPayment: z.number().nonnegative().nullable().optional(),
  pensionKind: z.enum(PENSION_KINDS).nullable().optional(),
  employerMatchAnnual: z.number().nonnegative().nullable().optional(),
  employeeContributionMonthly: z.number().nonnegative().nullable().optional(),
  employerContributionMonthly: z.number().nonnegative().nullable().optional(),
  stateContributionMonthly: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
});

export type UpsertWealthItemInput = z.infer<typeof upsertWealthItemSchema>;

export const upsertHoldingSchema = z.object({
  ticker: z.string().min(1).max(16),
  name: z.string().min(1).max(80),
  quantity: z.number().positive(),
  averageCost: z.number().nonnegative(),
  currency: z.string().length(3).default("EUR"),
  broker: z.string().max(40).nullable().optional(),
  lastPrice: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
});

export type UpsertHoldingInput = z.infer<typeof upsertHoldingSchema>;

export const debtOrderSchema = z.object({
  order: z.enum(["avalanche", "snowball"]).default("avalanche"),
});
