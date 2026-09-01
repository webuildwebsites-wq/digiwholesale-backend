# Unified Enterprise Accounting & Payment Architecture (MERN Stack)
## Comprehensive Technical Architecture, Execution & Compliance Documentation

---

## 1. Executive Summary & Traceability Matrix

This architecture unifies the **DigiWholesale Payment Architecture** and the **Company Management ERP Requirements** into a robust, tamper-proof, double-entry financial management system built on the MERN stack (MongoDB, Express, React, Node.js).

### Traceability Matrix (Business Requirements to Implementation)

| Management Requirement Section | Business Rule / Specification | Technical Implementation | Re-verification Checkpoint |
| :--- | :--- | :--- | :--- |
| **Chart of Accounts (COA)** | Hierarchical account groups (Assets, Liabilities, Income, Expenses, Capital) | `Account.model.js` + `scripts/seedChartOfAccounts.js` + `/api/v1/accounts` | Group hierarchy, Nature tags, and Control Account locks verified. |
| **Control Account Integrity** | Prevent manual adjustments on system control accounts (AR/AP/Cash/Bank) | `isControlAccount: true`, `allowManualJournal: false` validations | Control accounts protected against direct unreferenced edits. |
| **Customer Ledger Master** | Multi-branch khata with Credit Limits, Credit Days, Opening Balances, Status | `CustomerLedger.model.js` + `/api/v1/ledgers/customers` | 3-Tab Master Form (Basic Info, Financial Settings, Account Status). |
| **Customer Inflow & Multi-Bill Split** | Single payment allocated across multiple invoices; excess to Advance Khata | `executeCustomerPayment` with `allocations[]` and `advanceAmount` computation | Invoices updated, receipt posted, running balance updated. |
| **Vendor Ledger Master** | Vendor categories, TDS section (194Q/194C/194J), PAN, GSTIN, payment terms | `VendorLedger.model.js` + `/api/v1/ledgers/vendors` | TDS configuration and vendor credit terms mapped. |
| **Vendor Payout Settlement** | Settle gross bill with automatic TDS deduction and Debit Note adjustments | `executeVendorPayment` (`Net Paid = Gross - TDS - Debit Note`) | Payment voucher generated, vendor outstanding reduced. |
| **Cheque Clearance & Bounce** | Deposit tracking, ledger credit upon clearance, ₹500 penalty + invoice reversal on bounce | `updateChequeStatus` lifecycle handler (`RECEIVED` $\rightarrow$ `CLEARED` or `BOUNCED`) | Reversal entry (`REV-`) + Penalty entry (`CHG-`) + ₹500 debit posted. |
| **Tamper-Proof Audit Trail** | Non-editable chronological transactions with running balance | `LedgerTransaction.model.js` | Immutable ledger history with running balances. |
| **30/60/90/120+ Aging Analysis** | Real-time aging buckets for Receivables (Customers) and Payables (Vendors) | `aging.controller.js` + `/api/v1/reports/aging` + `AgingReport.jsx` | Dynamic 0-30, 31-60, 61-90, 90+ days aging reports. |

---

## 2. Core Architectural Principles

1. **Atomic ACID Transactions**: Financial events (customer payment, vendor payout, cheque bounce reversal) use MongoDB transaction sessions (`mongoose.startSession()`) ensuring zero data corruption or partial ledger writes.
2. **Double-Entry & Control Account Synchronization**: Cash inflows and outflows sync with control accounts (Accounts Receivable and Accounts Payable).
3. **Immutable Audit Trail**: All ledger movements are stored as discrete `LedgerTransaction` vouchers with point-in-time `runningBalance`. Manual direct alterations to transactions are strictly prohibited.
4. **Multi-Tenant & Multi-Branch Tracking**: All models natively include `tenantId`, `branchId`, and `createdBy` audit timestamps.

---

## 3. Database Models & Schema Specifications

### 3.1 Chart of Accounts (`Account.model.js`)
- `accountCode`: Unique alphanumeric code (e.g. `1110`, `2110`, `4100`).
- `accountName`: Standardized name.
- `accountNature`: `Asset`, `Liability`, `Income`, `Expense`, `Capital`.
- `accountType`: `General Ledger`, `Customer`, `Vendor`, `Bank`, `Cash`, `Tax`, `Inventory`, `Expense`, `Income`.
- `parentAccount`: Self-referencing `ObjectId` for nested tree structures.
- `isControlAccount`: Boolean flag protecting core ledger accounts.
- `allowManualJournal`: Boolean controlling manual voucher entries.

### 3.2 Customer Ledger Master (`CustomerLedger.model.js`)
- `ledgerCode`: Unique customer ledger identifier (e.g. `CUST-LED-XXXXXX`).
- `customerId`: Reference to `Customer` master.
- `creditLimit`: Maximum credit threshold allowed before account blocking.
- `creditDays`: Credit window in days (e.g. 15, 30, 45, 60 days).
- `interestRate`: Penalty interest rate percentage for overdue balances.
- `openingBalance` & `openingBalanceType`: Initial debit or credit balance.
- `currentBalance`: Real-time computed outstanding balance.
- `overdueAmount`: Balance exceeding the agreed `creditDays`.
- `ledgerStatus`: `Active`, `Blocked`, `Closed`.
- `allowCreditSales`: Toggle allowing or disallowing credit billing.

### 3.3 Vendor Ledger Master (`VendorLedger.model.js`)
- `ledgerCode`: Unique vendor ledger identifier (e.g. `VEND-LED-XXXXXX`).
- `vendorId`: Reference to `Vendor` master.
- `vendorCategory`: `Manufacturer`, `Distributor`, `Service Provider`, `Logistics`, `Lab`, `Equipment`, `Utility`, `Other`.
- `tdsApplicable`: Boolean flag indicating tax deduction at source.
- `tdsSection`: Section code (`194Q`, `194C`, `194J`).
- `tdsPercentage`: Applicable deduction percentage (e.g. 0.1%, 1%, 2%, 10%).
- `gstin` & `pan`: Tax identifiers.
- `paymentTerms`: Agreed credit window in days.
- `currentOutstanding`: Real-time payable balance.

### 3.4 Unified Payment & Voucher (`Payment.model.js`)
- `paymentNumber`: Unique voucher code (`CPAY-XXXX` for Customer Inflow, `VPAY-XXXX` for Vendor Outflow).
- `type`: `CUSTOMER_INFLOW` or `VENDOR_OUTFLOW`.
- `partyId` & `partyModel`: Polymorphic reference to `Customer` or `Vendor`.
- `paymentMode`: `CASH`, `UPI`, `CHEQUE`, `BANK_TRANSFER`.
- `grossAmount`: Gross transaction value.
- `tdsDeducted` & `tdsSection`: Withheld tax amount and regulatory section.
- `debitNoteDeducted` & `debitNoteIds`: Return / QC debit adjustments applied.
- `netAmountPaid`: Actual cash / bank amount transferred (`Gross - TDS - Returns`).
- `allocations`: Array of `{ invoiceId, invoiceNumber, invoiceModel, allocatedAmount }`.
- `advanceAmount`: Unallocated excess payment credited to advance khata.
- `paymentDetails`: UTR number, UPI IDs, Cheque number, Bank name, Cheque date, Clearance date, Bounce reason, Bounce penalty, Cash voucher number, Screenshot URL.
- `status`: `DRAFT`, `PENDING_VERIFICATION`, `RECEIVED`, `DEPOSITED`, `CLEARED`, `BOUNCED`, `COMPLETED`, `CANCELLED`.

### 3.5 Unified Ledger Transaction Audit (`LedgerTransaction.model.js`)
- `entityType`: `Customer`, `Vendor`, `General`.
- `ledgerId` & `partyId`: References to the respective ledger master and party.
- `transactionDate`: Date of financial occurrence.
- `voucherType`: `Sales Invoice`, `Receipt`, `Purchase Invoice`, `Payment Voucher`, `Debit Note`, `Credit Note`, `Journal`.
- `voucherId`: Reference to the initiating document (`Payment`, `Order`, `VendorPurchase`, etc.).
- `referenceNumber`: Unique reference number.
- `debit`: Debited amount.
- `credit`: Credited amount.
- `runningBalance`: Post-transaction cumulative balance.
- `narration`: Human-readable audit description.

---

## 4. Business Logic & Calculation Formulas

### 4.1 Customer Payment Inflow
$$\text{Allocated Amount} = \sum \text{Allocations}$$
$$\text{Advance Amount} = \max(0, \text{Gross Amount} - \text{Allocated Amount})$$
$$\text{New Customer Balance} = \text{Current Balance} - \text{Gross Amount}$$

*If Payment Mode is `CHEQUE`: Balance is only adjusted when cheque reaches `CLEARED` status.*

### 4.2 Cheque Bounce Penalty & Reversal Rule
When a cheque is marked as `BOUNCED`:
1. Reverse invoice allocations:
   $$\text{Invoice Advance/Paid Amount} \mathrel{-}= \text{Allocated Amount}$$
2. Re-debit customer ledger:
   $$\text{Total Debit} = \text{Cheque Gross Amount} + \text{₹500 Bounce Penalty}$$
   $$\text{New Customer Balance} = \text{Current Balance} + \text{Total Debit}$$
3. Post dual immutable audit entries:
   - **Reversal Entry**: `REV-CPAY-XXXX` (Debit: Cheque Gross Amount)
   - **Bounce Penalty Entry**: `CHG-CPAY-XXXX` (Debit: ₹500)

### 4.3 Vendor Payout Settlement
$$\text{TDS Amount} = \frac{\text{Gross Amount} \times \text{TDS Percentage}}{100}$$
$$\text{Net Paid} = \max(0, \text{Gross Amount} - \text{TDS Amount} - \text{Debit Note Deductions})$$
$$\text{New Vendor Outstanding} = \text{Current Outstanding} - \text{Gross Amount}$$

---

## 5. REST API Specifications

| Method | Endpoint | Description | Key Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/accounts/tree` | Hierarchical Chart of Accounts Tree | Grouped by Asset, Liability, Capital, Income, Expense |
| `GET` | `/api/v1/accounts` | Flat list of accounts | Filter by `nature`, `type`, `status`, `search` |
| `POST` | `/api/v1/accounts` | Create new COA account | `{ accountCode, accountName, accountNature, accountType, ... }` |
| `PUT` | `/api/v1/accounts/:id` | Update account properties | `{ accountName, description, allowManualJournal, ... }` |
| `GET` | `/api/v1/ledgers/customers` | Paginated Customer Ledgers list | `search`, `status`, `branchId`, `page`, `limit` |
| `GET` | `/api/v1/ledgers/customer/:customerId` | Full Customer Khata Statement | `startDate`, `endDate`, `voucherType`, `page`, `limit` |
| `POST` | `/api/v1/ledgers/customer/upsert` | 3-Tab Customer Master settings | `{ customerId, creditLimit, creditDays, openingBalance, ... }` |
| `GET` | `/api/v1/ledgers/vendors` | Paginated Vendor Ledgers list | `search`, `category`, `status`, `page`, `limit` |
| `GET` | `/api/v1/ledgers/vendor/:vendorId` | Full Vendor Payable Statement | `startDate`, `endDate`, `voucherType`, `page`, `limit` |
| `POST` | `/api/v1/ledgers/vendor/upsert` | 3-Tab Vendor Master settings | `{ vendorId, vendorCategory, tdsApplicable, tdsSection, ... }` |
| `POST` | `/api/v1/payments/customer` | Customer Inflow Payment Execution | `{ customerId, amount, paymentMode, allocations, paymentDetails }` |
| `POST` | `/api/v1/payments/vendor` | Vendor Payout Execution | `{ vendorId, grossAmount, tdsDeducted, debitNoteDeducted, ... }` |
| `PATCH`| `/api/v1/payments/:id/cheque-status` | Cheque Lifecycle Update | `{ status: "DEPOSITED" \| "CLEARED" \| "BOUNCED", bounceReason }` |
| `GET` | `/api/v1/payments` | Payments & Vouchers register | `type`, `paymentMode`, `status`, `partyId`, `startDate`, `endDate` |
| `GET` | `/api/v1/payments/:id` | Single Payment Voucher detail | Populated party, allocations, and references |
| `GET` | `/api/v1/reports/aging` | 30/60/90/120+ Days Aging Report | `entityType: "Customer" \| "Vendor"`, `branchId` |

---

## 6. Frontend Modules & User Interfaces (`Wholesale-MVP`)

1. **Chart of Accounts (`/accounting/chart-of-accounts`)**:
   - Visual tree with expand/collapse hierarchy.
   - Nature color badges (Asset, Liability, Capital, Income, Expense).
   - Control Account indicators and "Add Account" modal.
2. **Customer Khata Ledgers (`/accounting/customer-ledgers`)**:
   - Summary cards for Total Receivables, Overdue Amount, and Active Khatas.
   - 3-Tab Master Drawer: Basic Info, Financial Settings (Credit Limit & Days), Account Status.
   - Action buttons for Khata Statement and Payment Collection.
3. **Customer Khata Statement (`/accounting/customer-statement/:customerId`)**:
   - Party profile header with current outstanding balance.
   - Summary boxes for Opening Balance, Total Invoiced, Total Paid, and Closing Balance.
   - Chronological ledger transaction table with running balance.
   - Print Statement and Payment Collection modal triggers.
4. **Vendor Ledgers (`/accounting/vendor-ledgers`)**:
   - Summary cards for Total Payables, Overdue Payables, and TDS tracked vendors.
   - 3-Tab Master Drawer for TDS settings, PAN, GSTIN, and credit terms.
5. **Vendor Statement (`/accounting/vendor-statement/:vendorId`)**:
   - Comprehensive statement with Purchases, Payments, TDS withholdings, and Returns.
6. **Customer Payment Collection Modal**:
   - Mode selection (CASH, UPI, CHEQUE, BANK TRANSFER).
   - Multi-invoice split allocation table with 1-Click "Auto-Split".
   - Advance Khata balance auto-calculation.
7. **Vendor Payout Modal**:
   - Gross invoice settlement input.
   - Statutory TDS deduction calculator (194Q, 194C, 194J).
   - Purchase return / Debit note adjustment selector.
   - Real-time Net Paid calculation.
8. **Cheque Clearance Management (`/accounting/cheques`)**:
   - Status tabs: All, Received, Deposited, Cleared, Bounced.
   - Deposit, Clear, and Bounce actions with ₹500 penalty alert.
9. **Aging Analysis Report (`/accounting/aging-report`)**:
   - Toggle between Customer Receivables and Vendor Payables.
   - 0-30, 31-60, 61-90, 90+ days visual progress bars and party table.
10. **Payments & Vouchers Register (`/accounting/payments`)**:
    - Complete voucher ledger with printable receipt slips.

---

## 7. What Has Been Done vs Remaining Roadmap

### Completed Deliverables (Done)
- [x] All 5 Mongoose Models created and indexed with audit fields.
- [x] Standard Chart of Accounts seeded and linked into MongoDB hierarchy.
- [x] Atomic session controllers for Customer Payments, Vendor Payouts, Cheque Lifecycles, and Statements.
- [x] Automatic ₹500 bounce penalty rule with dual audit reversal entries.
- [x] Multi-invoice split allocation and Advance Khata tracking.
- [x] TDS withholding and Debit Note adjustment settlement calculations.
- [x] 30/60/90/120+ days aging calculation engine.
- [x] Express REST API routes mounted under `/api/v1/*` and `/api/*`.
- [x] Frontend `accountingService.js` API client wrapper.
- [x] 10 React accounting components & modals created in `Wholesale-MVP`.
- [x] Frontend routes configured in `paths.js` and `config.jsx`.
- [x] Navigation group "Accounts & Payments" added to `Sidebar.jsx`.

### Future Expansion Roadmap (Remaining Enhancements)
- [ ] **Automated WhatsApp / SMS Payment Receipts**: Dispatch automated WhatsApp payment receipts and cheque bounce notifications to opticians using WhatsApp Cloud API.
- [ ] **Bank Statement (CAMT.053 / MT940 / CSV) Auto-Reconciliation**: OCR / parser for automated bank feed matching with receipts.
- [ ] **Automated E-Way Bill & E-Invoice Generation**: Direct IRP/NIC API integration for GST compliant e-invoicing.
- [ ] **Multi-Currency Support**: Support foreign currency transactions for international frame/lens imports.
