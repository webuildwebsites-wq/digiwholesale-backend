import Customer from "../../models/Auth/Customer.js";
import employeeSchema from "../../models/Auth/Employee.js";
import Order from "../../models/order/customer.order.js";

function startOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}


function endOf(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day); 
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardAnalyticsService() {
  const now = new Date();

  const todayStart  = startOf(now);
  const todayEnd    = endOf(now);
  const weekStart   = startOfWeek(now);
  const monthStart  = startOfMonth(now);

  const [
    activeCustomers,
    pendingOrders,
    completedOrders,
    dailyOrders,
    weeklyOrders,
    monthlyOrders,
    totalStaff,
    orderStatusBreakdown,
    recentOrders,
  ] = await Promise.all([
    Customer.countDocuments({
      "status.isActive": true,
      "status.isSuspended": false,
      isDeleted: false,
    }),

    Order.countDocuments({
      status: { $in: ["Submitted", "Processing"] },
    }),

    Order.countDocuments({ status: "Completed" }),

    Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }),

    Order.countDocuments({
      createdAt: { $gte: weekStart, $lte: now },
    }),

    Order.countDocuments({
      createdAt: { $gte: monthStart, $lte: now },
    }),

    employeeSchema.countDocuments({
      isActive: true,
      isDeleted: false,
    }),

    Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderNumber status totalOrderPrice customer.customerName createdAt")
      .lean(),
  ]);

  const statusMap = {
    Draft: 0,
    Submitted: 0,
    Processing: 0,
    Completed: 0,
    Cancelled: 0,
  };
  for (const item of orderStatusBreakdown) {
    if (item._id in statusMap) {
      statusMap[item._id] = item.count;
    }
  }

  return {
    customers: {
      activeUsers: activeCustomers,
    },
    orders: {
      pending: pendingOrders,
      completed: completedOrders,
      daily: dailyOrders,
      weekly: weeklyOrders,
      monthly: monthlyOrders,
      statusBreakdown: statusMap,
    },
    staff: {
      total: totalStaff,
    },
    recentOrders,
    generatedAt: now.toISOString(),
  };
}
