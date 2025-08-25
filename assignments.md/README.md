Bank Lending System — Agetware Assignment
  This project implements a Bank Lending System API using Node.js (Express) + SQLite with Simple Interest calculations.
It supports:
Loan creation (with EMI computation)
Loan repayments (EMI or lump sum)
Ledger view of all transactions
Customer account overview

Features:
Loan Creation
    Input: principal, interest rate, loan period
    Output: loan details with EMI schedule
Repayments
    Record payments as EMI or LUMP_SUM
    Automatically updates balance & status (ACTIVE → PAID_OFF)
Ledger
    Retrieve full payment history and current loan status
Customer Overview
    View all loans for a customer in one place
Lightweight DB
    Uses SQLite (better-sqlite3)
