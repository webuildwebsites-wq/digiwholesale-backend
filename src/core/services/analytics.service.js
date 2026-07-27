import Customer from "../../models/Auth/Customer.js";
import employeeSchema from "../../models/Auth/Employee.js";
import BulkOrder from "../../models/order/BulkOrder.js";

export async function getDashboardAnalyticsService(tenantId) {
    const now = new Date();
    const tenantFilter = tenantId ? { tenantId } : {};

    const [activeCustomers, totalStaff, recentOrders, statusCounts] = await Promise.all([
        Customer.countDocuments({
            ...tenantFilter,
            "status.isActive": true,
            "status.isSuspended": false,
            isDeleted: false,
        }),
        employeeSchema.countDocuments({
            ...tenantFilter,
            isActive: true,
            isDeleted: false,
        }),
        BulkOrder.find(tenantFilter)
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        BulkOrder.aggregate([
            { $match: { ...tenantFilter } },
            { $unwind: "$orders" },
            { $group: { _id: "$orders.status", count: { $sum: 1 } } },
        ]),
    ]);

    const statusMap = {
        Draft:           0,
        Submitted:       0,
        Processing:      0,
        QC:              0,
        ReadyToDispatch: 0,
        Dispatched:      0,
        Delivered:       0,
        Completed:       0,
        Cancelled:       0,
    };

    for (const item of statusCounts) {
        if (item._id in statusMap) {
            statusMap[item._id] = item.count;
        }
    }

    const totalOrders = Object.values(statusMap).reduce((sum, count) => sum + count, 0);

    const orderdata = {
        active:          statusMap.Submitted + statusMap.Processing + statusMap.QC + statusMap.ReadyToDispatch,
        submitted:       statusMap.Submitted,
        processing:      statusMap.Processing,
        qc:              statusMap.QC,
        readyToDispatch: statusMap.ReadyToDispatch,
        dispatched:      statusMap.Dispatched,
        delivered:       statusMap.Delivered,
        completed:       statusMap.Completed,
        cancelled:       statusMap.Cancelled,
        draft:           statusMap.Draft,
        totalOrders,
        totalEmployees:  totalStaff,
        generatedAt:     now.toISOString(),
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