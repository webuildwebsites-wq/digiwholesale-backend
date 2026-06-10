import mongoose from "mongoose";

const BulkOrderItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DigiProduct",
            required: true,
        },

        orderType: {
            type: String,
            enum: ["STOCK", "RX"],
        },

        code: String,
        itemName: String,

        category: {
            type: String,
            enum: ["FRAME", "SUNGLASS", "LENS", "CONTACT_LENS"],
        },
        unit : {
            type: String,
            enum: ["PIECE", "PAIR", "BOX"],
        },

        brand: String,
        color: String,
        size: String,
        shape: String,
        material: String,
        dimensions: String,

        price: Number,
        gst: Number,
        hsnSac: String,
        mrp: Number,
        qty: Number,

        sph: Number,
        cyl: Number,
        axis: Number,
        add: Number,
        index: Number,

        discountPercent: Number,
        discountAmount: Number,

        tint: String,
        coating: String,
        expiry: String,
        disposability: String,
    },
    { _id: false }
);

const BulkOrderOrderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
        },

        items: {
            type: [BulkOrderItemSchema],
            required: true,
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: "At least one item is required",
            },
        },

        cgst : String,
        sgst : String,

        status: {
            type: String,
            enum: [
                "Draft", 
                "Submitted", 
                "Processing", 
                "Completed", 
                "Cancelled"
            ],
            default: "Submitted",
        },
    },
    { _id: false }
);

const bulkOrderSchema = new mongoose.Schema(
    {
        customer: {
            customerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Customer",
                required: true,
            },
            customerName: {
                type: String,
                required: true,
            },
            customerShipToId: {
                type: mongoose.Schema.Types.ObjectId,
            },
            customerShipToBranchName: {
                type: String,
            },
        },

        orders: {
            type: [BulkOrderOrderSchema],
            required: true,
            validate: {
                validator: (orders) => Array.isArray(orders) && orders.length > 0,
                message: "At least one order is required",
            },
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("bulkOrders", bulkOrderSchema);