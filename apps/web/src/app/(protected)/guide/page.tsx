import Link from "next/link";

type ExampleRow = {
  label: string;
  amount: string;
  kind: "Expense" | "Income" | "Transfer";
  category: string;
};

export default function GuidePage() {
  return (
    <div className="page">
      <header className="page-header">
        <p className="page-eyebrow">How Póca thinks</p>
        <h1 className="page-title">What goes where</h1>
        <p className="page-subtitle">
          Every transaction is one of three types. Pick the type first — then a
          category name like Groceries or Salary. Get the type right and your
          spending vs income stays honest.
        </p>
      </header>

      <nav className="guide-toc" aria-label="On this page">
        <a href="#rule">The one question</a>
        <a href="#expense">Expense</a>
        <a href="#income">Income</a>
        <a href="#transfer">Transfer</a>
        <a href="#situations">Tricky situations</a>
      </nav>

      <section id="rule" className="card guide-rule">
        <p className="page-eyebrow">The one question</p>
        <h2 className="guide-section-title">Did you get poorer, richer, or just move money?</h2>
        <div className="guide-kinds">
          <KindCard
            kind="Expense"
            question="Poorer"
            body="You spent it. It's gone — food, a bill, a car, interest on a loan."
            href="#expense"
          />
          <KindCard
            kind="Income"
            question="Richer"
            body="You earned it and you keep it — salary, a sale, interest paid to you."
            href="#income"
          />
          <KindCard
            kind="Transfer"
            question="Just moved"
            body="Same money, different place — or money you'll pay back / get back."
            href="#transfer"
          />
        </div>
      </section>

      <KindSection
        id="expense"
        kind="Expense"
        countsAs="Counts in Spending. Does not count as Income."
        meaning="You used money to buy or pay for something. You don't get that money back."
        examples={[
          {
            label: "Tesco",
            amount: "−€42.18",
            kind: "Expense",
            category: "Groceries",
          },
          {
            label: "Netflix",
            amount: "−€15.99",
            kind: "Expense",
            category: "Subscriptions",
          },
          {
            label: "Toyota Dublin",
            amount: "−€15,000",
            kind: "Expense",
            category: "Transport",
          },
          {
            label: "Car loan interest",
            amount: "−€80",
            kind: "Expense",
            category: "Bank Fees",
          },
        ]}
        why={[
          "Weekly shop is money leaving your pocket for food.",
          "A subscription is a bill you pay to use something.",
          "The car is what you bought — even if a loan paid for it.",
          "Interest is the cost of borrowing. That part is a real expense.",
        ]}
      />

      <KindSection
        id="income"
        kind="Income"
        countsAs="Counts in Income. Does not count as Spending."
        meaning="You earned this money and you keep it. Nobody expects it back."
        examples={[
          {
            label: "Acme Ltd payroll",
            amount: "+€2,400",
            kind: "Income",
            category: "Salary",
          },
          {
            label: "DoneDeal — bike",
            amount: "+€180",
            kind: "Income",
            category: "Sales",
          },
          {
            label: "Bank interest",
            amount: "+€3.12",
            kind: "Income",
            category: "Interest",
          },
        ]}
        why={[
          "Your job paid you. That's earnings.",
          "You sold something you owned. The cash is yours to keep.",
          "The bank paid you for holding savings — not a loan you owe.",
        ]}
        note="A loan landing in your account is not income. You have to pay it back, so that's a Transfer."
      />

      <KindSection
        id="transfer"
        kind="Transfer"
        countsAs="Shown under Transfers. Left out of Spending and Income."
        meaning="Money moved, but you didn't spend it and you didn't earn it. You still have it (somewhere else), you owe it back, or you'll get it back."
        examples={[
          {
            label: "Revolut → current account",
            amount: "−€200",
            kind: "Transfer",
            category: "Transfers",
          },
          {
            label: "Exchanged TRY → EUR",
            amount: "€0 spend",
            kind: "Transfer",
            category: "Transfers",
          },
          {
            label: "Loan from Catriona",
            amount: "+€50",
            kind: "Transfer",
            category: "Transfers",
          },
          {
            label: "Car loan repayment (principal)",
            amount: "−€320",
            kind: "Transfer",
            category: "Transfers",
          },
        ]}
        why={[
          "It's still your money — just in another account.",
          "You swapped currencies. You didn't buy anything.",
          "A friend lent you cash. You'll repay it, so it isn't a gift.",
          "You're paying back what you borrowed, not buying a new car each month.",
        ]}
      />

      <section id="situations" className="guide-situations">
        <h2 className="section-title">Tricky situations</h2>
        <p className="bank-meta guide-situations-lead">
          These are the ones that make spending vs income look “wrong” if you
          pick the wrong type. Each one is a full story.
        </p>

        <Situation
          title="You buy a car with a loan"
          story="The lender gives you €15,000 (or pays the dealer). You drive away with a car. Later you pay the loan back each month."
          rows={[
            {
              label: "Loan paid into your account",
              amount: "+€15,000",
              kind: "Transfer",
              category: "Transfers",
            },
            {
              label: "Payment to the dealer",
              amount: "−€15,000",
              kind: "Expense",
              category: "Transport",
            },
            {
              label: "Monthly payment — paying the debt down",
              amount: "−€320",
              kind: "Transfer",
              category: "Transfers",
            },
            {
              label: "Monthly payment — interest",
              amount: "−€80",
              kind: "Expense",
              category: "Bank Fees",
            },
          ]}
          takeaway="The car is the spend. The loan is borrowed money, not a paycheque. Interest is the only extra cost of the loan."
        />

        <Situation
          title="A friend lends you money — then you pay them back"
          story="Catriona sends you €50. Next week you send €50 back."
          rows={[
            {
              label: "From Catriona",
              amount: "+€50",
              kind: "Transfer",
              category: "Transfers",
            },
            {
              label: "To Catriona",
              amount: "−€50",
              kind: "Transfer",
              category: "Transfers",
            },
          ]}
          takeaway="You didn't earn €50 and you didn't spend €50. You borrowed, then returned it. Both sides are Transfers."
        />

        <Situation
          title="You take cash out for a PlayStation"
          story="The ATM shows −€380. You spend that cash on a PlayStation. The bank only knows about the ATM."
          rows={[
            {
              label: "ATM — you know it was the PlayStation",
              amount: "−€380",
              kind: "Expense",
              category: "Shopping",
            },
            {
              label: "ATM — you don't remember what the cash was for",
              amount: "−€380",
              kind: "Expense",
              category: "ATM",
            },
          ]}
          takeaway="The PlayStation is the spend, not 'getting cash'. Recategorise the ATM to Shopping when you know. Leave ATM only for cash you can't place. Don't also add a second PlayStation line or you'll count it twice."
        />

        <Situation
          title="Revolut exchanges Turkish lira to euro"
          story="You see “Exchanged to EUR” and a matching “Exchanged from TRY”."
          rows={[
            {
              label: "Exchanged from TRY",
              amount: "−110 TRY",
              kind: "Transfer",
              category: "Transfers",
            },
            {
              label: "Exchanged to EUR",
              amount: "+€2.80",
              kind: "Transfer",
              category: "Transfers",
            },
          ]}
          takeaway="You swapped money you already had. That's a Transfer on both sides — not shopping, and not income."
        />

        <Situation
          title="You pay a landlord a safety deposit"
          story="You send €1,200. You expect it back when you move out — unless they keep some for damage."
          rows={[
            {
              label: "Deposit paid (you expect it back)",
              amount: "−€1,200",
              kind: "Transfer",
              category: "Transfers",
            },
            {
              label: "Deposit returned",
              amount: "+€1,200",
              kind: "Transfer",
              category: "Transfers",
            },
            {
              label: "Landlord keeps €200 for damage",
              amount: "−€200",
              kind: "Expense",
              category: "Other",
            },
          ]}
          takeaway="A deposit you expect back is parked money — Transfer. The bit they keep is a real cost — Expense."
        />
      </section>

      <section className="card guide-lookup">
        <h2 className="guide-section-title">Quick lookup</h2>
        <div className="guide-lookup-table" role="table">
          <div className="guide-lookup-row head" role="row">
            <span>If this happened</span>
            <span>Use</span>
          </div>
          {[
            ["Salary, freelance, sold something you keep the cash for", "Income"],
            ["Groceries, rent, bills, shopping, eating out", "Expense"],
            ["Interest you pay on a loan or overdraft", "Expense"],
            ["Interest the bank pays you", "Income"],
            ["Moving money between your own accounts", "Transfer"],
            ["Currency exchange", "Transfer"],
            ["Loan or money from a friend (you'll repay)", "Transfer"],
            ["Paying that loan / friend back (the amount you borrowed)", "Transfer"],
            ["Buying the thing the loan was for (car, laptop…)", "Expense"],
            ["Safety deposit you expect back", "Transfer"],
            ["Refund for something you returned", "Transfer or original Expense*"],
          ].map(([when, use]) => (
            <div key={when} className="guide-lookup-row" role="row">
              <span>{when}</span>
              <span className={`guide-kind-pill ${pillClass(use)}`}>{use}</span>
            </div>
          ))}
        </div>
        <p className="bank-meta" style={{ marginTop: "0.85rem" }}>
          *A refund can stay as the same Expense category (it shrinks spending)
          or be a Transfer if you prefer not to mix it into that month's shop.
          Either is fine — be consistent.
        </p>
      </section>

      <p className="guide-footer-links">
        Open <Link href="/spending">Spending</Link> or{" "}
        <Link href="/income">Income</Link> and change a transaction's category
        anytime. The type on that category is what puts it in spending, income,
        or transfers.
      </p>
    </div>
  );
}

function KindCard({
  kind,
  question,
  body,
  href,
}: {
  kind: string;
  question: string;
  body: string;
  href: string;
}) {
  return (
    <a href={href} className={`guide-kind-card ${pillClass(kind)}`}>
      <p className="page-eyebrow">{question}</p>
      <h3>{kind}</h3>
      <p>{body}</p>
    </a>
  );
}

function KindSection({
  id,
  kind,
  countsAs,
  meaning,
  examples,
  why,
  note,
}: {
  id: string;
  kind: string;
  countsAs: string;
  meaning: string;
  examples: ExampleRow[];
  why: string[];
  note?: string;
}) {
  return (
    <section id={id} className="card guide-kind-section">
      <p className={`page-eyebrow guide-kind-label ${pillClass(kind)}`}>{kind}</p>
      <h2 className="guide-section-title">{meaning}</h2>
      <p className="bank-meta">{countsAs}</p>
      <div className="guide-example-list">
        {examples.map((example, index) => (
          <div key={example.label} className="guide-example">
            <ExampleTx {...example} />
            <p className="guide-example-why">{why[index]}</p>
          </div>
        ))}
      </div>
      {note ? <p className="guide-note">{note}</p> : null}
    </section>
  );
}

function Situation({
  title,
  story,
  rows,
  takeaway,
}: {
  title: string;
  story: string;
  rows: ExampleRow[];
  takeaway: string;
}) {
  return (
    <article className="card guide-situation">
      <h3 className="guide-situation-title">{title}</h3>
      <p className="guide-situation-story">{story}</p>
      <div className="guide-example-list">
        {rows.map((row) => (
          <ExampleTx key={`${row.label}-${row.amount}`} {...row} />
        ))}
      </div>
      <p className="guide-takeaway">
        <strong>So:</strong> {takeaway}
      </p>
    </article>
  );
}

function ExampleTx({ label, amount, kind, category }: ExampleRow) {
  return (
    <div className="guide-tx">
      <div className="guide-tx-main">
        <p className="guide-tx-label">{label}</p>
        <p className="bank-meta">
          {category} · {kind}
        </p>
      </div>
      <p className={`guide-tx-amount ${pillClass(kind)}`}>{amount}</p>
      <span className={`guide-kind-pill ${pillClass(kind)}`}>{kind}</span>
    </div>
  );
}

function pillClass(kind: string) {
  const key = kind.split(" ")[0]!.toLowerCase();
  if (key === "income") return "income";
  if (key === "transfer") return "transfer";
  return "expense";
}
