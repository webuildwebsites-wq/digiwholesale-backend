import Customer from "../../models/Auth/Customer.js";
import employeeSchema from "../../models/Auth/Employee.js";
import BulkOrder from "../../models/order/BulkOrder.js";

export async function getDashboardAnalyticsService() {
    const now = new Date();

    const [activeCustomers, totalStaff, recentOrders, statusCounts] = await Promise.all([
        Customer.countDocuments({
            "status.isActive": true,
            "status.isSuspended": false,
            isDeleted: false,
        }),

        employeeSchema.countDocuments({
            isActive: true,
            isDeleted: false,
        }),

        BulkOrder.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),

        BulkOrder.aggregate([
            { $unwind: "$orders" },
            {
                $group: {
                    _id: "$orders.status",
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);

    const statusMap = {
        Processing: 0,
        Submitted:  0,
        Deliverable:0,
        Completed:  0,
        Draft:      0,
        Cancelled:  0,
    };

    for (const item of statusCounts) {
        if (item._id in statusMap) {
            statusMap[item._id] = item.count;
        }
    }

    const totalOrders = Object.values(statusMap).reduce((sum, count) => sum + count, 0);

    const orderdata = {
        active:         statusMap.Submitted + statusMap.Processing,
        submitted:      statusMap.Submitted,
        processing:     statusMap.Processing,
        totalOrders,
        totalEmployees: totalStaff,
        delivered:      statusMap.Completed,
        readyToDeliver: statusMap.Deliverable,
        cancelled:      statusMap.Cancelled,
        draft:          statusMap.Draft,
        generatedAt:    now.toISOString(),
    };

    return {
        customers: {
            activeUsers: activeCustomers,
        },
        orders: orderdata,
        staff: {
            total: totalStaff,
        },
        recentOrders,
        generatedAt: now.toISOString(),
    };
}