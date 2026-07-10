import XLSX from "xlsx";

export const generatePurchaseOrderExcel = (vendorPurchase) => {
    const { vendor, orders, _id, createdAt } = vendorPurchase;

    const rows = [];

    for (const order of orders) {
        for (const item of order.items) {
            const isRx      = item.orderType === "RX";
            const rx        = item.rx || {};
            const powers    = rx.powers || [];
            const rPower    = powers.find(p => p.side === "R") || {};
            const lPower    = powers.find(p => p.side === "L") || {};
            const prisms    = rx.prisms    || [];
            const centration= rx.centration|| [];

            const gross    = Number(item.price || 0) * Number(item.qty || 0);
            const netValue = gross - Number(item.discountAmount || 0);
            const cgstAmt  = (netValue * Number(order.cgst || 0)) / 100;
            const sgstAmt  = (netValue * Number(order.sgst || 0)) / 100;

            rows.push({
                "PO ID":              _id?.toString() || "",
                "PO Date":            createdAt ? new Date(createdAt).toLocaleDateString("en-IN") : "",
                "Vendor Name":        vendor?.vendorName || "",
                "Vendor Email":       vendor?.email      || "",
                "Vendor Mobile":      vendor?.mobile     || "",
                "Vendor GST":         vendor?.gstNumber  || "",
                "Vendor Address":     vendor?.address    || "",

                "Order Number":       order.orderNumber  || "",
                "Order Status":       order.status       || "",
                "Order Remarks":      order.remarks      || "",

                "Item Name":          item.itemName      || "",
                "Is New Product":     item.isNewProduct ? "Yes" : "No",
                "Order Type":         item.orderType     || "",
                "Category":           item.category      || "",
                "Code":               item.code          || "",
                "Brand":              item.brand         || "",
                "Color":              item.color         || "",
                "Size":               item.size          || "",
                "Shape":              item.shape         || "",
                "Material":           item.material      || "",
                "Dimensions":         item.dimensions    || "",
                "Unit":               item.unit          || "",
                "Qty":                Number(item.qty    || 0),
                "Price (₹)":          Number(item.price  || 0),
                "MRP (₹)":            Number(item.mrp    || 0),
                "GST (%)":            Number(item.gst    || 0),
                "HSN/SAC":            item.hsnSac        || "",
                "Discount (%)":       Number(item.discountPercent || 0),
                "Discount Amt (₹)":   Number(item.discountAmount  || 0),
                "Gross Amt (₹)":      Number(gross.toFixed(2)),
                "Net Value (₹)":      Number(netValue.toFixed(2)),
                "CGST (₹)":           Number(cgstAmt.toFixed(2)),
                "SGST (₹)":           Number(sgstAmt.toFixed(2)),
                "Total (₹)":          Number((netValue + cgstAmt + sgstAmt).toFixed(2)),

                "Index":              item.index      ?? "",
                "Coating":            isRx ? (rx.coating?.name   || "") : (item.coating    || ""),
                "Tint":               isRx ? (rx.tint?.name      || "") : (item.tint       || ""),
                "Tint Value":         rx.tintValue   ?? "",
                "Treatment":          rx.treatment?.name || "",
                "Lab":                rx.lab?.name       || "",

                "SPH (R)":            rPower.sph  ?? (item.sph  ?? ""),
                "CYL (R)":            rPower.cyl  ?? (item.cyl  ?? ""),
                "AXIS (R)":           rPower.axis ?? (item.axis ?? ""),
                "ADD (R)":            rPower.add  ?? (item.add  ?? ""),
                "DNP (R)":            rPower.dnp  ?? "",
                "HT (R)":             rPower.ht   ?? "",

                "SPH (L)":            lPower.sph  ?? "",
                "CYL (L)":            lPower.cyl  ?? "",
                "AXIS (L)":           lPower.axis ?? "",
                "ADD (L)":            lPower.add  ?? "",
                "DNP (L)":            lPower.dnp  ?? "",
                "HT (L)":             lPower.ht   ?? "",

                "Prism":              prisms.length     ? prisms.map(p     => `${p.side}: ${p.prism} ${p.base}`).join(" | ")                   : "",
                "Centration":         centration.length ? centration.map(c => `${c.side}: PD ${c.pd} H ${c.fittingHeight}`).join(" | ")        : "",

                "Expiry":             item.expiry       || "",
                "Disposability":      item.disposability|| "",
                "RX Remarks":         rx.remarks        || "",
            });
        }
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, 14),
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Order");

    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    return buf;
};
