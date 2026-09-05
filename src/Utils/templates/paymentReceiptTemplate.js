import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let logoDataUrl = '';
try {
    const logoBase64 = readFileSync(
        join(__dirname, '../../../public/DigiOptics.png'),
    ).toString('base64');
    logoDataUrl = `data:image/png;base64,${logoBase64}`;
} catch {
    logoDataUrl = '';
}

// Number to Words Converter for INR
function numberToWordsINR(num) {
    if (!num || isNaN(num)) return 'Zero Rupees Only';

    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const numToWordsLessThanThousand = (n) => {
        let str = '';
        if (n > 99) {
            str += a[Math.floor(n / 100)] + 'Hundred ';
            n %= 100;
        }
        if (n > 19) {
            str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
        } else if (n > 0) {
            str += a[n];
        }
        return str;
    };

    const parts = Number(num).toFixed(2).split('.');
    let rupees = parseInt(parts[0], 10);
    const paise = parseInt(parts[1], 10);

    if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

    let result = '';
    const crore = Math.floor(rupees / 10000000);
    rupees %= 10000000;
    const lakh = Math.floor(rupees / 100000);
    rupees %= 100000;
    const thousand = Math.floor(rupees / 1000);
    rupees %= 1000;

    if (crore > 0) result += numToWordsLessThanThousand(crore) + 'Crore ';
    if (lakh > 0) result += numToWordsLessThanThousand(lakh) + 'Lakh ';
    if (thousand > 0) result += numToWordsLessThanThousand(thousand) + 'Thousand ';
    if (rupees > 0) result += numToWordsLessThanThousand(rupees);

    result = result.trim() + ' Rupees';

    if (paise > 0) {
        result += ' and ' + numToWordsLessThanThousand(paise).trim() + ' Paise';
    }

    return result + ' Only';
}

/**
 * 1. PAYMENT RECEIPT HTML TEMPLATE (PDF Generation)
 * Styled in Enterprise DigiOptics Wholesale Aesthetic (#1B6496 / #0284C7)
 */
export const generatePaymentReceiptHTML = (data) => {
    const {
        receiptNo,
        receiptDate,
        company = {
            name: 'DigiOptics Wholesale',
            addressLine1: 'WeWork Eldeco Centre, Block A, Shivalik Colony',
            addressLine2: 'Malviya Nagar, New Delhi, Delhi 110017',
            phone: '+91 9650560526',
            email: 'support@digioptics.com',
            gstin: 'GST9876543210',
        },
        customer = {},
        paymentMode = 'CASH',
        grossAmount = 0,
        paymentDetails = {},
        allocations = [],
        narration = '',
        accountSummary = {},
    } = data;

    const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDate = receiptDate ? new Date(receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleDateString('en-IN');
    const amountInWords = numberToWordsINR(grossAmount);

    const modeLabels = {
        CASH: 'Cash',
        UPI: 'UPI / QR Transfer',
        CHEQUE: 'Cheque Payment',
        BANK_TRANSFER: 'Bank Transfer / NEFT / RTGS',
        NEFT: 'NEFT Transfer',
        RTGS: 'RTGS Transfer',
        ONLINE: 'Online Payment Gateway',
        ADVANCE_ADJUSTMENT: 'Advance Khata Adjustment',
    };

    const modeName = modeLabels[paymentMode] || paymentMode;

    let referenceDetails = [];
    if (paymentMode === 'CHEQUE') {
        if (paymentDetails.chequeNumber) referenceDetails.push(`<strong>Cheque No:</strong> ${paymentDetails.chequeNumber}`);
        if (paymentDetails.bankName) referenceDetails.push(`<strong>Bank:</strong> ${paymentDetails.bankName}`);
        if (paymentDetails.chequeDate) referenceDetails.push(`<strong>Cheque Date:</strong> ${paymentDetails.chequeDate}`);
    } else if (paymentMode === 'UPI') {
        if (paymentDetails.upiTransactionId || paymentDetails.transactionId) referenceDetails.push(`<strong>UPI Ref / UTR:</strong> ${paymentDetails.upiTransactionId || paymentDetails.transactionId}`);
    } else if (paymentMode === 'BANK_TRANSFER' || paymentMode === 'NEFT' || paymentMode === 'RTGS') {
        if (paymentDetails.referenceNumber || paymentDetails.utrNumber) referenceDetails.push(`<strong>UTR / Ref No:</strong> ${paymentDetails.referenceNumber || paymentDetails.utrNumber}`);
        if (paymentDetails.bankName) referenceDetails.push(`<strong>Bank:</strong> ${paymentDetails.bankName}`);
    } else if (paymentMode === 'CASH') {
        if (paymentDetails.cashVoucherNo) referenceDetails.push(`<strong>Voucher No:</strong> ${paymentDetails.cashVoucherNo}`);
    }

    if (paymentDetails.collectedByName) {
        referenceDetails.push(`<strong>Collected By:</strong> ${paymentDetails.collectedByName}`);
    }

    const allocationRows = allocations && allocations.length > 0
        ? allocations.map((alloc, idx) => `
            <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="text-align:center;color:#64748b;font-weight:600;padding:8px 10px;">${idx + 1}</td>
                <td style="font-weight:700;color:#0284c7;padding:8px 10px;">${alloc.invoiceNumber || alloc.invoiceId || 'Order Settlement'}</td>
                <td style="text-align:right;padding:8px 10px;color:#475569;">₹${fmtNum(alloc.invoiceTotal || alloc.allocatedAmount)}</td>
                <td style="text-align:right;font-weight:700;color:#059669;padding:8px 10px;">₹${fmtNum(alloc.allocatedAmount)}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="4" style="text-align:center;padding:12px;color:#64748b;font-style:italic;">
                    General payment received / Credited to Customer Account Balance
                </td>
            </tr>
        `;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payment Receipt - ${receiptNo}</title>
<style>
    @page {
        size: A4 portrait;
        margin: 10mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    body {
        background-color: #f1f5f9;
        display: flex;
        justify-content: center;
        padding: 15px 0;
        color: #1e293b;
    }
    .receipt-container {
        width: 190mm;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .header-bar {
        background: linear-gradient(135deg, #1B6496 0%, #0284c7 100%);
        color: #ffffff;
        padding: 18px 22px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .receipt-title {
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .receipt-badge {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.4);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .meta-grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        border-bottom: 1px solid #e2e8f0;
    }
    .company-cell {
        padding: 16px 20px;
        border-right: 1px solid #e2e8f0;
    }
    .meta-cell {
        padding: 16px 20px;
        background: #f8fafc;
    }
    .brand-logo {
        height: 70px;
        max-width: 280px;
        object-fit: contain;
        display: block;
        margin-bottom: 8px;
    }
    .company-info {
        font-size: 11px;
        color: #475569;
        line-height: 1.45;
    }
    .meta-table {
        width: 100%;
        font-size: 11.5px;
    }
    .meta-table td {
        padding: 3px 0;
        vertical-align: top;
    }
    .meta-label {
        font-weight: 700;
        color: #475569;
        width: 42%;
    }
    .meta-val {
        color: #0f172a;
        font-weight: 600;
    }
    .customer-strip {
        padding: 14px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .section-heading {
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #0284c7;
        margin-bottom: 6px;
    }
    .customer-name {
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 2px;
    }
    .customer-info {
        font-size: 11px;
        color: #475569;
        line-height: 1.4;
    }
    .amount-highlight-box {
        margin: 18px 20px;
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border: 1.5px solid #86efac;
        border-radius: 8px;
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .amount-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        color: #166534;
        letter-spacing: 0.5px;
    }
    .amount-words {
        font-size: 11.5px;
        font-weight: 600;
        color: #15803d;
        margin-top: 3px;
    }
    .amount-value {
        font-size: 24px;
        font-weight: 900;
        color: #166534;
    }
    .table-section {
        padding: 0 20px 16px 20px;
    }
    .receipt-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #e2e8f0;
        font-size: 11px;
        border-radius: 6px;
        overflow: hidden;
    }
    .receipt-table th {
        background: #f1f5f9;
        color: #334155;
        font-weight: 800;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.5px;
        padding: 8px 10px;
        border-bottom: 1.5px solid #cbd5e1;
    }
    .receipt-table td {
        border-bottom: 1px solid #e2e8f0;
    }
    .summary-grid {
        padding: 0 20px 18px 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }
    .info-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px 14px;
        font-size: 11px;
    }
    .info-card p {
        margin-bottom: 4px;
        color: #475569;
    }
    .info-card p strong {
        color: #0f172a;
    }
    .footer-bar {
        border-top: 1px solid #e2e8f0;
        padding: 14px 20px;
        background: #f8fafc;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
        color: #64748b;
    }
    .signature-box {
        text-align: right;
    }
    .signature-line {
        margin-top: 28px;
        border-top: 1px solid #94a3b8;
        padding-top: 4px;
        font-weight: 700;
        color: #334155;
    }
</style>
</head>
<body>
<div class="receipt-container">

    <!-- HEADER BAR -->
    <div class="header-bar">
        <div>
            <div class="receipt-title">Payment Receipt</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">DigiOptics Wholesale Management System</div>
        </div>
        <div class="receipt-badge">Payment Received</div>
    </div>

    <!-- SUPPLIER & RECEIPT METADATA -->
    <div class="meta-grid">
        <div class="company-cell">
            ${logoDataUrl ? `<img src="${logoDataUrl}" alt="DigiOptics" class="brand-logo" />` : '<div style="font-size:18px;font-weight:800;color:#0284c7;margin-bottom:6px;">DigiOptics Wholesale</div>'}
            <div class="company-info">${company.addressLine1 || 'WeWork Eldeco Centre, Block A, Shivalik Colony'}</div>
            <div class="company-info">${company.addressLine2 || 'Malviya Nagar, New Delhi, Delhi 110017'}</div>
            <div class="company-info" style="margin-top:4px;"><strong>GSTIN:</strong> ${company.gstin || 'GST9876543210'} | <strong>Phone:</strong> ${company.phone || '+91 9650560526'}</div>
        </div>
        <div class="meta-cell">
            <table class="meta-table">
                <tr>
                    <td class="meta-label">Receipt No</td>
                    <td class="meta-val">: ${receiptNo}</td>
                </tr>
                <tr>
                    <td class="meta-label">Receipt Date</td>
                    <td class="meta-val">: ${formattedDate}</td>
                </tr>
                <tr>
                    <td class="meta-label">Payment Mode</td>
                    <td class="meta-val">: <span style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:4px;font-weight:700;">${modeName}</span></td>
                </tr>
                <tr>
                    <td class="meta-label">Payment Status</td>
                    <td class="meta-val">: <span style="color:#15803d;font-weight:700;">COMPLETED / CLEARED</span></td>
                </tr>
            </table>
        </div>
    </div>

    <!-- CUSTOMER DETAILS STRIP -->
    <div class="customer-strip">
        <div>
            <div class="section-heading">Received From (Customer)</div>
            <div class="customer-name">${customer.shopName || customer.ownerName || 'Valued Customer'}</div>
            <div class="customer-info"><strong>Owner Name:</strong> ${customer.ownerName || '—'}</div>
            <div class="customer-info"><strong>Customer Code:</strong> ${customer.customerCode || '—'}</div>
            <div class="customer-info"><strong>GSTIN:</strong> ${customer.gstNumber || '—'}</div>
        </div>
        <div>
            <div class="section-heading">Contact & Billing Address</div>
            <div class="customer-info"><strong>Phone:</strong> ${customer.mobileNo1 || customer.mobile || '—'}</div>
            <div class="customer-info"><strong>Email:</strong> ${customer.businessEmail || customer.email || '—'}</div>
            <div class="customer-info"><strong>Address:</strong> ${customer.billToAddress?.address || customer.address || '—'}</div>
        </div>
    </div>

    <!-- AMOUNT HIGHLIGHT BOX -->
    <div class="amount-highlight-box">
        <div>
            <div class="amount-label">Amount Received in Words</div>
            <div class="amount-words">${amountInWords}</div>
        </div>
        <div style="text-align: right;">
            <div class="amount-label" style="text-align: right;">Total Received</div>
            <div class="amount-value">₹ ${fmtNum(grossAmount)}</div>
        </div>
    </div>

    <!-- PAYMENT / REFERENCE DETAILS & ACCOUNT IMPACT -->
    <div class="summary-grid">
        <div class="info-card">
            <div class="section-heading">Transaction & Reference Info</div>
            <p><strong>Payment Mode:</strong> ${modeName}</p>
            ${referenceDetails.length > 0 ? referenceDetails.map(d => `<p>${d}</p>`).join('') : '<p>Direct Cash / Account Inflow</p>'}
            ${narration ? `<p style="margin-top:6px;font-style:italic;"><strong>Note:</strong> ${narration}</p>` : ''}
        </div>

        <div class="info-card">
            <div class="section-heading">Customer Khata Position</div>
            <p><strong>Amount Adjusted against Due:</strong> ₹${fmtNum(paymentDetails.adjustedFromCreditUsed || 0)}</p>
            <p><strong>Added to Advance Deposit (Jama):</strong> ₹${fmtNum(paymentDetails.advanceCredited || (paymentDetails.adjustedFromCreditUsed ? 0 : grossAmount))}</p>
            <div style="margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1;">
                <p><strong>Current Outstanding Due (Udhaar):</strong> <span style="font-weight:800;color:${(accountSummary.remainingCreditUsed || 0) > 0 ? '#b91c1c' : '#15803d'}">₹${fmtNum(accountSummary.remainingCreditUsed || 0)}</span></p>
                <p><strong>Available Advance Deposit (Jama):</strong> <span style="font-weight:800;color:#0284c7">₹${fmtNum(accountSummary.customerBalance || 0)}</span></p>
            </div>
        </div>
    </div>

    <!-- INVOICE / ORDER ALLOCATIONS TABLE -->
    <div class="table-section">
        <div class="section-heading" style="margin-bottom:6px;">Invoice Settlement & Order Allocation Details</div>
        <table class="receipt-table">
            <thead>
                <tr>
                    <th style="width: 8%; text-align:center;">#</th>
                    <th style="width: 44%; text-align:left;">Invoice / Order Ref No.</th>
                    <th style="width: 24%; text-align:right;">Invoice Total</th>
                    <th style="width: 24%; text-align:right;">Amount Settled</th>
                </tr>
            </thead>
            <tbody>
                ${allocationRows}
            </tbody>
        </table>
    </div>

    <!-- FOOTER & SIGNATURE -->
    <div class="footer-bar">
        <div>
            <div>Thank you for your business!</div>
            <div style="margin-top:2px;">This is a system-generated official payment receipt. No physical signature required.</div>
        </div>
        <div class="signature-box">
            <div class="signature-line">For DigiOptics Wholesale</div>
        </div>
    </div>

</div>
</body>
</html>`;
};

/**
 * 2. PAYMENT CONFIRMATION EMAIL HTML TEMPLATE
 * Sent to customer's business email with attached PDF receipt
 */
export const generatePaymentEmailHTML = (data) => {
    const {
        customerName,
        shopName,
        receiptNo,
        amount,
        receiptDate,
        paymentMode = 'CASH',
        remainingDue = 0,
        availableAdvance = 0,
    } = data;

    const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDate = receiptDate ? new Date(receiptDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleDateString('en-IN');

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1B6496 0%, #0284c7 100%); padding: 24px 30px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">DigiOptics Wholesale</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Payment Confirmation & Receipt</p>
        </div>

        <!-- Body -->
        <div style="padding: 30px 25px; color: #334155;">
            
            <p style="font-size: 15px; margin-top: 0; color: #0f172a;">Dear <strong>${shopName || customerName || 'Valued Customer'}</strong>,</p>
            
            <p style="font-size: 14px; line-height: 1.6;">
                We are pleased to inform you that your payment of <strong style="color: #166534; font-size: 16px;">₹${fmtNum(amount)}</strong> has been successfully received and credited to your account.
            </p>

            <!-- Highlight Card -->
            <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 18px 20px; margin: 20px 0; text-align: center;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.5px;">Payment Received</div>
                <div style="font-size: 28px; font-weight: 900; color: #15803d; margin: 6px 0;">₹ ${fmtNum(amount)}</div>
                <div style="font-size: 12px; color: #166534;">Receipt No: <strong>${receiptNo}</strong></div>
            </div>

            <!-- Transaction Summary Table -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Receipt Number</td>
                    <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right;">${receiptNo}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Date & Time</td>
                    <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">${formattedDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Payment Mode</td>
                    <td style="padding: 10px 0; font-weight: 700; color: #0284c7; text-align: right;">${paymentMode}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Outstanding Due (Udhaar)</td>
                    <td style="padding: 10px 0; font-weight: 700; color: ${remainingDue > 0 ? '#b91c1c' : '#15803d'}; text-align: right;">₹${fmtNum(remainingDue)}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Advance Balance (Jama)</td>
                    <td style="padding: 10px 0; font-weight: 700; color: #0284c7; text-align: right;">₹${fmtNum(availableAdvance)}</td>
                </tr>
            </table>

            <div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 4px; margin-top: 25px; font-size: 13px; line-height: 1.5;">
                📎 <strong>Receipt Attached:</strong> Your official payment receipt PDF is attached to this email for your accounting records.
            </div>

            <p style="font-size: 13px; color: #64748b; margin-top: 25px; line-height: 1.5;">
                If you have any questions or require statement clarification, please reach out to our accounts team at <a href="mailto:support@digioptics.com" style="color: #0284c7; text-decoration: none; font-weight: 600;">support@digioptics.com</a> or call <strong>+91 9650560526</strong>.
            </p>

            <p style="font-size: 14px; margin-bottom: 0; color: #0f172a;">
                Warm regards,<br/>
                <strong>DigiOptics Wholesale Accounts Team</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f1f5f9; padding: 16px 25px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
            DigiOptics Wholesale • WeWork Eldeco Centre, Malviya Nagar, New Delhi 110017<br/>
            GSTIN: GST9876543210
        </div>
    </div>
    `;
};
