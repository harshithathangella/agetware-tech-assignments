// app.js
// Agetware Assignment — Bank Lending System (Express + SQLite, Simple Interest)

const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuid } = require("uuid");
const Database = require("better-sqlite3");

const app = express();
app.use(bodyParser.json());

// ---- DB ----
const db = new Database(process.env.DB_PATH || "./bank.db");
db.pragma("journal_mode = WAL");

// schema
db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loans (
  loan_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  principal_amount REAL NOT NULL,
  interest_rate REAL NOT NULL,           -- annual %, e.g., 10 for 10%
  loan_period_years INTEGER NOT NULL,
  total_amount REAL NOT NULL,            -- A = P + I
  monthly_emi REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_type TEXT CHECK(payment_type IN ('EMI','LUMP_SUM')) NOT NULL,
  payment_date TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(loan_id) REFERENCES loans(loan_id)
);

CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
`);

// helpers
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function computeSI({ P, N, Rpct }) {
  const I = P * N * (Rpct / 100.0);
  const A = P + I;
  return { I, A };
}

function getLoanOr404(loanId) {
  const loan = db.prepare("SELECT * FROM loans WHERE loan_id = ?").get(loanId);
  if (!loan) throw { code: 404, msg: "Loan not found" };
  return loan;
}

function totalsForLoan(loanId) {
  const paid = db
    .prepare("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE loan_id = ?")
    .get(loanId).paid;
  const loan = getLoanOr404(loanId);
  const balance = Math.max(0, round2(loan.total_amount - paid));
  const emisLeft = balance <= 0 ? 0 : Math.ceil(balance / loan.monthly_emi);
  return { loan, paid: round2(paid), balance, emisLeft };
}

function upsertCustomer(customer_id) {
  // Lightweight: ensure a customer row exists (name optional for assignment)
  const row = db.prepare("SELECT customer_id FROM customers WHERE customer_id = ?").get(customer_id);
  if (!row) {
    db.prepare("INSERT INTO customers (customer_id, name) VALUES (?, ?)").run(customer_id, null);
  }
}

// ---- API ----
// LEND: create loan
app.post("/api/v1/loans", (req, res) => {
  try {
    const { customer_id, loan_amount, loan_period_years, interest_rate_yearly } = req.body || {};

    if (!customer_id || loan_amount == null || loan_period_years == null || interest_rate_yearly == null) {
      return res.status(400).json({ error: "customer_id, loan_amount, loan_period_years, interest_rate_yearly are required" });
    }
    if (loan_amount <= 0 || loan_period_years <= 0 || interest_rate_yearly < 0) {
      return res.status(400).json({ error: "Invalid numeric values" });
    }

    upsertCustomer(customer_id);

    const P = Number(loan_amount);
    const N = Number(loan_period_years);
    const R = Number(interest_rate_yearly);

    const { I, A } = computeSI({ P, N, Rpct: R });
    const totalMonths = N * 12;
    const emi = round2(A / totalMonths);

    const loan_id = uuid();
    db.prepare(`
      INSERT INTO loans (loan_id, customer_id, principal_amount, interest_rate, loan_period_years, total_amount, monthly_emi, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(loan_id, customer_id, P, R, N, round2(A), emi);

    return res.status(201).json({
      loan_id,
      customer_id,
      principal: round2(P),
      total_interest: round2(I),
      total_amount_payable: round2(A),
      monthly_emi: emi
    });
  } catch (e) {
    const status = e.code || 500;
    return res.status(status).json({ error: e.msg || "Internal error" });
  }
});

// PAYMENT: record EMI or LUMP_SUM
app.post("/api/v1/loans/:loanId/payments", (req, res) => {
  try {
    const { loanId } = req.params;
    const { amount, payment_type } = req.body || {};
    const loan = getLoanOr404(loanId);

    if (!amount || amount <= 0) return res.status(400).json({ error: "amount must be > 0" });
    if (!payment_type || !["EMI", "LUMP_SUM"].includes(payment_type)) {
      return res.status(400).json({ error: "payment_type must be 'EMI' or 'LUMP_SUM'" });
    }

    if (loan.status === "PAID_OFF") {
      return res.status(409).json({ error: "Loan already paid off" });
    }

    const payment_id = uuid();
    db.prepare(`INSERT INTO payments (payment_id, loan_id, amount, payment_type) VALUES (?, ?, ?, ?)
    `).run(payment_id, loanId, round2(Number(amount)), payment_type);

    // recompute & possibly mark paid_off
    const { balance, emisLeft } = totalsForLoan(loanId);
    if (balance <= 0 && loan.status !== "PAID_OFF") {
      db.prepare("UPDATE loans SET status='PAID_OFF' WHERE loan_id = ?").run(loanId);
    }

    return res.json({
      payment_id,
      loan_id: loanId,
      message: "Payment recorded successfully",
      remaining_balance: balance,
      emis_left: emisLeft
    });
  } catch (e) {
    const status = e.code || 500;
    return res.status(status).json({ error: e.msg || "Internal error" });
  }
});

// LEDGER: transactions + status
app.get("/api/v1/loans/:loanId/ledger", (req, res) => {
  try {
    const { loanId } = req.params;
    const { loan, paid, balance, emisLeft } = totalsForLoan(loanId);

    const txns = db.prepare(`
      SELECT payment_id as transaction_id, payment_date as date, amount, payment_type as type
      FROM payments WHERE loan_id = ?
      ORDER BY datetime(payment_date) ASC, rowid ASC
    `).all(loanId);

    return res.json({
      loan_id: loan.loan_id,
      customer_id: loan.customer_id,
      principal: round2(loan.principal_amount),
      total_amount: round2(loan.total_amount),
      monthly_emi: round2(loan.monthly_emi),
      amount_paid: paid,
      balance_amount: balance,
      emis_left: emisLeft,
      status: loan.status,
      transactions: txns
    });
  } catch (e) {
    const status = e.code || 500;
    return res.status(status).json({ error: e.msg || "Internal error" });
  }
});

// ACCOUNT OVERVIEW: all loans for a customer
app.get("/api/v1/customers/:customerId/overview", (req, res) => {
  try {
    const { customerId } = req.params;
    const loans = db.prepare(`SELECT * FROM loans WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
    if (loans.length === 0) return res.status(404).json({ error: "No loans for this customer" });

    const out = loans.map((ln) => {
      const paid = db.prepare("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE loan_id = ?").get(ln.loan_id).paid;
      const balance = Math.max(0, round2(ln.total_amount - paid));
      const emisLeft = balance <= 0 ? 0 : Math.ceil(balance / ln.monthly_emi);
      const totalInterest = round2(ln.total_amount - ln.principal_amount);
      return {
        loan_id: ln.loan_id,
        principal: round2(ln.principal_amount),
        total_amount: round2(ln.total_amount),
        total_interest: totalInterest,
        emi_amount: round2(ln.monthly_emi),
        amount_paid: round2(paid),
        emis_left: emisLeft,
        status: ln.status,
        created_at: ln.created_at
      };
    });

    return res.json({
      customer_id: customerId,
      total_loans: out.length,
      loans: out
    });
  } catch (e) {
    const status = e.code || 500;
    return res.status(status).json({ error: e.msg || "Internal error" });
  }
});

// health
app.get("/health", (_, res) => res.json({ ok: true }));

// boot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bank API on :${PORT}`));
