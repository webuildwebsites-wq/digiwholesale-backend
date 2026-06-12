import mongoose from "mongoose";

const powerSchema = new mongoose.Schema({
    side: { type: String, enum: ["R", "L"] },
    sph: Number,
    cyl: Number,
    axis: Number,
    add: Number,
    diameter: Number,
}, { _id: false });

const prismSchema = new mongoose.Schema({
    side: { type: String, enum: ["R", "L"] },
    prism: Number,
    base: String,
}, { _id: false });

const centrationSchema = new mongoose.Schema({
    side: { type: String, enum: ["R", "L"] },
    pd: Number,
    corridor: Number,
    fittingHeight: Number,
}, { _id: false });

const fittingSchema = new mongoose.Schema({
    hasFlatFitting: Boolean,
    dbl: Number,
    frameType: String,
    frameLength: Number,
    frameHeight: Number,
}, { _id: false });

const lensDataSchema = new mongoose.Schema({
    pantoscopeAngle: Number,
    bowAngle: Number,
    bvd: Number,
}, { _id: false });

const resolvedEyeSchema = new mongoose.Schema({
    side: { type: String, enum: ["R", "L"] },
    itemCode: String,
    blankCode: String,
    supplier: String,
    baseCurve: Number,
    diameter: Number,
}, { _id: false });

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
            // enum: ["FRAME", "SUNGLASS", "LENS", "CONTACT_LENS"],
        },

        unit: {
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

        rx: {
            vendor: {
                id: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
                name: String,
            },

            lab: {
                id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductLab" },
                name: String,
            },

            orderReference: String,
            consumerCardName: String,
            opticianName: String,

            powerType: { type: String, enum: ["Single", "Both"] },
            productMode: { type: String, enum: ["Stock Lens", "Rx"] },
            hasPrism: Boolean,

            powers: [powerSchema],
            prisms: [prismSchema],
            centration: [centrationSchema],

            coating: {
                id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCoating" },
                name: String,
            },
            treatment: {
                id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductTreatment" },
                name: String,
            },
            tint: {
                id: { type: mongoose.Schema.Types.ObjectId, ref: "Tint" },
                name: String,
            },

            tintDetails: String,
            remarks: String,
            mirror: Boolean,

            resolved: [resolvedEyeSchema],

            fitting: fittingSchema,
            lensData: lensDataSchema,

            directCustomer: String,
            shippingCharges: Number,
            otherCharges: Number,
        },
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

        cgst: String,
        sgst: String,

        status: {
            type: String,
            enum: ["Draft", "Submitted", "Processing", "Completed", "Cancelled"],
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
    { timestamps: true }
);

bulkOrderSchema.index({ "customer.customerId": 1, createdAt: -1 });
bulkOrderSchema.index({ "orders.status": 1 });

export default mongoose.model("bulkOrders", bulkOrderSchema);
