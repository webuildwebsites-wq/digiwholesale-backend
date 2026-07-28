import axios from "axios";
import mongoose from "mongoose";

import VendorOrder from "../../models/VendorOrder.model.js";
import VendorOrderItem from "../../models/VendorOrderItem.model.js";
import Vendor from "../../models/Vendor.model.js";

import { generateVendorOrderInvoiceHTML, generateVendorReturnInvoiceHTML } from "../services/templates/invoiceTemplate.js";
import generatePDF from "../services/pdfService.js";



export const createVendorOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { vendorId, items, notes } = req.body;

    if (!vendorId || !items || items.length === 0) {
      throw new Error("Vendor and items are required");
    }


    const vendor = await Vendor.findOne({ _id: vendorId, tenantId: req.user.tenantId }).session(session);
    if (!vendor) {
      throw new Error("Vendor not found");
    }


    let subTotal = 0;
    let gstTotal = 0;

    const orderRes = await VendorOrder.create(
      [
        {
          vendorId,
          name: vendor.name,
          mobile: vendor.mobile,
          email: vendor.email,
          subTotal: 0,
          gstTotal: 0,
          grandTotal: 0,
          notes: notes || "",
          tenantId: req.user.tenantId,
        },
      ],
      { session }
    );


    const order = orderRes[0];

    const orderItems = [];

    for (const item of items) {
      const itemTotal = item.quantity * item.price;
      const gstAmount = (itemTotal * item.gstPercent) / 100;

      subTotal += itemTotal;
      gstTotal += gstAmount;

      orderItems.push({
        vendorOrderId: order._id,
        productCode: item.productCode,
        productName: item.productName,
        category: item.category,
        quantity: item.quantity,
        price: item.price,
        expectedDate: new Date(item.expectedDate),
        subTotal: itemTotal,
        gstPercent: item.gstPercent,
        gstAmount,
        total: itemTotal + gstAmount,
      });
    }

    await VendorOrderItem.insertMany(orderItems, { session });

    order.subTotal = subTotal;
    order.gstTotal = gstTotal;
    order.grandTotal = subTotal + gstTotal;

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();


    const invoiceData = {
      invoiceNo: order._id,
      orderDate: order.createdAt,
      receivedDate: new Date(),
      vendorName: vendor.name,
      vendorAddress: vendor.address || "",
      vendorPhone: vendor.mobile,
      vendorEmail: vendor.email,
      vendorGstin: vendor.gstNumber || "",

      companyName: "DigiOptics",
      companyAddress: "Delhi",
      companyPhone: "9876543210",
      companyEmail: "test@test.com",
      companyGstin: "GST9876543210",

      items: orderItems.map((item) => ({
        productCode: item.productCode,
        category: item.category,
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        gst: item.gstPercent,
        total: item.total,
      })),

      subTotal,
      gstTotal,
      total: order.grandTotal,
      logoUrl: "",
    };

    const html = generateVendorOrderInvoiceHTML(invoiceData);
    let pdfBuffer = await generatePDF(html);
    pdfBuffer = Buffer.from(pdfBuffer);



    const fileName = `vendor-order/${order.orderNumber}-${Date.now()}.pdf`;
    const pdfUrl = await uploadToGCSPDF(pdfBuffer, fileName);

    await VendorOrder.updateOne(
      { _id: order._id, tenantId: req.user.tenantId },
      {
        invoiceUrl: pdfUrl,
        invoiceGeneratedAt: new Date(),
      }
    );

      await sendVendorOrderInvoiceEmail(
        vendor.email,       
        vendor.name,
        pdfBuffer,           
        order.orderNumber,
        store.emailApi,
        store.storeName
      );

    return res.status(201).json({
      success: true,
      order,
      items: orderItems,
      invoiceUrl: pdfUrl,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Vendor Order Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

async function sendVendorOrderInvoiceEmail(recipientEmail, vendorName, pdfBuffer, invoiceNumber, apiUrl, storeName) {
  try {
    if (!recipientEmail) throw new Error("Recipient email is required");
    if (!pdfBuffer) throw new Error("PDF buffer is required");


    const subject = `New Purchase Order #${invoiceNumber} from ${storeName}`;

    const bodyHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 28px 32px;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">${storeName}</h1>
          <p style="margin: 4px 0 0; color: #fed7aa; font-size: 13px;">Purchase Order</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="margin: 0 0 8px; font-size: 15px; color: #111827;">Dear <strong>${vendorName}</strong>,</p>
          <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; line-height: 1.6;">
            We are pleased to inform you that <strong>${storeName}</strong> has raised a new purchase order.
            Please find the order details below and the complete order attached to this email.
          </p>

          <!-- Order Info Box -->
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 0.5px;">Order Details</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Order Number</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">#${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Order Date</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Vendor Name</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">${vendorName}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Store</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">${storeName}</td>
              </tr>
            </table>
          </div>

          <!-- Action notice -->
          <div style="background: #fff7ed; border-left: 3px solid #f97316; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 13px; color: #9a3412; line-height: 1.6;">
              📦 <strong>Action Required:</strong> Please review the attached purchase order and confirm
              availability and expected delivery date at your earliest convenience.
            </p>
          </div>

          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
            If you have any questions about this order, please don't hesitate to contact us.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #f97316;">${storeName}</p>
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">
            This is an automated email. Please do not reply directly to this message.
          </p>
        </div>

      </div>
    `;

    const payload = {
      to: recipientEmail,
      subject: subject,
      body: bodyHTML,
      bodyText: `Dear ${vendorName}, Please find your invoice attached.`,
      attachment: pdfBuffer.toString("base64"),
      filename: `order-invoice-${invoiceNumber}.pdf`,
      mimeType: "application/pdf",
    };

    const response = await axios.post(apiUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("Invoice email sent:", response.data);
    return response.data;

  } catch (error) {
    console.error("Error sending invoice email:", error.message);
    throw error;
  }
}

export const suggestionVendorOrder = async (req, res) => {
  try {

    const q = (req.query.q || "").trim();

    if (!q || q.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Query must be at least 3 characters.",
      });
    }

    const vendororder = await VendorOrder.find({
      tenantId: req.user.tenantId,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
      ],
    })
      .select("name mobile email")
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      data: vendororder,
    });

  } catch (err) {

    console.error("searchVedors error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });

  }
};

export const updateVendorOrderStatus = async (req, res) => {
  try {
    const { _id } = req.params;
    const { status } = req.body;

    const allowedStatus = ["PENDING", "CANCELLED", "RETURN", "RECEIVED", "COMPLETED"];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await VendorOrder.findOneAndUpdate(
      { _id, tenantId: req.user.tenantId },
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Vendor order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getVendorOrderById = async (req, res) => {
  try {
    const { _id } = req.params;

    const order = await VendorOrder.findOne({ _id, tenantId: req.user.tenantId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const items = await VendorOrderItem.find({
      vendorOrderId: order._id,
    });

    res.status(200).json({
      success: true,
      order,
      items,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getVendorOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;  
    const limit = parseInt(req.query.limit) || 20;  
    const skip = (page - 1) * limit;

    const filter = {
      tenantId: req.user.tenantId,
    };

    const orders = await VendorOrder.find(filter)
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit);

    const totalOrders = await VendorOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      page,
      limit,
      total: totalOrders,
      count: orders.length,
      hasMore: skip + orders.length < totalOrders,
      orders,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const deleteVendorOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { _id } = req.params;

    const order = await VendorOrder.findOne({ _id, tenantId: req.user.tenantId }).session(session);

    if (!order) {
      throw new Error("Vendor order not found");
    }

    if (["RECEIVED", "COMPLETED"].includes(order.status)) {
      throw new Error("Received or Completed orders cannot be deleted");
    }


    await VendorOrderItem.deleteMany(
      {
        vendorOrderId: order._id,
      },
      { session }
    );


    await order.deleteOne({ session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Vendor order deleted successfully",
    });

  } catch (error) {

    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  } finally {
    session.endSession();
  }
};


export const updateVendorOrderIssues = async (req, res) => {
  try {
    const { _id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items data is required",
      });
    }


    const order = await VendorOrder.findOne({ _id, tenantId: req.user.tenantId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Vendor order not found",
      });
    }

    if (order.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Order is already completed",
      });
    }

    if (order.status !== "RECEIVED") {
      return res.status(400).json({
        success: false,
        message: "Order must be RECEIVED to update product issues",
      });
    }


    const vendor = await Vendor.findById(order.vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const itemIds = items.map((item) => item.itemId);

    const orderItems = await VendorOrderItem.find({
      _id: { $in: itemIds },
      vendorOrderId: order._id,
    });

    const orderItemMap = new Map();

    orderItems.forEach((item) => {
      orderItemMap.set(item._id.toString(), item);
    });

    const bulkOps = [];

    let hasIssues = false;

    let returnSubTotal = 0;
    let returnGstTotal = 0;

    const returnItems = [];

    for (const item of items) {

      const orderItem = orderItemMap.get(item.itemId?.toString());

      if (!orderItem) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const damageQty = Number(item.damageQty || 0);
      const missingQty = Number(item.missingQty || 0);

      const totalReturnQty = damageQty + missingQty;

      if (damageQty < 0 || missingQty < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid damage or missing quantity",
        });
      }

      if (totalReturnQty > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Damage + missing exceeds quantity for ${orderItem.productName}`,
        });
      }

      if (totalReturnQty > 0) {

        hasIssues = true;

        const returnAmount = totalReturnQty * orderItem.price;

        const gstAmount =
          (returnAmount * orderItem.gstPercent) / 100;

        returnSubTotal += returnAmount;
        returnGstTotal += gstAmount;

        returnItems.push({
          productCode: orderItem.productCode,
          category: orderItem.category,
          name: orderItem.productName,
          quantity: totalReturnQty,
          price: orderItem.price,
          gst: orderItem.gstPercent,
          total: returnAmount + gstAmount,
          damageQty,
          missingQty,
          remark: item.remark || "",
        });
      }

      bulkOps.push({
        updateOne: {
          filter: {
            _id: orderItem._id,
          },
          update: {
            $set: {
              damageQty,
              missingQty,
              remark: item.remark || "",
            },
          },
        },
      });
    }

    if (bulkOps.length > 0) {
      await VendorOrderItem.bulkWrite(bulkOps);
    }

    if (!hasIssues) {
      return res.status(200).json({
        success: true,
        message: "No issues found to generate return invoice",
      });
    }

    const invoiceData = {
      invoiceNo: order.orderNumber,
      orderDate: order.createdAt,
      receivedDate: new Date(),

      vendorName: vendor.name,
      vendorAddress: vendor.address || "",
      vendorPhone: vendor.mobile,
      vendorEmail: vendor.email,
      vendorGstin: vendor.gstNumber || "",

      companyName: "DigiOptics",
      companyAddress: "Delhi",
      companyPhone: "987654322",
      companyEmail: "test@test1.com",
      companyGstin: "GST9876543212",

      items: returnItems,

      subTotal: returnSubTotal,
      gstTotal: returnGstTotal,
      total: returnSubTotal + returnGstTotal,

      logoUrl: "",
    };

    const html = generateVendorReturnInvoiceHTML(invoiceData);

    let pdfBuffer = await generatePDF(html);

    pdfBuffer = Buffer.from(pdfBuffer);

    const pdfUrl = "";


    order.returnInvoiceUrl = pdfUrl;
    order.status = "RETURN";

    await order.save();


      await sendVendorOrderReturnInvoiceEmail(
        vendor.email,
        vendor.name,
        pdfBuffer,
        order.orderNumber,
        "store@test.com",
        "DigiOptics"
      );

    return res.status(200).json({
      success: true,
      message:
        "Vendor order issues updated & return invoice generated",
      returnInvoiceUrl: pdfUrl,
    });

  } catch (error) {

    console.error("Vendor Order Issue Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



async function sendVendorOrderReturnInvoiceEmail(recipientEmail, vendorName, pdfBuffer, invoiceNumber, apiUrl, storeName) {
  try {
    if (!recipientEmail) throw new Error("Recipient email is required");
    if (!pdfBuffer) throw new Error("PDF buffer is required");


    const subject = `Purchase Return Notice #${invoiceNumber} from ${storeName}`;

    const bodyHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ef4444, #f97316); padding: 28px 32px;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">${storeName}</h1>
          <p style="margin: 4px 0 0; color: #fecaca; font-size: 13px;">Purchase Return Notice</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <p style="margin: 0 0 8px; font-size: 15px; color: #111827;">Dear <strong>${vendorName}</strong>,</p>
          <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; line-height: 1.6;">
            We are writing to inform you that <strong>${storeName}</strong> has raised a purchase return
            against order <strong>#${invoiceNumber}</strong> due to damaged or missing items received.
            Please find the return invoice attached for your reference.
          </p>

          <!-- Return Info Box -->
          <div style="background: #fff1f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Return Details</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Order Number</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">#${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Return Date</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Vendor Name</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">${vendorName}</td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #6b7280; padding: 4px 0;">Store</td>
                <td style="font-size: 13px; font-weight: 700; color: #111827; text-align: right;">${storeName}</td>
              </tr>
            </table>
          </div>

          <!-- Warning notice -->
          <div style="background: #fff1f2; border-left: 3px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.6;">
              ⚠️ <strong>Action Required:</strong> Please review the attached return invoice and arrange
              for a replacement at your earliest convenience.
            </p>
          </div>

          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
            If you have any questions regarding this return, please don't hesitate to contact us.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #ef4444;">${storeName}</p>
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">
            This is an automated email. Please do not reply directly to this message.
          </p>
        </div>

      </div>
    `;

    const payload = {
      to: recipientEmail,
      subject: subject,
      body: bodyHTML,
      bodyText: `Dear ${vendorName}, Please find your invoice attached.`,
      attachment: pdfBuffer.toString("base64"),
      filename: `return-invoice-${invoiceNumber}.pdf`,
      mimeType: "application/pdf",
    };

    const response = await axios.post(apiUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("Invoice email sent:", response.data);
    return response.data;

  } catch (error) {
    console.error("Error sending invoice email:", error.message);
    throw error;
  }
}


export const filterVendorsOrders = async (req, res) => {
  try {
    const { startDate, endDate, keyword } = req.body;

    if (!startDate && !keyword) {
      return res.status(400).json({
        success: false,
        message: "Date range or keyword is required",
      });
    }

    let query = {
      tenantId: req.user.tenantId,
    };


    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: start,
        $lte: end,
      };
    }
    if (keyword) {
      const regex = new RegExp(keyword, "i");

      query.$or = [
        { name: regex },
        { mobile: regex },
        { email: regex },
        { orderNumber: regex },
      ];
    }

    const ordersData = await VendorOrder.find(query).sort({ createdAt: -1 });

    if (!ordersData.length) {
      return res.status(200).json({
        success: false,
        message: "No data exist with this date/keyword filter",
      });
    }

    return res.status(200).json({
      success: true,
      total: ordersData.length,
      orders: ordersData,
    });

  } catch (error) {
    console.error("Filter Vendors Order Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};