import XLSX from "xlsx";

export const generateQCRejectionExcel = ({ purchaseOrderId, purchaseQCId, vendorName, qcDate, failedItems }) => {
    const rows = failedItems.map(item => ({
        "Purchase Order ID":  purchaseOrderId?.toString() || "",
        "QC Record ID":       purchaseQCId?.toString()    || "",
        "Vendor Name":        vendorName                   || "",
        "QC Date":            qcDate ? new Date(qcDate).toLocaleDateString("en-IN") : "",

        "Order Number":       item.orderNumber  || "",
        "Item Name":          item.itemName     || "",
        "Category":           item.category     || "",
        "Unit":               item.unit         || "",
        "Failed Qty":         Number(item.failedQty || item.qty || 0),
        "Failure Reason":     item.failureReason || "",
        "Condition":          item.condition     || "QUALITY_ISSUE",
        "Remarks":            item.remarks       || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, 16),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QC Rejection");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};
