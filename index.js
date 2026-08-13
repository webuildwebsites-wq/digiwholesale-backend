import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';
import customerRouter from './src/routes/Auth/CustomerAuth.js';
import employeeRouter from './src/routes/Auth/EmployeeAuth.js';
import employeeManagementRouter from './src/routes/Auth/EmployeeManagement.js';
import systemConfigRouter from './src/routes/Auth/SystemConfig.js';
import departmentRouter from './src/routes/Auth/Department.js';
import connectDB from './src/core/config/DB/connectDb.js';
import imageUploadRouter from './src/routes/uploads/upload.js';
import dropdownRouter from './src/routes/Product/Dropdown.js';
import salesPersonRouter from './src/routes/Auth/SalesPerson.js';
import locationRouter from './src/routes/Location/location.routes.js';
import orderRouter from './src/routes/order/order.route.js';
import productRouter from './src/routes/Product/product.routes.js';
import repairRouter from './src/routes/repair.routes.js';
import vendorRouter from './src/routes/vendor.routes.js';
import vendorOrderRouter from './src/routes/vendorOrder.routes.js';
import jobCardRoutes from './src/routes/jobCard.routes.js';
import analyticsRouter from './src/routes/analytics.routes.js';
import Salesrouter from './src/routes/SALES/sales.routes.js';
import returnRefundRouter from './src/routes/SALES/returnRefund.routes.js';
import exchangeRouter from './src/routes/SALES/exchange.routes.js';
import settingRouter from "./src/routes/SETTING/settings.routes.js";
import purchaseRouter from './src/routes/Purchase/purchase.route.js';
import purchaseInwardRouter from './src/routes/Purchase/purchaseInward.routes.js';
import purchaseQCRouter from './src/routes/Purchase/purchaseQC.routes.js';
import purchaseReturnRouter from './src/routes/Purchase/purchaseReturn.routes.js';
import billingRouter from './src/routes/billing.routes.js';
import tenantRouter from './src/routes/tenant.routes.js';
import { startBillingCron } from './src/core/services/billing/billingCron.js';
import purchaseProposalRouter from './src/routes/Purchase/purchaseProposal.routes.js';

dotenv.config();

if (!process.env.PASSWORD_SECRET) {
  console.error('FATAL: PASSWORD_SECRET environment variable is not set. Server cannot start.');
  process.exit(1);
}

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5001",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://139.59.65.108",
  "http://139.59.65.108:3005",
  "https://digioptics-wholesale.netlify.app",
  "https://digiopticswholesaledibysr.netlify.app",
  "https://digiwholesale-frontend.digibysr.in",
  "http://testing-digiwholesale-backend.digibysr.in",
  "http://testing-digiwholesale-frontend.digibysr.in"
];


app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 200,
}));


app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(morgan('combined'));
app.use(hpp());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.set('trust proxy', 1);

try {
  app.get("/", (req, res) => {
    res.json({
      message: "DigiOptics Wholesale Server is running on port " + (process.env.PORT || 8086),
      error: false,
      success: true,
    })
  })

  // EMPLOYEE ROUTES (Admin/Staff)
  app.use('/api/employee/auth', employeeRouter);
  app.use('/api/employee/management', employeeManagementRouter);

  // SALES PERSON ROUTES
  app.use('/api/employee/sales-persons', salesPersonRouter);

  // SYSTEM CONFIGURATION ROUTES (SuperAdmin/Admin only)
  app.use('/api/system/config', systemConfigRouter);

  // DEPARTMENT & SUB-ROLE ROUTES
  app.use('/api/departments', departmentRouter);

  // CUSTOMER ROUTES
  app.use('/api/customer/management', customerRouter);

  // UPLOAD IMAGE ROUTES
  app.use('/api/bucket/upload-image', imageUploadRouter)

  // PRODUCT ROUTES (All dropdowns including brands, categories, business-types)
  app.use('/api/product', dropdownRouter);

  // LOCATION ROUTES (New unified structure)
  app.use('/api/location', locationRouter);

  // CUSTOMER ORDER MODULE
  app.use("/api/tenants", tenantRouter);

  app.use('/api/order', orderRouter);

  // PRODUCTS MODULE
  app.use('/api/digi/product', productRouter);

  // Repair route
  app.use("/api/repair", repairRouter);

  // vendor route
  app.use("/api/vendor", vendorRouter);

  // vendor order & return route
  app.use("/api/vendor-order", vendorOrderRouter);

  // JC route
  app.use("/api/jc", jobCardRoutes);

  // ANALYTICS / DASHBOARD
  app.use("/api/analytics", analyticsRouter);

  // SALES
  app.use("/api/sale", Salesrouter);

  // RETURN & REFUND
  app.use("/api/return-refund", returnRefundRouter);

  // EXCHANGE
  app.use("/api/exchange", exchangeRouter);

  // SETTINGS
  app.use("/api/settings", settingRouter);

  // PROPOSAL
  app.use("/api/vendor-proposal", purchaseProposalRouter);

  // Purchase module
  app.use("/api/purchase", purchaseRouter);
  app.use("/api/purchase-inward", purchaseInwardRouter);
  app.use("/api/purchase-qc", purchaseQCRouter);
  app.use("/api/purchase-return", purchaseReturnRouter);
  app.use("/api/billing", billingRouter);

} catch (error) {
  console.error("Error occurred:", error);
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } });
  }

  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err?.code || "INTERNAL_ERROR",
      message: err?.message || "Internal Server Error",
    },
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

app.listen(process.env.PORT || 8080, () => {
  console.log(`Server is running http://localhost:${process.env.PORT || 8080}`);
});

connectDB()
  .then(async () => {
    console.log("DB Connected");
    console.log("MongoDB TTL indexes active - Automatic deletion enabled for records older than 30 days");
    startBillingCron();
  })
  .catch(err => console.error("DB Failed:", err));