import Payment from "../../models/Accounting/Payment.model.js";

/**
 * Automatically marks uncredited stale cheques (> 3 months validity) as EXPIRED in the database
 */
export const autoExpireStaleCheques = async (tenantId = null) => {
  try {
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const staleFilter = {
      paymentMode: "CHEQUE",
      "paymentDetails.isCredited": { $ne: true },
      status: { $nin: ["CLEARED", "CANCELLED", "EXPIRED"] },
      $or: [
        { "paymentDetails.chequeExpiryDate": { $lte: now } },
        {
          "paymentDetails.chequeExpiryDate": { $exists: false },
          "paymentDetails.chequeDate": { $lte: threeMonthsAgo },
        },
        {
          "paymentDetails.chequeExpiryDate": null,
          "paymentDetails.chequeDate": { $lte: threeMonthsAgo },
        },
      ],
    };

    if (tenantId) {
      staleFilter.tenantId = tenantId;
    }

    const res = await Payment.updateMany(staleFilter, {
      $set: {
        status: "EXPIRED",
        "paymentDetails.chequeStatus": "EXPIRED",
      },
    });

    return res;
  } catch (err) {
    console.error("autoExpireStaleCheques error:", err);
  }
};

