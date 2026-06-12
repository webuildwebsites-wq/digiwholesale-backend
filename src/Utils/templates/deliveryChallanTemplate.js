export const generateDeliveryChallanHTML = (data) => {
    const {
        billNumber,
        orderDate,
        deliveryDate,
        companyName,
        companyAddress,
        companyEmail,
        companyPhone,
        companyGstin,
        customerName,
        customerAddress,
        customerPhone,
        orders = [],
    } = data;

    const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN") : "-";
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-";
    const fmtNum = (n) => Number(n || 0).toFixed(2);

    let allItems = [];
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let subTotal = 0;
    let totalDiscount = 0;

    for (const order of orders) {
        const cgstRate = parseFloat(order.cgst || 0);
        const sgstRate = parseFloat(order.sgst || 0);

        for (const item of order.items) {
            const price      = Number(item.price || 0);
            const qty        = Number(item.qty || 0);
            const discAmt    = Number(item.discountAmount || 0);
            const baseAmount = price * qty;
            const amount     = baseAmount - discAmt;

            const cgstAmt = (amount * cgstRate) / 100;
            const sgstAmt = (amount * sgstRate) / 100;

            subTotal      += amount;
            totalCgst     += cgstAmt;
            totalSgst     += sgstAmt;
            totalDiscount += discAmt;

            const powers = item.rx?.powers || [];
            const rPower = powers.find(p => p.side === "R");
            const lPower = powers.find(p => p.side === "L");

            allItems.push({
                itemName:  item.itemName  || "-",
                type:      item.orderType || "-",
                sph:       item.sph       ?? (rPower?.sph ?? "-"),
                cyl:       item.cyl       ?? (rPower?.cyl ?? "-"),
                axis:      item.axis      ?? (rPower?.axis ?? "-"),
                add:       item.add       ?? (rPower?.add ?? "-"),
                qty,
                price,
                discAmt,
                amount,
            });
        }
    }

    const grandTotal = subTotal + totalCgst + totalSgst + totalIgst;

    const itemRows = allItems.map((item, i) => `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#ddeeff"}">
            <td>${item.itemName}</td>
            <td>${item.type}</td>
            <td>${item.sph}</td>
            <td>${item.cyl}</td>
            <td>${item.axis}</td>
            <td>${item.add}</td>
            <td>${item.qty}</td>
            <td>₹${fmtNum(item.price)}</td>
            <td>₹${fmtNum(item.discAmt)}</td>
            <td>₹${fmtNum(item.amount)}</td>
        </tr>
    `).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sale Challan</title>
<style>
    @page { size: A4; margin: 24px; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; }

    .wrap { max-width: 800px; margin: auto; padding: 20px; }

    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }

    .top-left p { margin-bottom: 3px; }
    .top-left strong { font-weight: bold; }

    .top-center { text-align: center; }
    .logo { font-size: 26px; font-weight: bold; color: #000; }
    .logo span { color: #e05a00; }
    .challan-title { font-size: 14px; font-weight: bold; margin-top: 4px; }

    .top-right { text-align: right; }
    .top-right p { margin-bottom: 3px; }
    .customer-details { margin-top: 8px; }
    .customer-details p { margin-bottom: 2px; }

    .divider { border: none; border-top: 1.5px solid #bbb; margin: 14px 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #cce0f5; }
    th { padding: 8px 6px; text-align: center; font-weight: bold; font-size: 11px; border: 1px solid #b0c8e0; }
    td { padding: 7px 6px; text-align: center; border: 1px solid #d0dce8; font-size: 11px; }
    td:first-child { text-align: left; }

    .tax-box { border: 1px solid #ccc; border-radius: 6px; padding: 14px; margin-bottom: 20px; }
    .tax-box .tax-title { font-weight: bold; font-size: 12px; margin-bottom: 10px; }
    .tax-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .tax-row .tax-col { flex: 1; }
    .tax-row .tax-col .label { font-weight: bold; font-size: 11px; margin-bottom: 3px; }
    .tax-row .tax-col .val { font-size: 12px; }
    .tax-divider { border: none; border-top: 1px solid #ddd; margin: 8px 0; }

    .footer { margin-top: 24px; font-size: 10px; color: #444; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer ul { padding-left: 14px; }
    .footer ul li { margin-bottom: 3px; }
    .footer .sig { font-style: italic; font-size: 10px; }
</style>
</head>
<body>
<div class="wrap">

    <div class="top">
        <div class="top-left">
            <p><strong>Bill Number:</strong> ${billNumber}</p>
            <p><strong>Company Name:</strong> ${companyName}</p>
            <p><strong>Address:</strong> ${companyAddress}</p>
            <p><strong>Email:</strong> ${companyEmail}</p>
            <p><strong>Phone:</strong> ${companyPhone}</p>
            <p><strong>GSTIN:</strong> ${companyGstin}</p>
        </div>

        <div class="top-center">
            <div class="logo">Digi<span>&#9673;</span>ptics</div>
            <div class="challan-title">Sale Challan</div>
        </div>

        <div class="top-right">
            <p><strong>Date of Order:</strong> ${fmt(orderDate)}</p>
            <p><strong>Time of Order:</strong> ${fmtTime(orderDate)}</p>
            <p><strong>Date of Delivery:</strong> ${fmt(deliveryDate)}</p>
            <div class="customer-details">
                <p><strong>CUSTOMER DETAILS:</strong></p>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Address:</strong> ${customerAddress || "-"}</p>
                <p><strong>Phone:</strong> ${customerPhone || "-"}</p>
            </div>
        </div>
    </div>

    <hr class="divider" />

    <table>
        <thead>
            <tr>
                <th>Product Name</th>
                <th>Type</th>
                <th>Spl.</th>
                <th>Cyl.</th>
                <th>Axis</th>
                <th>Add</th>
                <th>Qty.</th>
                <th>Price</th>
                <th>Disc.</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${itemRows}
        </tbody>
    </table>

    <div class="tax-box">
        <div class="tax-title">TAX SUMMARY</div>
        <div class="tax-row">
            <div class="tax-col"><div class="label">Sub-Total</div><div class="val">${fmtNum(subTotal)}</div></div>
            <div class="tax-col"><div class="label">Add. Discount</div><div class="val">${fmtNum(totalDiscount)}</div></div>
            <div class="tax-col"><div class="label">SGST</div><div class="val">${fmtNum(totalSgst)}</div></div>
            <div class="tax-col"><div class="label">CGST</div><div class="val">${fmtNum(totalCgst)}</div></div>
            <div class="tax-col"><div class="label">IGST</div><div class="val">${fmtNum(totalIgst)}</div></div>
        </div>
        <hr class="tax-divider" />
        <div class="tax-row">
            <div class="tax-col"><div class="label">Grand Total</div><div class="val">${fmtNum(grandTotal)}</div></div>
            <div class="tax-col"><div class="label">Advanced Paid</div><div class="val">0.00</div></div>
            <div class="tax-col"><div class="label">Balance Due</div><div class="val">${fmtNum(grandTotal)}</div></div>
            <div class="tax-col"><div class="label">Payment Method</div><div class="val">-</div></div>
        </div>
    </div>

    <div class="footer">
        <div>
            <strong>Terms &amp; Conditions</strong>
            <ul>
                <li>Goods once sold will not be taken back or exchanged</li>
                <li>24% interest will be charged, is the payment is made past the delivery date</li>
            </ul>
        </div>
        <div class="sig">No signature required as this is a system generated invoice</div>
    </div>

</div>
</body>
</html>`;
};
