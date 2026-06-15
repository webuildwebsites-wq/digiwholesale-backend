import employeeSchema from "../../models/Auth/Employee.js";
import BulkOrder from "../../models/order/BulkOrder.js";

export async function getDashboardAnalyticsService() {
    const now = new Date();

    const [statusCounts, totalEmployees] = await Promise.all([
        BulkOrder.aggregate([
            { $unwind: "$orders" },
            { $group: { _id: "$orders.status", count: { $sum: 1 } } },
        ]),
        employeeSchema.countDocuments({ isActive: true, isDeleted: false }),
    ]);

    const statusMap = { Processing: 0, Submitted: 0, Deliverable : 0, Completed: 0, Draft: 0, Cancelled: 0 };
    for (const item of statusCounts) {
        if (item._id in statusMap) statusMap[item._id] = item.count;
    }

    const totalOrders = Object.values(statusMap).reduce((a, b) => a + b, 0);

    return {
        active:          statusMap.Processing,
        totalOrders,
        totalEmployees,
        delivered:       statusMap.Completed,
        readyToDeliver:  statusMap.Deliverable,
        draft:           statusMap.Draft,
        generatedAt:     now.toISOString(),
    };
}
