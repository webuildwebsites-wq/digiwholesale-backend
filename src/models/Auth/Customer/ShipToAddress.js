import mongoose from "mongoose";

const shipToAddressSchema = new mongoose.Schema({
    branchName: {
        type: String,
        required: true,
        trim: true
    },
    customerContactName: {
        type: String,
        required: true,
        trim: true
    },
    customerContactNumber: {
        type: String,
        required: true,
        match: [/^[0-9]{10}$/, "Contact number must be 10 digits"]
    },
    country : {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    zipCode: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    billingCurrency: {
        type: String,
        required: true,
        trim: true
    },
    billingMode: {
        type: String,
        required: true,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "employee",
        required: false,
        default: null
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "employee"
    }
}, { timestamps: true, _id: true });

export default shipToAddressSchema;