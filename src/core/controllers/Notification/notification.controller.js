import mongoose from 'mongoose';
import BulkOrder from '../../../models/order/BulkOrder.js';
import Customer from '../../../models/Auth/Customer.js';
import ReturnRefund from '../../../models/SALES/ReturnRefund.model.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';

/**
 * Get unified system notifications across Orders, Customer Approvals, Returns, and Operations
 */
export const getAllSystemNotifications = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Fetch operational data in parallel
    const [activeOrders, pendingCustomers, pendingReturns] = await Promise.all([
      // A. Active Orders (ReadyToDispatch, Processing, QC, or recent Submitted)
      BulkOrder.find({
        ...tenantFilter,
        'orders.status': { $in: ['ReadyToDispatch', 'QC', 'Processing', 'Submitted'] },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),

      // B. Customer Approvals & Profile Corrections
      Customer.find({
        ...tenantFilter,
        $or: [
          { 'approvalWorkflow.financeApprovalStatus': 'PENDING' },
          { 'approvalWorkflow.salesHeadApprovalStatus': 'PENDING' },
          { 'correctionRequest.status': 'PENDING' },
        ],
      })
        .select('shopName ownerName customerCode approvalWorkflow correctionRequest createdAt mobileNo1')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),

      // C. Pending Returns & Refunds
      ReturnRefund.find({
        ...tenantFilter,
        status: { $in: ['PENDING', 'Pending', 'UNDER_REVIEW', 'Under Review'] },
      })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean()
        .catch(() => []),
    ]);

    const notifications = [];

    // --- 1. Process Order Notifications ---
    let readyToDispatchCount = 0;
    let processingOrdersCount = 0;
    let qcOrdersCount = 0;
    let newOrdersCount = 0;

    activeOrders.forEach((bulkOrder) => {
      const orders = Array.isArray(bulkOrder.orders) ? bulkOrder.orders : [];
      orders.forEach((subOrder) => {
        const st = (subOrder.status || '').toLowerCase();
        const ordNo = subOrder.orderNumber || bulkOrder._id;
        const custName = bulkOrder.customer?.customerName || 'Customer';
        const itemCount = Array.isArray(subOrder.items) ? subOrder.items.length : 1;
        const ordPrice = Number(subOrder.totalOrderPrice || subOrder.grandTotal || 0);
        const ordPriceStr = `₹${ordPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        if (st === 'readytodispatch') {
          readyToDispatchCount++;
          notifications.push({
            id: `order-rtd-${subOrder.orderNumber || subOrder._id}`,
            category: 'ORDERS',
            categoryLabel: 'Order Fulfillment',
            type: 'READY_TO_DISPATCH',
            severity: 'URGENT',
            title: `Order Ready to Dispatch: #${ordNo}`,
            message: `Order #${ordNo} for ${custName} (${itemCount} item${itemCount > 1 ? 's' : ''}, ${ordPriceStr}) has completed QC inspection and is packed ready for shipment.`,
            date: subOrder.updatedAt || bulkOrder.updatedAt || bulkOrder.createdAt,
            formattedDate: new Date(subOrder.updatedAt || bulkOrder.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            entityId: bulkOrder._id,
            entityNumber: ordNo,
            partyName: custName,
            amount: ordPrice,
            amountFormatted: ordPriceStr,
            actionUrl: `/order/view/${bulkOrder._id}`,
            actionLabel: 'Dispatch Order',
            meta: { orderStatus: 'ReadyToDispatch' },
          });
        } else if (st === 'qc') {
          qcOrdersCount++;
          notifications.push({
            id: `order-qc-${subOrder.orderNumber || subOrder._id}`,
            category: 'ORDERS',
            categoryLabel: 'Quality Control',
            type: 'QC_PENDING',
            severity: 'WARNING',
            title: `Quality Check Inspection: #${ordNo}`,
            message: `Order #${ordNo} for ${custName} is currently in Quality Check stage awaiting lens & fitting verification.`,
            date: subOrder.updatedAt || bulkOrder.createdAt,
            formattedDate: new Date(subOrder.updatedAt || bulkOrder.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            entityId: bulkOrder._id,
            entityNumber: ordNo,
            partyName: custName,
            amount: ordPrice,
            amountFormatted: ordPriceStr,
            actionUrl: `/order/view/${bulkOrder._id}`,
            actionLabel: 'Inspect QC',
            meta: { orderStatus: 'QC' },
          });
        } else if (st === 'submitted') {
          newOrdersCount++;
          notifications.push({
            id: `order-sub-${subOrder.orderNumber || subOrder._id}`,
            category: 'ORDERS',
            categoryLabel: 'New Orders',
            type: 'NEW_ORDER',
            severity: 'INFO',
            title: `New Order Placed: #${ordNo}`,
            message: `New bulk order #${ordNo} received from ${custName} (${itemCount} item${itemCount > 1 ? 's' : ''}, ${ordPriceStr}).`,
            date: subOrder.createdAt || bulkOrder.createdAt,
            formattedDate: new Date(subOrder.createdAt || bulkOrder.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            entityId: bulkOrder._id,
            entityNumber: ordNo,
            partyName: custName,
            amount: ordPrice,
            amountFormatted: ordPriceStr,
            actionUrl: `/order/view/${bulkOrder._id}`,
            actionLabel: 'Process Order',
            meta: { orderStatus: 'Submitted' },
          });
        } else if (st === 'processing') {
          processingOrdersCount++;
        }
      });
    });

    // --- 2. Process Customer Registration & Approvals ---
    let pendingApprovalsCount = 0;
    let pendingCorrectionsCount = 0;

    pendingCustomers.forEach((cust) => {
      const isFinancePending = cust.approvalWorkflow?.financeApprovalStatus === 'PENDING';
      const isSalesHeadPending = cust.approvalWorkflow?.salesHeadApprovalStatus === 'PENDING';
      const isCorrection = cust.correctionRequest?.status === 'PENDING';
      const name = cust.shopName || cust.ownerName || 'New Customer';

      if (isFinancePending || isSalesHeadPending) {
        pendingApprovalsCount++;
        const stageLabel = isFinancePending ? 'Finance' : 'Sales Head';
        notifications.push({
          id: `cust-appr-${cust._id}`,
          category: 'CUSTOMER_APPROVAL',
          categoryLabel: 'Customer Approvals',
          type: 'PENDING_APPROVAL',
          severity: 'URGENT',
          title: `KYC Approval Pending: ${name}`,
          message: `${name} (${cust.customerCode || 'KYC'}) has registered and is awaiting ${stageLabel} review and credit terms approval.`,
          date: cust.createdAt,
          formattedDate: new Date(cust.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          entityId: cust._id,
          entityNumber: cust.customerCode || 'REG',
          partyName: name,
          actionUrl: `/customer/approvals`,
          actionLabel: 'Review Approval',
          meta: { stage: isFinancePending ? 'finance' : 'salesHead' },
        });
      } else if (isCorrection) {
        pendingCorrectionsCount++;
        notifications.push({
          id: `cust-corr-${cust._id}`,
          category: 'CUSTOMER_APPROVAL',
          categoryLabel: 'Customer Profile',
          type: 'CORRECTION_REQUEST',
          severity: 'WARNING',
          title: `Profile Correction Request: ${name}`,
          message: `Correction submitted for customer profile: ${name} (${cust.customerCode || 'KYC'}). Please review requested edits.`,
          date: cust.createdAt,
          formattedDate: new Date(cust.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          entityId: cust._id,
          partyName: name,
          actionUrl: `/customer/corrections`,
          actionLabel: 'View Correction',
          meta: { correction: true },
        });
      }
    });

    // --- 3. Process Returns & Refunds ---
    let pendingReturnsCount = 0;
    (pendingReturns || []).forEach((ret) => {
      pendingReturnsCount++;
      const retAmt = Number(ret.refundAmount || ret.totalAmount || 0);
      const retAmtStr = `₹${retAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      notifications.push({
        id: `ret-${ret._id}`,
        category: 'RETURNS',
        categoryLabel: 'Returns & Refunds',
        type: 'RETURN_PENDING',
        severity: 'WARNING',
        title: `Return Request: #${ret.returnNumber || ret._id.toString().slice(-6)}`,
        message: `Customer return request of ${retAmtStr} (${ret.reason || 'Damage / Quality Issue'}) is pending review and physical inspection.`,
        date: ret.createdAt,
        formattedDate: new Date(ret.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        entityId: ret._id,
        partyName: ret.customerName || 'Customer',
        amount: retAmt,
        amountFormatted: retAmtStr,
        actionUrl: `/returns/refund`,
        actionLabel: 'Review Return',
        meta: { status: ret.status },
      });
    });

    // Sort notifications: URGENT first, then WARNING, then INFO; then date desc
    const severityWeight = { URGENT: 1, WARNING: 2, ERROR: 2, INFO: 3, SUCCESS: 4 };
    notifications.sort((a, b) => {
      const wA = severityWeight[a.severity] || 3;
      const wB = severityWeight[b.severity] || 3;
      if (wA !== wB) return wA - wB;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const urgentCount = notifications.filter((n) => n.severity === 'URGENT').length;

    return sendSuccessResponse(
      res,
      200,
      {
        summary: {
          total: notifications.length,
          urgentCount,
          orders: {
            readyToDispatch: readyToDispatchCount,
            qc: qcOrdersCount,
            processing: processingOrdersCount,
            newOrders: newOrdersCount,
          },
          customers: {
            pendingApprovals: pendingApprovalsCount,
            corrections: pendingCorrectionsCount,
          },
          returns: {
            pending: pendingReturnsCount,
          },
        },
        notifications,
      },
      'System notifications retrieved successfully.'
    );
  } catch (error) {
    console.error('getAllSystemNotifications error:', error);
    return sendErrorResponse(res, 500, 'GET_NOTIFICATIONS_FAILED', error.message);
  }
};
