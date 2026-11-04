import mongoose from 'mongoose';
import BulkOrder from '../../../models/order/BulkOrder.js';
import Customer from '../../../models/Auth/Customer.js';
import ReturnRefund from '../../../models/SALES/ReturnRefund.model.js';
import Payment from '../../../models/Accounting/Payment.model.js';
import { autoExpireStaleCheques } from '../../services/chequeExpiryService.js';
import { sendSuccessResponse, sendErrorResponse } from '../../../Utils/response/responseHandler.js';

/**
 * Get unified system notifications across Orders, Customer Approvals, Returns, and Operations
 */
export const getAllSystemNotifications = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Auto-expire any stale cheques (> 3 months) before querying
    await autoExpireStaleCheques(tenantId).catch(() => {});

    // Fetch operational data in parallel
    const [activeOrders, pendingCustomers, pendingReturns, pendingCheques] = await Promise.all([
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

      // D. Pending PDC & In-Clearing Cheques
      Payment.find({
        ...tenantFilter,
        paymentMode: { $regex: /^cheque$/i },
        'paymentDetails.isCredited': false,
        'paymentDetails.chequeStatus': { $nin: ['CLEARED', 'CANCELLED', 'EXPIRED'] },
        status: { $nin: ['CLEARED', 'CANCELLED', 'EXPIRED'] },
        $or: [
          { 'paymentDetails.isPostDated': true },
          { 'paymentDetails.chequeDate': { $exists: true, $ne: null } },
        ],
      })
        .sort({ 'paymentDetails.chequeDate': 1, createdAt: -1 })
        .limit(60)
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
          actionUrl: `/approvals`,
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
          actionUrl: `/corrections`,
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
        actionUrl: `/return-refund`,
        actionLabel: 'Review Return',
        meta: { status: ret.status },
      });
    });

    // --- 4. Process PDC Cheque Notifications (Maturity date alerts) ---
    const today = new Date();
    const todayMidnightMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    let pdcDueTodayCount = 0;
    let pdcOverdueCount = 0;
    let pdcExpiringCount = 0;
    const dueTodayCheques = [];

    (pendingCheques || []).forEach((item) => {
      const chqDate = item.paymentDetails?.chequeDate ? new Date(item.paymentDetails.chequeDate) : null;
      let expDate = item.paymentDetails?.chequeExpiryDate ? new Date(item.paymentDetails.chequeExpiryDate) : null;
      if (!expDate && chqDate) {
        expDate = new Date(chqDate);
        expDate.setMonth(expDate.getMonth() + 3);
      }

      const chqMidnightMs = chqDate
        ? new Date(chqDate.getFullYear(), chqDate.getMonth(), chqDate.getDate()).getTime()
        : null;

      const diffDays = chqMidnightMs != null
        ? Math.round((chqMidnightMs - todayMidnightMs) / (1000 * 60 * 60 * 24))
        : null;

      const isDueToday = diffDays === 0;
      const isOverdue = diffDays != null && diffDays < 0;

      const expMidnightMs = expDate
        ? new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate()).getTime()
        : 0;
      const daysUntilExpiry = expDate
        ? Math.max(0, Math.ceil((expMidnightMs - todayMidnightMs) / (1000 * 60 * 60 * 24)))
        : 0;
      const isExpiringSoon = expDate && daysUntilExpiry <= 15 && daysUntilExpiry > 0;

      const chqNum = item.paymentDetails?.chequeNumber ? `#${item.paymentDetails.chequeNumber}` : 'PDC';
      const partyTitle = item.partyName || (item.partyModel === 'Vendor' ? 'Vendor' : 'Customer');
      const amount = Number(item.grossAmount || 0);
      const amountStr = `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      const chqDateFormatted = chqDate
        ? chqDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Today';
      const expDateFormatted = expDate
        ? expDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      const actionUrl = item.partyModel === 'Vendor'
        ? `/accounting/vendor-statement/${item.partyId || ''}`
        : (item.partyId ? `/accounting/customer-statement/${item.partyId}` : '/accounting/cheques');

      if (isDueToday) {
        pdcDueTodayCount++;
        dueTodayCheques.push({ chqNum, partyTitle, amountStr, amount, id: item._id, partyId: item.partyId });

        notifications.push({
          id: `pdc-due-${item._id}`,
          category: 'CHEQUES',
          categoryLabel: 'PDC Clearance',
          type: 'PDC_DUE_TODAY',
          severity: 'URGENT',
          title: `PDC Scheduled for Clearance Today: Cheque ${chqNum}`,
          message: `You have PDC Cheque ${chqNum} (${partyTitle}, ${amountStr}) scheduled for clearance today. If the cheque has been cleared, please update its status; otherwise, take the necessary action.`,
          date: chqDate || item.createdAt || new Date(),
          formattedDate: `Today (${chqDateFormatted})`,
          entityId: item._id,
          entityNumber: item.paymentDetails?.chequeNumber || item.paymentNumber,
          partyName: partyTitle,
          amount,
          amountFormatted: amountStr,
          actionUrl,
          actionLabel: 'Update Status',
          meta: {
            paymentId: item._id,
            partyId: item.partyId,
            partyModel: item.partyModel,
            chequeNumber: item.paymentDetails?.chequeNumber,
            chequeDate: item.paymentDetails?.chequeDate,
            isDueToday: true,
          },
        });
      } else if (isOverdue) {
        pdcOverdueCount++;
        const overdueDays = Math.abs(diffDays);
        notifications.push({
          id: `pdc-overdue-${item._id}`,
          category: 'CHEQUES',
          categoryLabel: 'PDC Clearance',
          type: 'PDC_OVERDUE',
          severity: overdueDays >= 3 ? 'URGENT' : 'WARNING',
          title: `Overdue PDC Clearance: Cheque ${chqNum}`,
          message: `PDC Cheque ${chqNum} (${partyTitle}, ${amountStr}) was scheduled for clearance on ${chqDateFormatted} (${overdueDays} day${overdueDays > 1 ? 's' : ''} ago). If the cheque has been cleared, please update its status; otherwise, take the necessary action.`,
          date: chqDate || item.createdAt || new Date(),
          formattedDate: `${overdueDays}d overdue (${chqDateFormatted})`,
          entityId: item._id,
          entityNumber: item.paymentDetails?.chequeNumber || item.paymentNumber,
          partyName: partyTitle,
          amount,
          amountFormatted: amountStr,
          actionUrl,
          actionLabel: 'Update Status',
          meta: {
            paymentId: item._id,
            partyId: item.partyId,
            partyModel: item.partyModel,
            chequeNumber: item.paymentDetails?.chequeNumber,
            chequeDate: item.paymentDetails?.chequeDate,
            isOverdue: true,
          },
        });
      } else if (isExpiringSoon) {
        pdcExpiringCount++;
        notifications.push({
          id: `pdc-expiring-${item._id}`,
          category: 'CHEQUES',
          categoryLabel: 'Cheque Expiry',
          type: 'CHEQUE_EXPIRING_SOON',
          severity: 'WARNING',
          title: `Cheque Expiring Soon: ${chqNum}`,
          message: `Cheque ${chqNum} (${partyTitle}, ${amountStr}) will expire on ${expDateFormatted} (${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''} remaining). Please verify clearance before the 3-month RBI deadline.`,
          date: item.createdAt || new Date(),
          formattedDate: `Exp: ${expDateFormatted}`,
          entityId: item._id,
          entityNumber: item.paymentDetails?.chequeNumber || item.paymentNumber,
          partyName: partyTitle,
          amount,
          amountFormatted: amountStr,
          actionUrl,
          actionLabel: 'Review Cheque',
          meta: {
            paymentId: item._id,
            partyId: item.partyId,
            isExpiringSoon: true,
          },
        });
      }
    });

    // If there are multiple PDCs scheduled for clearance today, add a consolidated summary notification
    if (dueTodayCheques.length > 1) {
      const totalDueTodayAmt = dueTodayCheques.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalDueTodayStr = `₹${totalDueTodayAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      notifications.unshift({
        id: `pdc-summary-today-${today.toISOString().slice(0, 10)}`,
        category: 'CHEQUES',
        categoryLabel: 'PDC Clearance',
        type: 'PDC_DUE_SUMMARY',
        severity: 'URGENT',
        title: `${dueTodayCheques.length} PDCs Scheduled for Clearance Today`,
        message: 'You have these PDCs scheduled for clearance today. If the cheque has been cleared, please update its status; otherwise, take the necessary action.',
        date: new Date(),
        formattedDate: 'Today',
        amount: totalDueTodayAmt,
        amountFormatted: totalDueTodayStr,
        actionUrl: '/accounting/cheques',
        actionLabel: 'Manage All Cheques',
        meta: {
          dueTodayCount: dueTodayCheques.length,
          totalAmount: totalDueTodayAmt,
        },
      });
    }

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
          cheques: {
            dueToday: pdcDueTodayCount,
            overdue: pdcOverdueCount,
            expiringSoon: pdcExpiringCount,
            totalPending: (pendingCheques || []).length,
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
