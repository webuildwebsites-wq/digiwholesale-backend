import Customer from "../../models/Auth/Customer.js";
import employeeSchema from "../../models/Auth/Employee.js";
import Order from "../../models/order/customer.order.js";

/**
 * Returns start-of-day (00:00:00.000) for a given date
 */
function startOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns end-of-day (23:59:59.999) for a given date
 */
function endOf(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Returns the Monday of the week containing `date`
 */
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon …
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the first day of the month containing `date`
 */
function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardAnalyticsService() {
  const now = new Date();

  // ── Date boundaries ──────────────────────────────────────────────────────────
  const todayStart  = startOf(now);
  const todayEnd    = endOf(now);
  const weekStart   = startOfWeek(now);
  const monthStart  = startOfMonth(now);

  // ── Run all queries in parallel ──────────────────────────────────────────────
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
    // 1. Active customers (approved, active, not deleted, not suspended)
    Customer.countDocuments({
      "status.isActive": true,
      "status.isSuspended": false,
      isDeleted: false,
    }),

    // 2. Pending orders (Submitted + Processing)
    Order.countDocuments({
      status: { $in: ["Submitted", "Processing"] },
    }),

    // 3. Completed orders (all time)
    Order.countDocuments({ status: "Completed" }),

    // 4. Daily orders (today)
    Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }),

    // 5. Weekly orders (Mon → now)
    Order.countDocuments({
      createdAt: { $gte: weekStart, $lte: now },
    }),

    // 6. Monthly orders (1st of month → now)
    Order.countDocuments({
      createdAt: { $gte: monthStart, $lte: now },
    }),

    // 7. Total active staff (employees, not deleted)
    employeeSchema.countDocuments({
      isActive: true,
      isDeleted: false,
    }),

    // 8. Order status breakdown (all statuses)
    Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 9. Last 5 recent orders (lightweight projection)
    Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderNumber status totalOrderPrice customer.customerName createdAt")
      .lean(),
  ]);

  // ── Shape the status breakdown into a clean object ───────────────────────────
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
