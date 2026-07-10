import XLSX from "xlsx";

export const generateLowStockExcel = ({ orderNumber, customerName, orderDate, lowStockItems }) => {
    const rows = lowStockItems.map(item => ({
        "Order Number":       orderNumber                              || "",
        "Customer":           customerName                            || "",
        "Order Date":         orderDate                               || "",
        "Product Name":       item.productName                        || "",
        "Product Code":       item.productCode                        || "",
        "Category":           item.category                           || "",
        "Brand":              item.brand                              || "",
        "Unit":               item.unit                               || "",
        "Ordered Qty":        Number(item.orderedQty   || 0),
        "Available Qty":      Number(item.availableQty ?? 0),
        "Shortfall":          Number(item.shortfall    || 0),
        "Price (₹)":          Number(item.price        || 0),
        "MRP (₹)":            Number(item.mrp          || 0),
        "GST (%)":            Number(item.gst          || 0),
        "HSN/SAC":            item.hsnSac              || "",
        "Index":              item.index               ?? "",
        "Coating":            item.coating             || "",
        "Tint":               item.tint                || "",
        "SPH":                item.sph                 ?? "",
        "CYL":                item.cyl                 ?? "",
        "AXIS":               item.axis                ?? "",
        "ADD":                item.add                 ?? "",
        "Color":              item.color               || "",
        "Size":               item.size                || "",
        "Shape":              item.shape               || "",
        "Material":           item.material            || "",
        "Dimensions":         item.dimensions          || "",
        "Expiry":             item.expiry              || "",
        "Disposability":      item.disposability       || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, 14),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Low Stock Alert");

    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
};
