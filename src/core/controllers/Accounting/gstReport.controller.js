import mongoose from "mongoose";
import * as XLSX from "xlsx";
import BulkOrder from "../../../models/order/BulkOrder.js";
import VendorPurchase from "../../../models/Purchase/VendorPurchase.model.js";
import Customer from "../../../models/Auth/Customer.js";
import Vendor from "../../../models/Vendor.model.js";
import Tenant from "../../../models/Tenant/Tenant.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../../Utils/response/responseHandler.js";

const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

export const getGstReportData = async (req) => {
  const {
    startDate,
    endDate,
    branch,
    gstRate,
    productType,
    taxType,
    search,
  } = req.query;

  const tenantId = req.user?.tenantId || null;
  const tenantFilter = tenantId ? { tenantId } : {};

  // Find tenant / wholesaler settings
  let wholesalerName = "Sid Optics";
  let wholesalerGSTIN = "GST9876543210";
  let wholesalerState = "DELHI";

  try {
    const tenantDoc = tenantId
      ? await Tenant.findOne({ $or: [{ _id: mongoose.isValidObjectId(tenantId) ? tenantId : null }, { tenantId }] }).lean()
      : await Tenant.findOne().lean();

    if (tenantDoc) {
      wholesalerName = tenantDoc.storeInformation?.storeName || wholesalerName;
      wholesalerGSTIN =
        tenantDoc.invoiceDetails?.clientGSTIN ||
        tenantDoc.gstNumber ||
        tenantDoc.storeInformation?.gstin ||
        wholesalerGSTIN;
      wholesalerState =
        tenantDoc.invoiceDetails?.clientStateName ||
        tenantDoc.state ||
        wholesalerState;
    }
  } catch (err) {
    console.error("Error fetching tenant info for GST report:", err.message);
  }

  // Pre-load customers and vendors for fast lookup
  const [customers, vendors] = await Promise.all([
    Customer.find(tenantFilter).lean(),
    Vendor.find(tenantFilter).lean(),
  ]);

  const customerMap = {};
  customers.forEach((c) => {
    customerMap[String(c._id)] = c;
  });

  const vendorMap = {};
  vendors.forEach((v) => {
    vendorMap[String(v._id)] = v;
  });

  // Date filters
  const dateQuery = {};
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    dateQuery.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateQuery.$lte = end;
  }

  const salesOrderQuery = { ...tenantFilter };
  if (Object.keys(dateQuery).length > 0) {
    salesOrderQuery.createdAt = dateQuery;
  }

  const purchaseOrderQuery = { ...tenantFilter };
  if (Object.keys(dateQuery).length > 0) {
    purchaseOrderQuery.createdAt = dateQuery;
  }

  // Fetch sales & purchases in parallel
  const [bulkOrders, vendorPurchases] = await Promise.all([
    BulkOrder.find(salesOrderQuery).sort({ createdAt: -1 }).lean(),
    VendorPurchase.find(purchaseOrderQuery).sort({ createdAt: -1 }).lean(),
  ]);

  // Normalize state comparison
  const isSameState = (partyState, homeState) => {
    if (!partyState || !homeState) return true;
    const cleanParty = String(partyState).trim().toLowerCase();
    const cleanHome = String(homeState).trim().toLowerCase();
    return cleanParty.includes(cleanHome) || cleanHome.includes(cleanParty);
  };

  /* ──────────────────────────────────────────────────────────────────────────
     1. GST OUTPUT REPORT (Sales)
  ────────────────────────────────────────────────────────────────────────── */
  const outputRows = [];
  let outputSNo = 1;

  bulkOrders.forEach((bo) => {
    const custId = bo.customer?.customerId ? String(bo.customer.customerId) : null;
    const cust = (custId && customerMap[custId]) || {};

    const partyName = cust.shopName || cust.ownerName || bo.customer?.customerName || "Customer";
    const companyName = cust.shopName || bo.customer?.customerShipToBranchName || wholesalerName;
    const partyGstin = cust.gstin || cust.gstNumber || cust.GSTNo || "Unregistered";
    const partyState = cust.state || cust.billToAddress?.state || "DELHI";
    const isLocalState = isSameState(partyState, wholesalerState);

    const orderDateStr = formatDate(bo.createdAt);
    const invoiceDateStr = formatDate(bo.invoiceGenAt || bo.createdAt);
    const createdDateStr = formatDate(bo.createdAt);

    if (Array.isArray(bo.orders)) {
      bo.orders.forEach((subOrd) => {
        const billNo = subOrd.orderNumber || `BO-${String(bo._id).slice(-6).toUpperCase()}`;

        if (Array.isArray(subOrd.items)) {
          subOrd.items.forEach((item) => {
            const rawGst = Number(item.gst != null ? item.gst : (Number(subOrd.cgst || 0) + Number(subOrd.sgst || 0)) || 5);
            const rate = isNaN(rawGst) ? 5 : rawGst;

            const pType = (item.category || "FRAME").toUpperCase();
            const hsn = item.hsnSac || (pType.includes("LENS") ? "9001" : "9003");
            const qty = Number(item.qty || 1);
            const totalPieces = qty;

            const unitPrice = Number(item.price || item.sellingPrice || 0);
            const mrp = Number(item.mrp || unitPrice || 0);
            const totalRetailPrice = round2(mrp * totalPieces);

            const itemDiscount = round2(Number(item.discountAmount || 0));

            // Tax Type (EXCLUDED vs INCLUDED)
            const itemTaxType = item.gstType ? String(item.gstType).toUpperCase() : (item.priceIsGstIncluded ? "INCLUDED" : "EXCLUDED");

            let totalBasePrice = 0;
            if (itemTaxType === "INCLUDED" && rate > 0) {
              totalBasePrice = round2(totalRetailPrice / (1 + rate / 100));
            } else {
              totalBasePrice = totalRetailPrice;
            }

            // Tax Calculation
            const taxableNet = Math.max(0, totalBasePrice - itemDiscount);
            let sgst = 0;
            let cgst = 0;
            let igst = 0;

            if (rate > 0) {
              if (isLocalState) {
                const halfRate = rate / 2;
                sgst = round2((taxableNet * halfRate) / 100);
                cgst = round2((taxableNet * halfRate) / 100);
                igst = 0;
              } else {
                sgst = 0;
                cgst = 0;
                igst = round2((taxableNet * rate) / 100);
              }
            }

            const totalGst = round2(sgst + cgst + igst);
            const totalGross = round2(totalBasePrice + totalGst);
            const totalNet = round2(totalGross - itemDiscount);

            outputRows.push({
              sNo: outputSNo++,
              branchName: wholesalerName,
              branchGstNumber: wholesalerGSTIN,
              billNo,
              orderDate: orderDateStr,
              invoiceDate: invoiceDateStr,
              createdDate: createdDateStr,
              partyName,
              companyName,
              gstNumber: partyGstin,
              state: partyState.toUpperCase(),
              taxType: itemTaxType,
              productType: pType,
              hsnSac: hsn,
              qty,
              totalPieces,
              totalRetailPrice,
              totalBasePrice,
              gstPercent: rate,
              sgst,
              cgst,
              igst,
              totalGst,
              totalGross,
              totalDiscount: itemDiscount,
              totalNetAmount: totalNet,
            });
          });
        }
      });
    }
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. GST INPUT REPORT (Purchases)
  ────────────────────────────────────────────────────────────────────────── */
  const inputRows = [];
  let inputSNo = 1;

  vendorPurchases.forEach((vp) => {
    const vId = vp.vendor?.vendorId ? String(vp.vendor.vendorId) : null;
    const vend = (vId && vendorMap[vId]) || {};

    const partyName = vend.vendorName || vp.vendor?.vendorName || "Vendor";
    const partyGstin = vend.gstNumber || vp.vendor?.gstNumber || "Unregistered";
    const partyState = vend.state || vend.address?.state || "DELHI";
    const isLocalState = isSameState(partyState, wholesalerState);

    const createdDateStr = formatDate(vp.createdAt);
    const purchaseDateStr = formatDate(vp.createdAt);
    const paymentType = vp.paymentType || vp.type || "CASH";

    if (Array.isArray(vp.orders)) {
      vp.orders.forEach((pOrd) => {
        const billNo = pOrd.orderNumber || `PO-${String(vp._id).slice(-6).toUpperCase()}`;

        if (Array.isArray(pOrd.items)) {
          pOrd.items.forEach((item) => {
            const rawGst = Number(item.gst != null ? item.gst : (Number(pOrd.cgst || 0) + Number(pOrd.sgst || 0)) || 5);
            const rate = isNaN(rawGst) ? 5 : rawGst;

            const pType = (item.category || "FRAME").toUpperCase();
            const hsn = item.hsnSac || (pType.includes("LENS") ? "9001" : "9003");
            const qty = Number(item.qty || 1);
            const piecesPerBox = Number(item.piecesPerBox || 1);
            const totalPieces = qty * piecesPerBox;

            const unitCost = Number(item.buyingPrice || item.price || 0);
            const unitRetail = Number(item.mrp || unitCost || 0);
            const totalRetailPrice = round2(unitRetail * totalPieces);
            const totalBasePrice = round2(unitCost * totalPieces);

            const itemDiscount = round2(Number(item.discountAmount || 0));
            const taxableNet = Math.max(0, totalBasePrice - itemDiscount);

            let sgst = 0;
            let cgst = 0;
            let igst = 0;

            if (rate > 0) {
              if (isLocalState) {
                const halfRate = rate / 2;
                sgst = round2((taxableNet * halfRate) / 100);
                cgst = round2((taxableNet * halfRate) / 100);
                igst = 0;
              } else {
                sgst = 0;
                cgst = 0;
                igst = round2((taxableNet * rate) / 100);
              }
            }

            const totalGst = round2(sgst + cgst + igst);
            const totalGross = round2(totalBasePrice + totalGst);
            const totalNet = round2(totalGross - itemDiscount);

            inputRows.push({
              sNo: inputSNo++,
              branchName: wholesalerName,
              branchGstNumber: wholesalerGSTIN,
              billNo,
              type: paymentType,
              createdDate: createdDateStr,
              purchaseDate: purchaseDateStr,
              partyName,
              gstNumber: partyGstin,
              state: partyState.toUpperCase(),
              quantity: qty,
              piecesPerBox,
              totalPieces,
              totalRetailPrice,
              hsnSac: hsn,
              totalBasePrice,
              gstPercent: rate,
              sgst,
              cgst,
              igst,
              totalGst,
              totalGross,
              totalDiscount: itemDiscount,
              totalNetAmount: totalNet,
            });
          });
        }
      });
    }
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. GST CONSOLIDATED REPORT (HSN & Rate-wise Summary)
  ────────────────────────────────────────────────────────────────────────── */
  const consolidatedMap = new Map();

  // Aggregate Output rows into Consolidated Report
  outputRows.forEach((row) => {
    const key = `${row.hsnSac || "-"}_${row.gstPercent || 0}`;
    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        hsnSac: row.hsnSac || "-",
        quantity: 0,
        totalRetailPrice: 0,
        totalBasePrice: 0,
        gstPercent: row.gstPercent || 0,
        sgst: 0,
        cgst: 0,
        igst: 0,
        totalGst: 0,
        totalGross: 0,
        totalDiscount: 0,
        totalNetAmount: 0,
      });
    }

    const agg = consolidatedMap.get(key);
    agg.quantity += row.qty || 0;
    agg.totalRetailPrice = round2(agg.totalRetailPrice + (row.totalRetailPrice || 0));
    agg.totalBasePrice = round2(agg.totalBasePrice + (row.totalBasePrice || 0));
    agg.sgst = round2(agg.sgst + (row.sgst || 0));
    agg.cgst = round2(agg.cgst + (row.cgst || 0));
    agg.igst = round2(agg.igst + (row.igst || 0));
    agg.totalGst = round2(agg.totalGst + (row.totalGst || 0));
    agg.totalGross = round2(agg.totalGross + (row.totalGross || 0));
    agg.totalDiscount = round2(agg.totalDiscount + (row.totalDiscount || 0));
    agg.totalNetAmount = round2(agg.totalNetAmount + (row.totalNetAmount || 0));
  });

  let consolidatedSNo = 1;
  const consolidatedRows = Array.from(consolidatedMap.values())
    .sort((a, b) => (a.gstPercent - b.gstPercent) || String(a.hsnSac).localeCompare(String(b.hsnSac)))
    .map((item) => ({
      sNo: consolidatedSNo++,
      ...item,
    }));

  /* ──────────────────────────────────────────────────────────────────────────
     Apply Optional Filtering (Branch, GST Rate, Product Type, Tax Type, Search)
  ────────────────────────────────────────────────────────────────────────── */
  let filteredOutput = outputRows;
  let filteredInput = inputRows;
  let filteredConsolidated = consolidatedRows;

  if (branch && branch !== "ALL") {
    filteredOutput = filteredOutput.filter((r) => r.branchName.toLowerCase().includes(branch.toLowerCase()));
    filteredInput = filteredInput.filter((r) => r.branchName.toLowerCase().includes(branch.toLowerCase()));
  }

  if (gstRate && gstRate !== "ALL") {
    const targetRate = Number(gstRate);
    filteredOutput = filteredOutput.filter((r) => r.gstPercent === targetRate);
    filteredInput = filteredInput.filter((r) => r.gstPercent === targetRate);
    filteredConsolidated = filteredConsolidated.filter((r) => r.gstPercent === targetRate);
  }

  if (productType && productType !== "ALL") {
    filteredOutput = filteredOutput.filter((r) => r.productType.toUpperCase() === productType.toUpperCase());
  }

  if (taxType && taxType !== "ALL") {
    filteredOutput = filteredOutput.filter((r) => r.taxType.toUpperCase() === taxType.toUpperCase());
  }

  if (search) {
    const q = search.trim().toLowerCase();
    filteredOutput = filteredOutput.filter((r) =>
      r.partyName.toLowerCase().includes(q) ||
      r.billNo.toLowerCase().includes(q) ||
      r.gstNumber.toLowerCase().includes(q) ||
      r.hsnSac.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q)
    );
    filteredInput = filteredInput.filter((r) =>
      r.partyName.toLowerCase().includes(q) ||
      r.billNo.toLowerCase().includes(q) ||
      r.gstNumber.toLowerCase().includes(q) ||
      r.hsnSac.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q)
    );
    filteredConsolidated = filteredConsolidated.filter((r) =>
      r.hsnSac.toLowerCase().includes(q) ||
      String(r.gstPercent).includes(q)
    );
  }

  // Summary KPIs
  const totalOutputTaxable = round2(filteredOutput.reduce((acc, r) => acc + r.totalBasePrice, 0));
  const totalOutputGst = round2(filteredOutput.reduce((acc, r) => acc + r.totalGst, 0));
  const totalOutputNet = round2(filteredOutput.reduce((acc, r) => acc + r.totalNetAmount, 0));

  const totalInputTaxable = round2(filteredInput.reduce((acc, r) => acc + r.totalBasePrice, 0));
  const totalInputGst = round2(filteredInput.reduce((acc, r) => acc + r.totalGst, 0));
  const totalInputNet = round2(filteredInput.reduce((acc, r) => acc + r.totalNetAmount, 0));

  const netGstPayable = round2(totalOutputGst - totalInputGst);

  return {
    meta: {
      wholesalerName,
      wholesalerGSTIN,
      wholesalerState,
      totalOutputCount: filteredOutput.length,
      totalInputCount: filteredInput.length,
      totalConsolidatedCount: filteredConsolidated.length,
      generatedAt: new Date().toISOString(),
    },
    summary: {
      totalOutputTaxable,
      totalOutputGst,
      totalOutputNet,
      totalInputTaxable,
      totalInputGst,
      totalInputNet,
      netGstPayable,
      netGstStatus: netGstPayable >= 0 ? "PAYABLE" : "CREDIT_CARRY_FORWARD",
    },
    outputReport: filteredOutput,
    inputReport: filteredInput,
    consolidatedReport: filteredConsolidated,
  };
};

export const getGstReport = async (req, res) => {
  try {
    const data = await getGstReportData(req);
    return sendSuccessResponse(res, 200, data, "GST Report fetched successfully");
  } catch (error) {
    console.error("Error in getGstReport:", error);
    return sendErrorResponse(res, 500, "GST_REPORT_ERROR", error.message || "Failed to fetch GST report");
  }
};

export const exportGstWorkbook = async (req, res) => {
  try {
    const data = await getGstReportData(req);
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Digi-Optics ERP';
    workbook.created = new Date();

    const styleSheet = (ws, columns, rows) => {
      ws.columns = columns;

      // Header styling
      const headerRow = ws.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEA580C' }, // Vibrant Orange
        };
        cell.font = {
          name: 'Arial',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' }, // Bold White
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: false,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFC2410C' } },
          bottom: { style: 'medium', color: { argb: 'FF9A3412' } },
          left: { style: 'thin', color: { argb: 'FFF97316' } },
          right: { style: 'thin', color: { argb: 'FFF97316' } },
        };
      });

      // Data rows
      rows.forEach((r, rIdx) => {
        const row = ws.addRow(r);
        row.height = 20;
        const isEven = rIdx % 2 === 1;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 9.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (isEven) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        });
      });

      // Auto width
      ws.columns.forEach((col) => {
        let maxLen = col.header ? String(col.header).length : 10;
        col.eachCell({ includeEmpty: false }, (cell) => {
          const l = cell.value != null ? String(cell.value).length : 0;
          if (l > maxLen) maxLen = l;
        });
        col.width = Math.min(Math.max(maxLen + 3, 10), 32);
      });
    };

    // 1. Output Sheet
    const wsOutput = workbook.addWorksheet('GST Output Report');
    const outColumns = [
      { header: 'S.no.', key: 'sNo' },
      { header: 'Branch Name', key: 'branchName' },
      { header: 'Branch GST Number', key: 'branchGstNumber' },
      { header: 'Bill No', key: 'billNo' },
      { header: 'Order Date', key: 'orderDate' },
      { header: 'Invoice Date', key: 'invoiceDate' },
      { header: 'Created Date', key: 'createdDate' },
      { header: 'Name of the Party', key: 'partyName' },
      { header: 'Company Name', key: 'companyName' },
      { header: 'GST Number', key: 'gstNumber' },
      { header: 'State', key: 'state' },
      { header: 'Tax Type', key: 'taxType' },
      { header: 'Product Type', key: 'productType' },
      { header: 'HSN/SAC', key: 'hsnSac' },
      { header: 'Qty', key: 'qty' },
      { header: 'Total Number of Pieces', key: 'totalPieces' },
      { header: 'Total Retail Price', key: 'totalRetailPrice' },
      { header: 'Total Base Price', key: 'totalBasePrice' },
      { header: 'GST%', key: 'gstPercent' },
      { header: 'Total SGST (Rs.)', key: 'sgst' },
      { header: 'Total CGST (Rs.)', key: 'cgst' },
      { header: 'Total IGST (Rs.)', key: 'igst' },
      { header: 'Total GST (Rs.)', key: 'totalGst' },
      { header: 'Total Gross Amount (Rs.)', key: 'totalGross' },
      { header: 'Total Discount (Rs.)', key: 'totalDiscount' },
      { header: 'Total Net Amount (Rs.)', key: 'totalNetAmount' },
    ];
    styleSheet(wsOutput, outColumns, data.outputReport);

    // 2. Input Sheet
    const wsInput = workbook.addWorksheet('GST Input Report');
    const inColumns = [
      { header: 'S.no.', key: 'sNo' },
      { header: 'Branch Name', key: 'branchName' },
      { header: 'Branch GST Number', key: 'branchGstNumber' },
      { header: 'Bill No', key: 'billNo' },
      { header: 'Type', key: 'type' },
      { header: 'Created Date', key: 'createdDate' },
      { header: 'Purchase Date', key: 'purchaseDate' },
      { header: 'Name of the Party', key: 'partyName' },
      { header: 'GST Number', key: 'gstNumber' },
      { header: 'State', key: 'state' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Pieces Per Box', key: 'piecesPerBox' },
      { header: 'Total Number of Pieces', key: 'totalPieces' },
      { header: 'Total Retail Price', key: 'totalRetailPrice' },
      { header: 'HSN/SAC', key: 'hsnSac' },
      { header: 'Total Base Price', key: 'totalBasePrice' },
      { header: 'GST%', key: 'gstPercent' },
      { header: 'Total SGST (Rs.)', key: 'sgst' },
      { header: 'Total CGST (Rs.)', key: 'cgst' },
      { header: 'Total IGST (Rs.)', key: 'igst' },
      { header: 'Total GST (Rs.)', key: 'totalGst' },
      { header: 'Total Gross Amount (Rs.)', key: 'totalGross' },
      { header: 'Total Discount (Rs.)', key: 'totalDiscount' },
      { header: 'Total Net Amount (Rs.)', key: 'totalNetAmount' },
    ];
    styleSheet(wsInput, inColumns, data.inputReport);

    // 3. Consolidated Sheet
    const wsConsolidated = workbook.addWorksheet('GST Consolidated Report');
    const consColumns = [
      { header: 'S.no.', key: 'sNo' },
      { header: 'HSN/SAC', key: 'hsnSac' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Total Retail Price', key: 'totalRetailPrice' },
      { header: 'Total Base Price', key: 'totalBasePrice' },
      { header: 'GST%', key: 'gstPercent' },
      { header: 'Total SGST (Rs.)', key: 'sgst' },
      { header: 'Total CGST (Rs.)', key: 'cgst' },
      { header: 'Total IGST (Rs.)', key: 'igst' },
      { header: 'Total GST (Rs.)', key: 'totalGst' },
      { header: 'Total Gross Amount (Rs.)', key: 'totalGross' },
      { header: 'Total Item Discount (Rs.)', key: 'totalDiscount' },
      { header: 'Total Net Amount (Rs.)', key: 'totalNetAmount' },
    ];
    styleSheet(wsConsolidated, consColumns, data.consolidatedReport);

    const excelBuffer = await workbook.xlsx.writeBuffer();

    const filename = `GST_Report_${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting GST workbook:', error);
    return sendErrorResponse(res, 500, 'GST_EXPORT_ERROR', error.message || 'Failed to export GST workbook');
  }
};
