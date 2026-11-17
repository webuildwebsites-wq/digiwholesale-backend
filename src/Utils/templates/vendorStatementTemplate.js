import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

let staticLogoDataUrl = "";
try {
  const logoBase64 = readFileSync(
    join(__dirname, "../../../public/DigiOptics.png"),
  ).toString("base64");
  staticLogoDataUrl = `data:image/png;base64,${logoBase64}`;
} catch {
  staticLogoDataUrl = "";
}

const fmtNum = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) =>
  d
    ? new Date(d)
        .toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        .replace(/\//g, "-")
    : "—";

const formatModeLabel = (mode) => {
  if (!mode) return "Bank Transfer";
  const m = String(mode).toUpperCase();
  if (m === "UPI") return "UPI / QR Code";
  if (m === "CASH") return "Cash Payment";
  if (m === "BANK_TRANSFER") return "Bank Transfer / NEFT";
  if (m === "CHEQUE") return "Cheque / DD";
  return String(mode).replace(/_/g, " ");
};


export function generateVendorStatementHTML(data) {
  const {
    vendorName = "Vendor",
    vendorFirm = "",
    mobile = "",
    email = "",
    gstin = "",
    addr = "",
    ledgerCode = "VEND-LED",
    paymentTerms = 30,
    currentOutstanding = 0,
    totalDebit = 0,
    totalCredit = 0,
    wholesalerName = "SAANCHI & CO.",
    companyAddress = "New Delhi, India",
    companyPhone = "9650560526",
    companyEmail = "support@digioptics.com",
    companyGstin = "",
    companyLogo = "",
    generatedOn = new Date().toLocaleDateString("en-IN").replace(/\//g, "-"),
    statementPeriod = "All Time (Complete Ledger)",
    bankDetails = {},
    transactions = [],
  } = data;

  const finalLogo =
    (companyLogo && String(companyLogo).trim()) || staticLogoDataUrl;
  const cleanCompanyGstin =
    companyGstin &&
    !String(companyGstin).startsWith("http") &&
    !String(companyGstin).includes("/")
      ? String(companyGstin).trim()
      : "Unregistered";

  const bank = {
    bankName: bankDetails.bankName || "HDFC BANK",
    accountNo:
      bankDetails.accountNo || bankDetails.accountNumber || "50200084729104",
    ifscCode: bankDetails.ifscCode || "HDFC0000247",
    branch: bankDetails.branch || "SILIGURI BRANCH",
    holderName: bankDetails.holderName || wholesalerName,
    upiId: bankDetails.upiId || `${companyPhone}@upi`,
  };

  let effectivePeriod = statementPeriod;
  if (
    !effectivePeriod ||
    effectivePeriod.includes("All Time") ||
    effectivePeriod.includes("Complete Ledger")
  ) {
    if (transactions && transactions.length > 0) {
      const validDates = transactions
        .map((t) =>
          new Date(t.transactionDate || t.createdAt || t.orderDate).getTime(),
        )
        .filter((time) => !isNaN(time) && time > 0)
        .sort((a, b) => a - b);
      if (validDates.length > 0) {
        const fromStr = fmtDate(new Date(validDates[0]));
        const toStr = fmtDate(new Date(validDates[validDates.length - 1]));
        effectivePeriod =
          fromStr === toStr ? fromStr : `From ${fromStr} To ${toStr}`;
      }
    }
    if (
      !effectivePeriod ||
      effectivePeriod.includes("All Time") ||
      effectivePeriod.includes("Complete Ledger")
    ) {
      effectivePeriod = `As of ${generatedOn}`;
    }
  } else if (!effectivePeriod.toLowerCase().startsWith("from") && effectivePeriod.includes("to")) {
    effectivePeriod = `From ${effectivePeriod.replace(/\s+to\s+/i, " To ")}`;
  }

  // Filter out any standalone payment rows that are already displayed as nested installments under their parent Purchase Invoice
  const allocatedPaymentIds = new Set();
  (transactions || []).forEach((t) => {
    if (t.orderPayments && Array.isArray(t.orderPayments)) {
      t.orderPayments.forEach((p) => {
        if (p.paymentNumber) allocatedPaymentIds.add(String(p.paymentNumber));
        if (p.referenceNumber) allocatedPaymentIds.add(String(p.referenceNumber));
        if (p.paymentId) allocatedPaymentIds.add(String(p.paymentId));
        if (p._id) allocatedPaymentIds.add(String(p._id));
      });
    }
  });

  const displayTransactions = (transactions || []).filter((t) => {
    const isPayout =
      t.voucherType === "Payment Voucher" ||
      (t.referenceNumber &&
        (String(t.referenceNumber).startsWith("VPAY-") ||
          String(t.referenceNumber).startsWith("PAY-"))) ||
      (Number(t.debit) > 0 && !String(t.referenceNumber || "").startsWith("PO-"));

    if (!isPayout) return true;
    if (t.isOrderAllocatedPayment) return false;

    const ref = String(t.referenceNumber || "");
    const vId = String(t.voucherId || "");
    const id = String(t._id || "");

    if (
      (ref && allocatedPaymentIds.has(ref)) ||
      (vId && allocatedPaymentIds.has(vId)) ||
      (id && allocatedPaymentIds.has(id))
    ) {
      return false;
    }

    return true;
  });

  // Build Transaction Rows
  const rowsHtml =
    !displayTransactions || displayTransactions.length === 0
      ? `<tr><td colspan="7" style="text-align:center; padding:15px; color:#64748B; font-size:10px;">No transactions recorded for this vendor account.</td></tr>`
      : displayTransactions
          .map((t, idx) => {
            const d = fmtDate(t.transactionDate || t.createdAt);
            const isPurchase =
              t.voucherType === "Purchase Invoice" ||
              (t.referenceNumber && String(t.referenceNumber).startsWith("PO-"));
            const isPayout =
              t.voucherType === "Payment Voucher" ||
              (t.referenceNumber &&
                (String(t.referenceNumber).startsWith("VPAY-") ||
                  String(t.referenceNumber).startsWith("PAY-")));

            // Credit = purchase amount (what we owe vendor); Debit = payout (what we paid)
            const purchaseTotal = Number(
              t.orderGrandTotal != null ? t.orderGrandTotal : t.credit || 0,
            );
            const payoutAmount = Number(t.debit || 0);
            const orderBalanceDue = Number(
              t.orderBalanceDue != null
                ? t.orderBalanceDue
                : Math.max(0, purchaseTotal - (t.orderPaidAmount || 0)),
            );

            const creditStr =
              purchaseTotal > 0
                ? fmtNum(purchaseTotal)
                : Number(t.credit || 0) > 0
                  ? fmtNum(t.credit)
                  : "0.00";

            const debitStr =
              payoutAmount > 0 ? fmtNum(payoutAmount) : "0.00";

            const isFullyPaid = isPurchase && orderBalanceDue <= 0 && purchaseTotal > 0;
            const balStr = isPurchase
              ? isFullyPaid
                ? "Paid"
                : `₹${fmtNum(orderBalanceDue)} (Payable)`
              : isPayout
                ? `₹${fmtNum(payoutAmount)} (Paid Out)`
                : Number(t.runningBalance || 0) > 0
                  ? `₹${fmtNum(t.runningBalance)} (Payable)`
                  : Number(t.runningBalance || 0) < 0
                    ? `₹${fmtNum(Math.abs(t.runningBalance))} (Adv Paid)`
                    : "₹0.00";

            const ref = t.orderNumber || t.referenceNumber || t.voucherId || "—";

            let particulars = "";
            if (isPayout) {
              const detectedMode =
                t.paymentMode ||
                (t.narration?.toLowerCase().includes("upi")
                  ? "UPI"
                  : t.narration?.toLowerCase().includes("cash")
                    ? "CASH"
                    : "BANK_TRANSFER");
              particulars = `<span style="display:inline-block; font-weight:700; color:#059669; background:#dcfce7; padding:1px 4px; border-radius:2px; font-size:8px; margin-right:4px;">[${formatModeLabel(detectedMode)}]</span> Payout / Payment Issued`;
              if (
                t.narration &&
                !t.narration.toLowerCase().includes("payout issued via") &&
                !t.narration.toLowerCase().includes("payment issued")
              ) {
                particulars += ` &bull; ${t.narration}`;
              }
            } else if (isPurchase) {
              particulars = "Purchase Invoice";
              const rawNarration = t.narration || t.description || "";
              const isAutoGenerated =
                /Purchase Order #|Total:|Vendor:/i.test(rawNarration);
              if (rawNarration && !isAutoGenerated) {
                particulars += ` &bull; ${rawNarration}`;
              }
            } else {
              particulars = t.voucherType || t.description || "General Entry";
            }

            // Purchase Items sub-table (shows items, category, brand, buying price, ref id, order created date)
            const items = Array.isArray(t.items) ? t.items : [];
            const orderCreatedDate = t.orderDate || t.createdAt;
            const itemsRow =
              isPurchase && items.length > 0
                ? `
              <tr style="background:#fff8f8; border-bottom:1px solid #fca5a5;">
                <td colspan="7" style="padding:4px 6px 6px 6px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; padding-bottom:2px; border-bottom:1px dashed #fca5a5; font-size:8.5px;">
                    <span style="font-weight:800; color:#b91c1c; text-transform:uppercase; letter-spacing:0.3px;">
                      Purchase Items (${items.length} Product${items.length > 1 ? "s" : ""}) &bull; PO Ref: <strong style="font-family:monospace; color:#0284c7;">${ref}</strong> &bull; Order Created: <strong style="font-family:monospace; color:#0f172a;">${fmtDate(orderCreatedDate)}</strong>
                    </span>
                    <span style="color:#475569; font-weight:600;">
                      PO Status: <strong>${t.orderStatus || "Submitted"}</strong> &bull; Invoiced Total: <strong style="color:#b91c1c;">₹${creditStr}</strong>
                    </span>
                  </div>
                  <table style="width:100%; border-collapse:collapse; background:#ffffff; border:1px solid #f87171; font-size:8px;">
                    <thead>
                      <tr style="background:#fee2e2; border-bottom:1px solid #f87171; font-weight:700; color:#7f1d1d;">
                        <th style="width:28px; border-right:1px solid #fca5a5; padding:2.5px 3px; text-align:center;">#</th>
                        <th style="border-right:1px solid #fca5a5; padding:2.5px 5px; text-align:left;">Product / Item Name</th>
                        <th style="width:95px; border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:left;">Brand</th>
                        <th style="width:80px; border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:center;">Category / Type</th>
                        <th style="width:90px; border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:center;">Item Code / Ref</th>
                        <th style="width:40px; border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:center;">Qty</th>
                        <th style="width:85px; border-right:1px solid #fca5a5; padding:2.5px 5px; text-align:right;">Buying Price (₹)</th>
                        <th style="width:85px; padding:2.5px 5px; text-align:right;">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${items
                        .map((item, iIdx) => {
                          const itemName = item.itemName || item.productName || item.name || "Product";
                          const brand = item.brand || item.brandName || "—";
                          const category = item.category || item.categoryName || item.orderType || "STOCK";
                          const code = item.code || item.productCode || item.hsnSac || ref || "—";
                          const buyingPrice = Number(item.buyingPrice || item.price || 0);
                          const qty = Number(item.qty || 0);
                          const discount = Number(item.discountAmount || 0);
                          const total = buyingPrice * qty - discount;
                          return `
                            <tr style="border-bottom:1px solid #fee2e2;">
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 3px; text-align:center; font-weight:700; color:#64748b;">${iIdx + 1}</td>
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 5px; font-weight:600; color:#0f172a;">${itemName}</td>
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 4px; color:#334155;">${brand}</td>
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:center; font-weight:600; color:#475569;">${category}</td>
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:center; font-family:monospace; color:#0284c7;">${code}</td>
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 4px; text-align:center; font-weight:700; color:#0f172a;">${qty}</td>
                              <td style="border-right:1px solid #fca5a5; padding:2.5px 5px; text-align:right; font-family:monospace; font-weight:700; color:#475569;">₹${fmtNum(buyingPrice)}</td>
                              <td style="padding:2.5px 5px; text-align:right; font-family:monospace; font-weight:700; color:#0f172a;">₹${fmtNum(total)}</td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </td>
              </tr>
            `
                : "";

            // Payment Breakdown sub-table (for purchase orders with payment history)
            const paymentsRow =
              t.orderPayments &&
              Array.isArray(t.orderPayments) &&
              t.orderPayments.length > 0
                ? `
              <tr style="background:#f8fafc; border-bottom:1.5px solid #000000;">
                <td colspan="7" style="padding:4px 6px 6px 6px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; padding-bottom:2px; border-bottom:1px dashed #cbd5e1; font-size:8.5px;">
                    <span style="font-weight:800; color:#0369a1; text-transform:uppercase; letter-spacing:0.3px;">
                      Payment Breakdown &amp; Installments (${t.orderPayments.length} Record${t.orderPayments.length > 1 ? "s" : ""})
                    </span>
                    <span style="color:#475569; font-weight:600;">
                      Purchase Total: <strong>₹${creditStr}</strong> &bull; Total Paid: <strong style="color:#15803d;">₹${fmtNum(t.orderPaidAmount || 0)}</strong> &bull; Balance Payable: <strong style="color:${orderBalanceDue > 0 ? "#b91c1c" : "#15803d"};">₹${fmtNum(orderBalanceDue)}</strong>
                    </span>
                  </div>
                  <table style="width:100%; border-collapse:collapse; background:#ffffff; border:1px solid #94a3b8; font-size:8px;">
                    <thead>
                      <tr style="background:#e2e8f0; border-bottom:1px solid #94a3b8; font-weight:700; color:#334155;">
                        <th style="width:44px; border-right:1px solid #cbd5e1; padding:2.5px 3px; text-align:center;">Inst. #</th>
                        <th style="width:74px; border-right:1px solid #cbd5e1; padding:2.5px 4px; text-align:center;">Payment Date</th>
                        <th style="width:115px; border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:left;">Payment Method</th>
                        <th style="width:145px; border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:left;">Ref / Voucher / UTR</th>
                        <th style="border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:left;">Narration / Remarks</th>
                        <th style="width:85px; border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:right;">Amount (₹)</th>
                        <th style="width:62px; padding:2.5px 3px; text-align:center;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${t.orderPayments
                        .map((p, pIdx) => {
                          const pDate = fmtDate(
                            p.paymentDate || p.createdAt || t.transactionDate,
                          );
                          const pMode = formatModeLabel(p.paymentMode);
                          const pRef =
                            p.referenceNumber ||
                            p.paymentNumber ||
                            p.paymentId ||
                            "—";
                          let pRemarks =
                            p.remarks ||
                            "Payout Issued";
                          if (p.utrNumber && p.utrNumber !== pRef) {
                            pRemarks += ` (UTR: ${p.utrNumber})`;
                          }
                          if (p.bankName) {
                            pRemarks += ` [${p.bankName}]`;
                          }
                          const pStatus = p.status || "CLEARED";
                          const isCleared =
                            pStatus === "CLEARED" ||
                            pStatus === "PAID" ||
                            pStatus === "COMPLETED";
                          return `
                            <tr style="border-bottom:1px solid #e2e8f0;">
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 3px; text-align:center; font-weight:700; color:#475569;">#${pIdx + 1}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 4px; text-align:center; font-family:monospace; color:#1e293b;">${pDate}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; font-weight:600; color:#0f172a;">${pMode}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; font-family:monospace; font-weight:700; color:#0284c7;">${pRef}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; color:#475569;">${pRemarks}</td>
                              <td style="border-right:1px solid #cbd5e1; padding:2.5px 5px; text-align:right; font-family:monospace; font-weight:700; color:#15803d;">₹${fmtNum(p.amount)}</td>
                              <td style="padding:2.5px 3px; text-align:center;">
                                <span style="font-weight:700; font-size:7.5px; padding:1px 3px; border-radius:2px; ${isCleared ? "background:#dcfce7; color:#15803d; border:0.5px solid #86efac;" : "background:#fef3c7; color:#b45309; border:0.5px solid #fde68a;"}">
                                  ${pStatus}
                                </span>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </td>
              </tr>
            `
                : "";

            const separatorRow =
              idx > 0
                ? `
              <tr style="height: 14px;">
                <td colspan="7" style="height: 14px; padding: 0; background: #f1f5f9; border-top: 2px solid #000000; border-bottom: 1.5px solid #000000;"></td>
              </tr>
            `
                : "";

            const balColor = isFullyPaid
              ? "#15803d"
              : isPurchase && orderBalanceDue > 0
                ? "#b91c1c"
                : "#0f172a";

            return `
                ${separatorRow}
                <tr style="border-bottom: 1px solid #000000;">
                  <td style="border-right:1px solid #000; padding:6px 4px; text-align:center; font-size:10px; font-weight:700;">${idx + 1}</td>
                  <td style="border-right:1px solid #000; padding:6px 4px; text-align:center; font-family:monospace; font-size:9.5px;">${d}</td>
                  <td style="border-right:1px solid #000; padding:6px 6px; font-family:monospace; font-weight:700; font-size:10px; color:#0284c7;">${ref}</td>
                  <td style="border-right:1px solid #000; padding:6px 6px; font-size:9.5px; color:#1e293b;">${particulars}</td>
                  <td style="border-right:1px solid #000; padding:6px 6px; text-align:right; font-family:monospace; font-size:10px; font-weight:700; color:#059669;">${debitStr}</td>
                  <td style="border-right:1px solid #000; padding:6px 6px; text-align:right; font-family:monospace; font-size:10px; font-weight:600; color:#b91c1c;">${creditStr}</td>
                  <td style="padding:6px 6px; text-align:right; font-family:monospace; font-size:10px; font-weight:700; color:${balColor};">${balStr}</td>
                </tr>
                ${itemsRow}
                ${paymentsRow}
              `;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vendor Ledger Statement - ${vendorFirm || vendorName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: #000000;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  <div style="width: 100%; max-width: 800px; margin: 0 auto; border: 1.5px solid #000000; background: #ffffff;">

    <!-- 1. Header: Logo, Wholesaler Info, Statement Meta -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000000;">
      <tr>
        <td style="width: 125px; padding: 6px; vertical-align: middle; text-align: center; border-right: 1px solid #000000;">
          ${finalLogo ? `<img src="${finalLogo}" alt="Logo" style="max-width: 110px; max-height: 52px; object-fit: contain;" />` : `<div style="font-weight: 900; font-size: 13px;">${wholesalerName}</div>`}
        </td>
        <td style="padding: 6px 12px; vertical-align: middle;">
          <div style="font-weight: 900; font-size: 15px; color: #000000; text-transform: uppercase; letter-spacing: 0.5px;">${wholesalerName}</div>
          <div style="font-size: 9.5px; color: #1e293b; margin-top: 2px; line-height: 1.35;">${companyAddress}</div>
          <div style="font-size: 9.5px; color: #1e293b; margin-top: 2px;">Phone: <strong>${companyPhone}</strong> | Email: <strong>${companyEmail}</strong></div>
          ${cleanCompanyGstin && cleanCompanyGstin !== "Unregistered" ? `<div style="font-size: 9px; color: #475569; margin-top: 1px;">GSTIN: <strong style="font-family:monospace;">${cleanCompanyGstin}</strong></div>` : ""}
        </td>
        <td style="width: 210px; padding: 6px 10px; vertical-align: middle; border-left: 1px solid #000000; font-size: 9px; line-height: 1.4;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-weight: 700; width: 90px;">Statement Date:</td>
              <td style="font-weight: 600; font-family: monospace;">${generatedOn}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Period:</td>
              <td style="font-weight: 700; color: #0f172a; font-size: 8.5px;">${effectivePeriod}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Ledger Code:</td>
              <td style="font-weight: 800; font-family: monospace; color: #0284c7;">${ledgerCode}</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Payment Terms:</td>
              <td style="font-weight: 600;">${paymentTerms} Days</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 2. Title Banner -->
    <div style="text-align: center; font-weight: 800; font-size: 11px; padding: 4px 0; letter-spacing: 1px; background: #f8fafc; border-bottom: 1.5px solid #000000; text-transform: uppercase; color: #0f172a;">
      VENDOR / SUPPLIER LEDGER STATEMENT
    </div>

    <!-- 3. Vendor & Account Info -->
    <div style="display: flex; border-bottom: 1.5px solid #000000;">
      <!-- Vendor Details -->
      <div style="flex: 1.25; padding: 6px 10px; border-right: 1px solid #000000; font-size: 9.5px; line-height: 1.4;">
        <div style="font-weight: 800; font-size: 9.5px; text-transform: uppercase; color: #b91c1c; margin-bottom: 2px;">VENDOR / SUPPLIER DETAILS</div>
        <div style="font-weight: 800; font-size: 11.5px; color: #000000;">${vendorFirm || vendorName}</div>
        ${vendorFirm ? `<div style="color: #334155; margin-top: 1px;">Contact: <strong>${vendorName}</strong></div>` : ""}
        <div style="color: #334155; margin-top: 1px;">Mobile: <strong>${mobile || "N/A"}</strong> | Email: <strong>${email || "N/A"}</strong></div>
        <div style="color: #334155;">Address: ${addr || "N/A"}</div>
        <div style="margin-top: 2px;">GSTIN: <strong style="font-family: monospace; font-size: 10px;">${gstin || "Unregistered / Non-GST"}</strong></div>
      </div>

      <!-- Account Terms -->
      <div style="flex: 1; padding: 6px 10px; font-size: 9.5px; line-height: 1.4;">
        <div style="font-weight: 800; font-size: 9.5px; text-transform: uppercase; color: #059669; margin-bottom: 2px;">ACCOUNT & PAYMENT TERMS</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <tr>
            <td style="font-weight: 750; width: 95px;">Ledger Code:</td>
            <td style="font-family: monospace; font-weight: 700;">${ledgerCode}</td>
          </tr>
          <tr>
            <td style="font-weight: 750;">Payment Terms:</td>
            <td style="font-weight: 600;">${paymentTerms} Days</td>
          </tr>
          <tr>
            <td style="font-weight: 750;">Account Status:</td>
            <td style="font-weight: 700; color: ${currentOutstanding > 0 ? "#b91c1c" : "#15803d"};">
              ${currentOutstanding > 0 ? `₹${fmtNum(currentOutstanding)} (Payable)` : "₹0.00 (Settled)"}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 4. Financial Status Strip -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #000000; font-size: 9.5px; background: #f8fafc;">
      <tr>
        <td style="width: 25%; padding: 5px 8px; border-right: 1px solid #000000; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Total Purchased</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: #b91c1c; margin-top: 2px;">₹${fmtNum(totalCredit)}</div>
        </td>
        <td style="width: 25%; padding: 5px 8px; border-right: 1px solid #000000; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Total Paid Out</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: #15803d; margin-top: 2px;">₹${fmtNum(totalDebit)}</div>
        </td>
        <td style="width: 25%; padding: 5px 8px; border-right: 1px solid #000000; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Net Outstanding</div>
          <div style="font-size: 11.5px; font-weight: 800; font-family: monospace; color: ${currentOutstanding > 0 ? "#b91c1c" : "#15803d"}; margin-top: 2px;">₹${fmtNum(currentOutstanding)}</div>
        </td>
        <td style="width: 25%; padding: 5px 8px; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 700; color: #475569; text-transform: uppercase;">Account Status</div>
          <div style="font-size: 10.5px; font-weight: 800; font-family: monospace; color: ${currentOutstanding > 0 ? "#b91c1c" : "#15803d"}; margin-top: 2px;">
            ${currentOutstanding > 0 ? "PAYABLE DUE" : "SETTLED"}
          </div>
        </td>
      </tr>
    </table>

    <!-- 5. Transactions Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
      <thead>
        <tr style="background: #ffffff; border-bottom: 1px solid #000000; font-weight: 700;">
          <th style="width: 28px; border-right: 1px solid #000; padding: 4px 2px; text-align: center;">#</th>
          <th style="width: 75px; border-right: 1px solid #000; padding: 4px 4px; text-align: center;">Date</th>
          <th style="width: 130px; border-right: 1px solid #000; padding: 4px 6px; text-align: left;">Ref No.</th>
          <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: left;">Particulars &amp; Narration</th>
          <th style="width: 85px; border-right: 1px solid #000; padding: 4px 6px; text-align: right;">Paid Out (₹)</th>
          <th style="width: 85px; border-right: 1px solid #000; padding: 4px 6px; text-align: right;">Purchase (₹)</th>
          <th style="width: 90px; padding: 4px 6px; text-align: right;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- 6. Summary Footer -->
    <table style="width: 100%; border-collapse: collapse; border-top: 1.5px solid #000000; font-size: 9px;">
      <tr>
        <td style="width: 50%; padding: 6px 10px; border-right: 1px solid #000000; vertical-align: top;">
          <div style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #0369a1; margin-bottom: 3px;">Our Bank Details (For Reference)</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
            <tr><td style="font-weight: 700; width: 80px;">Bank:</td><td>${bank.bankName}</td></tr>
            <tr><td style="font-weight: 700;">A/C No.:</td><td style="font-family:monospace;">${bank.accountNo}</td></tr>
            <tr><td style="font-weight: 700;">IFSC:</td><td style="font-family:monospace;">${bank.ifscCode}</td></tr>
            <tr><td style="font-weight: 700;">Branch:</td><td>${bank.branch}</td></tr>
          </table>
        </td>
        <td style="width: 50%; padding: 6px 10px; vertical-align: top;">
          <div style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #059669; margin-bottom: 3px;">Notes &amp; Audit Information</div>
          <ul style="padding-left: 14px; font-size: 8px; line-height: 1.5; color: #475569;">
            <li>This is a computer-generated vendor ledger statement.</li>
            <li>Verify all purchase bills, debit notes, and payout entries.</li>
            <li>Discrepancies must be reported within 7 business days.</li>
            <li>All payouts issued through authorized banking channels.</li>
          </ul>
          <div style="margin-top: 10px; text-align: right;">
            <div style="font-weight: 800; color: #0f172a; font-size: 9px;">For ${wholesalerName}</div>
            <div style="margin-top: 20px; border-top: 1px solid #000; display: inline-block; padding-top: 2px; min-width: 120px; text-align: center; font-size: 8.5px; color: #64748b;">Authorized Signatory</div>
          </div>
        </td>
      </tr>
    </table>

  </div>
</body>
</html>`;
}
