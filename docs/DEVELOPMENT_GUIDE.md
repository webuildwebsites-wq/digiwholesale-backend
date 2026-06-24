# Development Guide - VisualEyes ERP System

## 🏗️ Project Structure Deep Dive

### **Technology Stack & Architecture Decisions**

#### **Backend Framework: Express.js**
```javascript
// index.js - Main server configuration
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
```

**Why Express.js?**
- **Lightweight & Fast**: Minimal overhead for high-performance APIs
- **Middleware Ecosystem**: Rich ecosystem for security, logging, and utilities
- **Scalability**: Easy to scale horizontally with load balancers
- **Community Support**: Large community and extensive documentation

#### **Database: MongoDB with Mongoose**
```javascript
// Mongoose schema example from User.js
const userSchema = new mongoose.Schema({
  EmployeeType: {
    type: String,
    enum: ['superadmin', 'subadmin', 'supervisor', 'user']
  }
});
```

**Why MongoDB?**
- **Flexible Schema**: Easy to evolve data models as business requirements change
- **Document-Based**: Natural fit for complex nested data structures
- **Horizontal Scaling**: Built-in sharding capabilities
- **JSON-Native**: Seamless integration with JavaScript/Node.js

### **Development Patterns & Best Practices**

#### **1. Modular Architecture Pattern**

```
Feature-Based Organization:
src/
├── models/Auth/           # Data layer
├── controllers/Auth/      # Business logic layer  
├── routes/Auth/          # API layer
├── middlewares/Auth/     # Security layer
└── Utils/               # Shared utilities
```

**Benefits:**
- **Separation of Concerns**: Each layer has a specific responsibility
- **Testability**: Easy to unit test individual components
- **Maintainability**: Changes in one layer don't affect others
- **Team Collaboration**: Multiple developers can work on different features

#### **2. Security-First Development**

```javascript
// Security middleware stack
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
app.use(mongoSanitize());  // Prevent NoSQL injection
app.use(hpp());            // HTTP Parameter Pollution protection
```

**Security Layers:**
- **Input Validation**: Mongoose schema validation + custom validators
- **Authentication**: JWT tokens with refresh token mechanism
- **Authorization**: Role-based permissions with hierarchical access
- **Data Sanitization**: MongoDB injection prevention
- **Rate Limiting**: API endpoint protection (ready for implementation)

#### **3. Error Handling Strategy**

```javascript
// Centralized error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    const status = err?.status || 500;
    res.status(status).json({
        message: err?.message || 'Internal Server Error',
        error: true,
        success: false,
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
});
```

**Error Handling Features:**
- **Consistent Response Format**: All errors follow the same structure
- **Environment-Aware**: Detailed errors in development, sanitized in production
- **Logging**: Comprehensive error logging for debugging
- **HTTP Status Codes**: Proper status codes for different error types

## 🔄 Development Workflow

### **1. Feature Development Process**

#### **Step 1: Model Definition**
```javascript
// Example: Customer.js model
const customerSchema = new mongoose.Schema({
  customerCode: {
    type: String,
    unique: true,
    required: [true, 'Customer code is required'],
    trim: true,
    uppercase: true
  },
  verification: {
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});
```

#### **Step 2: Controller Implementation**
```javascript
// Business logic in controllers
export const createCustomer = async (req, res) => {
  try {
    // Validation
    // Business logic
    // Database operations
    // Response formatting
  } catch (error) {
    // Error handling
  }
};
```

#### **Step 3: Route Definition**
```javascript
// API endpoint definition
import express from 'express';
import { createCustomer } from '../controllers/Auth/Customers/CustomerAuth.js';

const router = express.Router();
router.post('/register', createCustomer);
```

#### **Step 4: Middleware Integration**
```javascript
// Authentication and authorization
router.post('/protected-route', 
  authenticateToken,
  authorizeRole(['admin', 'supervisor']),
  controllerFunction
);
```

### **2. Database Design Patterns**

#### **Schema Design Philosophy**
```javascript
```

**Design Principles:**
- **Self-Documenting**: Schema serves as documentation
- **Business Rule Enforcement**: Validation at database level
- **Computed Fields**: Dynamic permissions based on user type
- **Referential Integrity**: Proper relationships between collections

#### **Indexing Strategy**
```javascript
// Recommended indexes for performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ EmployeeType: 1, department: 1, region: 1 });
customerSchema.index({ customerCode: 1 });
customerSchema.index({ region: 1, labMapping: 1 });
```

### **3. API Design Standards**

#### **Request/Response Format**
```javascript
// Standardized response structure
{
  "message": "Operation successful",
  "error": false,
  "success": true,
  "data": { ... },
  "pagination": { ... }  // For list endpoints
}
```

#### **HTTP Status Code Usage**
- **200**: Successful GET, PUT, PATCH
- **201**: Successful POST (resource created)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **500**: Internal Server Error

### **4. Environment Configuration**

#### **Development Environment**
```env
NODE_ENV=development
PORT=8080
MONGODB_URL=mongodb://localhost:27017/visualeyes-dev
JWT_SECRET=dev-secret-key
JWT_EXPIRE=24h
```

#### **Production Environment**
```env
NODE_ENV=production
PORT=8080
MONGODB_URL=mongodb://production-cluster/visualeyes
JWT_SECRET=complex-production-secret
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
```

## 🚀 Scaling Considerations

### **1. Performance Optimization**

#### **Database Optimization**
- **Connection Pooling**: Mongoose handles connection pooling automatically
- **Query Optimization**: Use proper indexes and lean queries
- **Aggregation Pipelines**: For complex data processing
- **Pagination**: Implement cursor-based pagination for large datasets

#### **API Optimization**
```javascript
// Response compression
app.use(compression());

// Request size limits
app.use(express.json({ limit: '10mb' }));

// Trust proxy for load balancers
app.set('trust proxy', 1);
```

### **2. Horizontal Scaling**

#### **Stateless Design**
- **JWT Tokens**: No server-side session storage
- **Database State**: All state stored in MongoDB
- **File Storage**: Ready for cloud storage integration (AWS S3, etc.)

#### **Load Balancing Ready**
```javascript
// CORS configuration for multiple origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://production-domain.com"
];
```

### **3. Monitoring & Logging**

#### **Request Logging**
```javascript
// Morgan logging in combined format
app.use(morgan('combined'));
// Logs: IP, timestamp, method, URL, status, response time
```

#### **Error Tracking**
```javascript
// Comprehensive error logging
console.error('Unhandled error:', err);
// In production: integrate with services like Sentry, LogRocket
```

## 🔧 Development Tools & Scripts

### **Package.json Scripts**
```json
{
  "scripts": {
    "start": "nodemon index.js",      // Development with auto-reload
    "dev": "nodemon index.js",        // Alias for start
    "setup": "node scripts/setup.js", // Initial setup script
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### **Development Dependencies**
```json
{
  "dependencies": {
    "express": "^5.2.1",           // Web framework
    "mongoose": "^9.1.4",          // MongoDB ODM
    "jsonwebtoken": "^9.0.3",      // JWT authentication
    "bcryptjs": "^2.4.3",          // Password hashing
    "helmet": "^8.1.0",            // Security headers
    "cors": "^2.8.5",              // Cross-origin requests
    "express-rate-limit": "^8.2.1", // Rate limiting
    "express-mongo-sanitize": "^2.2.0", // NoSQL injection prevention
    "hpp": "^0.2.3",               // HTTP Parameter Pollution
    "compression": "^1.8.1",       // Response compression
    "morgan": "^1.10.1",           // HTTP request logger
    "dotenv": "^17.2.3",           // Environment variables
    "cookie-parser": "^1.4.7"      // Cookie parsing
  }
}
```

## 🎯 Next Steps for Development

### **Phase 1: Core Features (Current)**
- ✅ Authentication system (User + Customer)
- ✅ Basic CRUD operations
- ✅ Security middleware
- 🔄 Order management system
- 🔄 Workflow tracking

### **Phase 2: Advanced Features**
- 📋 Real-time notifications
- 📋 File upload handling
- 📋 Advanced reporting
- 📋 Email integration
- 📋 WhatsApp integration

### **Phase 3: Enterprise Features**
- 📋 Multi-tenant architecture
- 📋 Advanced analytics
- 📋 Mobile API
- 📋 Third-party integrations
- 📋 Automated testing suite

This development guide provides the foundation for building a scalable, maintainable, and secure ERP system for the lens manufacturing industry.