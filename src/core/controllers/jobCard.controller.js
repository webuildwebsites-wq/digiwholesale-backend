import Order from "../../models/order/customer.order.js"

export const getMainReportData = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const tenantId = req.user.tenantId;
    const dateMatch = { tenantId, createdAt: { $gte: start, $lte: end } };
    const completedDateMatch = {
      tenantId,
      status: "Completed",
      updatedAt: { $gte: start, $lte: end },
    };

    const [orders, createdTotals] = await Promise.all([
      Order.find(dateMatch).sort({ createdAt: -1 }).lean(),

      Order.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalPrice: { $sum: "$price" },
            totalShipping: { $sum: "$shippingCharges" },
            totalOtherCharges: { $sum: "$otherCharges" },
            totalOrderPrice: { $sum: "$totalOrderPrice" },
            ids: { $push: "$_id" },
          },
        },
      ]),
    ]);

    const createdSummary = createdTotals[0] || {
      totalOrders: 0,
      totalPrice: 0,
      totalShipping: 0,
      totalOtherCharges: 0,
      totalOrderPrice: 0,
      ids: [],
    };

    const orderIds = createdSummary.ids;

    const [completedOrders, completedTotals] = await Promise.all([
      Order.find(completedDateMatch).sort({ updatedAt: -1 }).lean(),

      Order.aggregate([
        { $match: completedDateMatch },
        {
          $group: {
            _id: null,
            completedCount: { $sum: 1 },
            completedTotalSum: { $sum: "$totalOrderPrice" },
            completedPriceSum: { $sum: "$price" },
            ids: { $push: "$_id" },
          },
        },
      ]),
    ]);

    const completedSummary = completedTotals[0] || {
      completedCount: 0,
      completedTotalSum: 0,
      completedPriceSum: 0,
      ids: [],
    };

    const [statusBreakdown, productModeBreakdown] = await Promise.all([
      orderIds.length
        ? Order.aggregate([
          {
            $match: {
              _id: { $in: orderIds },
              status: { $ne: "" },
            },
          },
          {
            $group: {
              _id: "$status",
              totalAmount: { $sum: "$totalOrderPrice" },
              count: { $sum: 1 },
            },
          },
        ])
        : [],

      orderIds.length
        ? Order.aggregate([
          {
            $match: {
              _id: { $in: orderIds },
            },
          },
          {
            $group: {
              _id: "$productMode",
              totalAmount: { $sum: "$totalOrderPrice" },
              count: { $sum: 1 },
            },
          },
        ])
        : [],
    ]);

    const completedBalanceReceived =
      completedSummary.completedTotalSum - completedSummary.completedPriceSum;

    const transactionSummary = {};
    statusBreakdown.forEach((t) => {
      transactionSummary[t._id] = {
        totalAmount: t.totalAmount,
        count: t.count,
      };
    });

    const productModeSummary = {};
    productModeBreakdown.forEach((p) => {
      productModeSummary[p._id] = {
        totalAmount: p.totalAmount,
        count: p.count,
      };
    });


    return res.status(200).json({
      success: true,

      jobCards: orders,
      totalJobCards: createdSummary.totalOrders,
      totalAdvance: createdSummary.totalPrice,       
      totalBalance: createdSummary.totalOrderPrice, 
      totalShippingCharges: createdSummary.totalShipping,
      totalOtherCharges: createdSummary.totalOtherCharges,

      deliveredJobCards: completedOrders,
      deliveredCount: completedSummary.completedCount,
      deliveredTotalSum: completedSummary.completedTotalSum,
      deliveredJcBalanceReceived: completedBalanceReceived,

      commissionByCreated: [],
      totalCommissionCreated: 0,
      commissionByDelivered: [],
      totalCommissionDelivered: 0,

      transactionSummary,

      productModeSummary,
    });

  } catch (error) {
    console.error("Order Report Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDailyReportData = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const baseMatch = {
      tenantId: req.user.tenantId,
      createdAt: { $gte: start, $lte: end },
    };

    const [
      expenseResult,
      productResult,
      jobCardStatusResult,
      jobCardResult,
      salesResult,
      prescriptionResult,
    ] = await Promise.all([

      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            status: "Cancelled",
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalExpenseAmount: { $sum: "$totalOrderPrice" },
                  totalRecords: { $sum: 1 },
                },
              },
            ],
            data: [{ $sort: { createdAt: -1 } }],
          },
        },
      ]),

      Order.aggregate([
        { $match: baseMatch },
        {
          $addFields: {
            finalCategory: "$category.name",
            finalProductName: "$productName.name",
          },
        },
        {
          $facet: {
            data: [
              {
                $project: {
                  createdAt: 1,
                  price: 1,
                  totalOrderPrice: 1,
                  finalCategory: 1,
                  finalProductName: 1,
                  brand: "$brand.name",
                  coating: "$coating.name",
                  treatment: "$treatment.name",
                  status: 1,
                },
              },
              { $sort: { createdAt: -1 } },
            ],
            categoryCount: [
              {
                $group: {
                  _id: "$category.name",
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),

      Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$status",
            totalAmount: { $sum: "$totalOrderPrice" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            status: "Completed",
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  totalAmount: { $sum: "$totalOrderPrice" },
                  totalBalance: { $sum: "$shippingCharges" },
                  totalAdvance: { $sum: "$otherCharges" },
                  totalCollected: { $sum: "$price" },
                },
              },
            ],
            productCostSummary: [
              {
                $group: {
                  _id: null,
                  totalProductCost: { $sum: "$price" },
                  totalProducts: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            status: { $in: ["Submitted", "Processing", "Completed"] },
          },
        },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalSalesAmount: { $sum: "$totalOrderPrice" },
                  totalRecords: { $sum: 1 },
                },
              },
            ],
            transactionSummary: [
              {
                $group: {
                  _id: "$productMode",
                  totalAmount: { $sum: "$totalOrderPrice" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            data: [{ $sort: { createdAt: -1 } }],
          },
        },
      ]),

      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            productMode: "Rx",
          },
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalAmount: { $sum: "$totalOrderPrice" },
          },
        },
      ]),

    ]);


    const expenseSummary = expenseResult[0]?.summary[0] || { totalExpenseAmount: 0, totalRecords: 0 };
    const expenseData = expenseResult[0]?.data || [];

    const productData = productResult[0]?.data || [];
    const categoryCount = productResult[0]?.categoryCount || [];

    const transactionTypeSummary = jobCardStatusResult || [];

    const jobCardData = jobCardResult[0] || {};

    const deliveredSummary = jobCardData.summary?.[0] || {
      count: 0,
      totalAmount: 0,
      totalBalance: 0,
      totalAdvance: 0,
      totalCollected: 0,
    };

    const deliveredProductCost = jobCardData.productCostSummary?.[0] || {
      totalProductCost: 0,
      totalProducts: 0,
    };

    const salesSummary = salesResult[0]?.summary[0] || { totalSalesAmount: 0, totalRecords: 0 };
    const salesTransactionSummary = salesResult[0]?.transactionSummary || [];
    const salesData = salesResult[0]?.data || [];

    const prescriptionSummary = prescriptionResult[0] || {
      totalRecords: 0,
      totalAmount: 0,
    };


    const netCollection =
      salesSummary.totalSalesAmount +
      deliveredSummary.totalCollected;

    const netProfit =
      netCollection -
      expenseSummary.totalExpenseAmount -
      deliveredProductCost.totalProductCost;


    return res.status(200).json({
      success: true,
      dateRange: { startDate: start, endDate: end },

      expenses: {
        totalRecords: expenseSummary.totalRecords,
        totalExpenseAmount: expenseSummary.totalExpenseAmount,
        data: expenseData,
      },

      products: {
        totalRecords: productData.length,
        data: productData,
        categoryCount,
      },

      jobCardStatus: {
        transactionTypeSummary,
      },

      jobCards: {
        totalRecords: deliveredSummary.count,
        deliveredSummary,
        deliveredProductCost,
      },

      sales: {
        totalRecords: salesSummary.totalRecords,
        totalSalesAmount: salesSummary.totalSalesAmount,
        transactionSummary: salesTransactionSummary,
        data: salesData,
      },

      prescriptions: {
        totalRecords: prescriptionSummary.totalRecords,
        totalAmount: prescriptionSummary.totalAmount,
      },

      dashboardSummary: {
        netCollection,
        netProfit,
      },
    });

  } catch (error) {
    console.error("Full Business Report Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};