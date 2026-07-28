# Tenant Management API Documentation

## Overview

The **Tenant Module** is the foundation of the multi-tenant SaaS architecture of this platform. Each wholesaler onboarded onto the system is treated as an independent **tenant**. Every tenant has its own completely isolated data — including products, customers, orders, employees, settings, brands, categories, and all other resources.

These APIs are exclusively available to the **Platform Owner** and are used to manage the full lifecycle of wholesaler registrations — from onboarding a new wholesaler to suspending, activating, or permanently deleting their workspace.

---

## Authentication

All Tenant APIs require a valid **Platform Owner JWT token**.

```
Authorization: Bearer <PLATFORM_OWNER_TOKEN>
```

To obtain this token, login using the standard employee login API with a `PLATFORM_OWNER` role account:

```
POST /api/employee/auth/login
```

---

## Tenant Lifecycle

```
Registration → ACTIVE → SUSPENDED → ACTIVE → Deleted
```

| Status | Description |
|---|---|
| `ACTIVE` | Tenant is fully operational. All employees and customers can login and access the system. |
| `SUSPENDED` | Tenant is blocked. No employee or customer can login or use any API. Returns `403 TENANT_SUSPENDED`. |

### What happens at each stage

**On Registration:**
- A new `Tenant` document is created with a unique `tenantId` (e.g. `TEN-DIGOPT-A3X7K`).
- A `SUPERADMIN` employee is automatically created using the `ownerName`, `email`, `mobile`, and `password` provided.
- The SUPERADMIN gets `pageAccess` and `accessPermissions` based on the selected `planType`.
- Tenant status is set to `ACTIVE` immediately.

**On Update:**
- Only tenant-level fields (store info, owner info, loyalty, documents, subscription, WhatsApp config) are updated.
- The SUPERADMIN employee record is NOT automatically updated.

**On Suspend:**
- Tenant `status` is set to `SUSPENDED`.
- `subscription.isActive` is set to `false`.
- All logins by employees and customers of this tenant are immediately blocked with `403 TENANT_SUSPENDED`.

**On Activate:**
- Tenant `status` is set back to `ACTIVE`.
- `subscription.isActive` is set to `true`.
- All employees and customers can login and use the system again.

**On Delete:**
- The tenant document is permanently deleted.
- All employee records with the matching `tenantId` are also permanently deleted.
- This action is irreversible.

---

## Base URL

```
{{ApiBaseUrl}}/api/tenants
```

---

## APIs

---

### 1. Register Tenant

**POST** `/api/tenants/register`

Registers a new wholesaler as a tenant on the platform. Automatically creates a `SUPERADMIN` employee account for the wholesaler using the provided owner details.

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |
| `Content-Type` | `application/json` |

#### Request Payload

```json
{
  "storeName": "DigiOptics Wholesale",
  "address": "WeWork Eldeco Centre, Block A, Malviya Nagar, New Delhi 110017",
  "storeTiming": "9:00 AM - 9:00 PM",
  "commissionPercentage": 5,
  "expiryDate": "2027-12-31",
  "emailApi": "SG.xxxxxxxxxxxxxxxxxxxx",
  "showAds": false,
  "hasGST": true,
  "hasAI": false,
  "ownerName": "Anish Singh Rawat",
  "email": "anish@digioptics.com",
  "mobile": "9876543210",
  "password": "Admin@1234",
  "rsPerPoint": 1,
  "pointValue": 0.5,
  "referPoints": 50,
  "storeLogo": "https://storage.googleapis.com/bucket/logos/logo.png",
  "gstCertificate": "https://storage.googleapis.com/bucket/documents/gst.pdf",
  "panCard": "https://storage.googleapis.com/bucket/documents/pan.jpg",
  "aadhaarCard": null,
  "planType": "PRO",
  "selectedPages": [],
  "autoPermissions": [],
  "utilityProvider": "META",
  "promotionProvider": "NON_META"
}
```

#### Field Descriptions

**Store Information**

| Field | Type | Required | Description |
|---|---|---|---|
| `storeName` | String | ✅ | Name of the wholesaler's store |
| `address` | String | ✅ | Physical address of the store |
| `storeTiming` | String | ✅ | Business hours e.g. `"9:00 AM - 9:00 PM"` |
| `commissionPercentage` | Number | ✅ | Platform commission percentage (0–100) |
| `expiryDate` | String (ISO Date) | ✅ | Subscription expiry date. Must be a future date |
| `emailApi` | String | ❌ | Email service API key (e.g. SendGrid) |
| `showAds` | Boolean | ❌ | Whether to show ads in the wholesaler's portal. Default: `false` |
| `hasGST` | Boolean | ❌ | Whether the store is GST registered. Default: `false` |
| `hasAI` | Boolean | ❌ | Whether AI features are enabled. Default: `false` |
| `storeLogo` | String (URL) | ❌ | URL of the store logo image |

**Owner & Login Details**

| Field | Type | Required | Description |
|---|---|---|---|
| `ownerName` | String | ✅ | Full name of the owner (used as SUPERADMIN employee name) |
| `email` | String | ✅ | Owner's email — used as SUPERADMIN login email |
| `mobile` | String | ✅ | Owner's mobile number |
| `password` | String | ✅ | SUPERADMIN login password |

**Loyalty & Referral**

| Field | Type | Required | Description |
|---|---|---|---|
| `rsPerPoint` | Number | ❌ | Rupees spent per loyalty point earned. Default: `0` |
| `pointValue` | Number | ❌ | Value of one loyalty point in rupees. Default: `0` |
| `referPoints` | Number | ❌ | Points awarded for referral. Default: `0` |

**Documents**

| Field | Type | Required | Description |
|---|---|---|---|
| `gstCertificate` | String (URL) | ✅* | URL of uploaded GST certificate |
| `panCard` | String (URL) | ✅* | URL of uploaded PAN card |
| `aadhaarCard` | String (URL) | ✅* | URL of uploaded Aadhaar card |

> ✅* At least one of `gstCertificate`, `panCard`, or `aadhaarCard` must be provided.

**Subscription**

| Field | Type | Required | Description |
|---|---|---|---|
| `planType` | String | ❌ | `PRO`, `PREMIUM`, or `CUSTOM`. Default: `PRO` |
| `selectedPages` | Array | ✅ if CUSTOM | Array of page keys to enable for CUSTOM plan |
| `autoPermissions` | Array | ❌ | Array of permission keys for CUSTOM plan |

> For `PRO`: all pages and permissions are automatically assigned.  
> For `PREMIUM`: a default set of pages is assigned, no permissions.  
> For `CUSTOM`: `selectedPages` is required.

**WhatsApp Configuration**

| Field | Type | Required | Description |
|---|---|---|---|
| `utilityProvider` | String | ❌ | `META` or `NON_META`. Default: `META` |
| `promotionProvider` | String | ❌ | `META` or `NON_META`. Default: `META` |

#### Success Response `201`

```json
{
  "success": true,
  "message": "Tenant \"DigiOptics Wholesale\" registered successfully with tenantId: TEN-DIGOPT-A3X7K",
  "data": {
    "tenant": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "tenantId": "TEN-DIGOPT-A3X7K",
      "storeInformation": {
        "storeName": "DigiOptics Wholesale",
        "address": "WeWork Eldeco Centre, Block A, Malviya Nagar, New Delhi 110017",
        "storeTiming": "9:00 AM - 9:00 PM",
        "commissionPercentage": 5,
        "expiryDate": "2027-12-31T00:00:00.000Z",
        "emailApi": "SG.xxxxxxxxxxxxxxxxxxxx",
        "showAds": false,
        "hasGST": true,
        "hasAI": false,
        "storeLogo": "https://storage.googleapis.com/bucket/logos/logo.png"
      },
      "owner": {
        "ownerName": "Anish Singh Rawat",
        "email": "anish@digioptics.com",
        "mobile": "9876543210"
      },
      "loyalty": {
        "rsPerPoint": 1,
        "pointValue": 0.5,
        "referPoints": 50
      },
      "documents": {
        "gstCertificate": "https://storage.googleapis.com/bucket/documents/gst.pdf",
        "panCard": "https://storage.googleapis.com/bucket/documents/pan.jpg",
        "aadhaarCard": null
      },
      "subscription": {
        "planType": "PRO",
        "expiresAt": "2027-12-31T00:00:00.000Z",
        "isActive": true,
        "selectedPages": ["DASHBOARD", "NEW_ORDER", "...all pages"],
        "autoPermissions": ["ADD_ORDER", "UPDATE_ORDER", "...all permissions"]
      },
      "whatsappConfig": {
        "utilityProvider": "META",
        "promotionProvider": "NON_META"
      },
      "status": "ACTIVE",
      "createdAt": "2026-07-28T08:00:00.000Z",
      "updatedAt": "2026-07-28T08:00:00.000Z"
    },
    "superAdmin": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "employeeName": "Anish Singh Rawat",
      "email": "anish@digioptics.com",
      "EmployeeType": "SUPERADMIN",
      "tenantId": "TEN-DIGOPT-A3X7K",
      "isActive": true
    }
  }
}
```

#### Error Responses

| Code | Error Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Required field missing or invalid |
| `409` | `TENANT_EXISTS` | Tenant with this email already exists |
| `409` | `EMPLOYEE_EXISTS` | Employee with this email already exists |
| `500` | `REGISTER_TENANT_ERROR` | Internal server error |

---

### 2. Get All Tenants

**GET** `/api/tenants`

Returns a paginated list of all registered tenants.

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |

#### Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `page` | Number | Page number. Default: `1` |
| `limit` | Number | Records per page. Default: `20`, Max: `100` |
| `status` | String | Filter by status: `ACTIVE`, `SUSPENDED` |
| `search` | String | Search by storeName, tenantId, email, or mobile |

#### Example Request

```
GET /api/tenants?page=1&limit=10&status=ACTIVE&search=digi
```

#### Success Response `200`

```json
{
  "success": true,
  "message": "Tenants retrieved successfully",
  "data": {
    "tenants": [
      {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "tenantId": "TEN-DIGOPT-A3X7K",
        "storeInformation": {
          "storeName": "DigiOptics Wholesale",
          "address": "New Delhi",
          "storeTiming": "9:00 AM - 9:00 PM",
          "commissionPercentage": 5,
          "expiryDate": "2027-12-31T00:00:00.000Z"
        },
        "owner": {
          "ownerName": "Anish Singh Rawat",
          "email": "anish@digioptics.com",
          "mobile": "9876543210"
        },
        "status": "ACTIVE",
        "createdAt": "2026-07-28T08:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalRecords": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

### 3. Get Tenant By ID

**GET** `/api/tenants/:id`

Returns complete details of a single tenant by MongoDB `_id`.

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |

#### URL Parameter

| Parameter | Description |
|---|---|
| `id` | MongoDB `_id` of the tenant |

#### Example Request

```
GET /api/tenants/64f1a2b3c4d5e6f7a8b9c0d1
```

#### Success Response `200`

```json
{
  "success": true,
  "data": {
    "tenant": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "tenantId": "TEN-DIGOPT-A3X7K",
      "storeInformation": { "...": "..." },
      "owner": { "...": "..." },
      "loyalty": { "...": "..." },
      "documents": { "...": "..." },
      "subscription": { "...": "..." },
      "whatsappConfig": { "...": "..." },
      "status": "ACTIVE",
      "createdAt": "2026-07-28T08:00:00.000Z",
      "updatedAt": "2026-07-28T08:00:00.000Z"
    }
  }
}
```

#### Error Responses

| Code | Error Code | Description |
|---|---|---|
| `404` | `NOT_FOUND` | Tenant not found |

---

### 4. Update Tenant

**PUT** `/api/tenants/:id`

Updates tenant information. Only the fields passed in the request body are updated. The SUPERADMIN employee record is not automatically updated.

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |
| `Content-Type` | `application/json` |

#### URL Parameter

| Parameter | Description |
|---|---|
| `id` | MongoDB `_id` of the tenant |

#### Request Payload

All fields are optional. Send only what needs to be updated.

```json
{
  "storeInformation": {
    "storeName": "DigiOptics Wholesale Pvt Ltd",
    "address": "New Address, Block B, New Delhi",
    "storeTiming": "8:00 AM - 10:00 PM",
    "commissionPercentage": 7,
    "expiryDate": "2028-12-31",
    "emailApi": "SG.new_api_key",
    "showAds": true,
    "hasGST": true,
    "hasAI": true,
    "storeLogo": "https://storage.googleapis.com/bucket/new-logo.png"
  },
  "owner": {
    "ownerName": "Anish Singh Rawat",
    "email": "anish.new@digioptics.com",
    "mobile": "9876543211"
  },
  "loyalty": {
    "rsPerPoint": 2,
    "pointValue": 1,
    "referPoints": 100
  },
  "documents": {
    "gstCertificate": "https://storage.googleapis.com/bucket/new-gst.pdf",
    "panCard": "https://storage.googleapis.com/bucket/new-pan.jpg",
    "aadhaarCard": "https://storage.googleapis.com/bucket/aadhaar.pdf"
  },
  "subscription": {
    "planType": "CUSTOM",
    "expiresAt": "2028-12-31",
    "isActive": true,
    "selectedPages": ["DASHBOARD", "NEW_ORDER", "ALL_ORDERS"],
    "autoPermissions": ["ADD_ORDER", "UPDATE_ORDER"]
  },
  "whatsappConfig": {
    "utilityProvider": "NON_META",
    "promotionProvider": "META"
  }
}
```

#### Success Response `200`

```json
{
  "success": true,
  "message": "Tenant updated successfully",
  "data": {
    "tenant": { "...updated tenant object..." }
  }
}
```

#### Error Responses

| Code | Error Code | Description |
|---|---|---|
| `404` | `NOT_FOUND` | Tenant not found |
| `500` | `UPDATE_TENANT_ERROR` | Internal server error |

---

### 5. Suspend Tenant

**PATCH** `/api/tenants/:id/suspend`

Suspends a tenant's workspace. Once suspended, all employees and customers of that tenant are immediately blocked from logging in or using any API.

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |
| `Content-Type` | `application/json` |

#### URL Parameter

| Parameter | Description |
|---|---|
| `id` | MongoDB `_id` of the tenant |

#### Request Payload

```json
{
  "reason": "Payment overdue for 30 days"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | String | ❌ | Reason for suspension |

#### Success Response `200`

```json
{
  "success": true,
  "message": "Tenant suspended successfully",
  "data": {
    "tenant": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "tenantId": "TEN-DIGOPT-A3X7K",
      "status": "SUSPENDED",
      "suspensionReason": "Payment overdue for 30 days",
      "subscription": {
        "isActive": false
      }
    }
  }
}
```

#### What happens after suspension

Any login attempt or API call by a tenant's employee or customer returns:

```json
{
  "success": false,
  "error": {
    "code": "TENANT_SUSPENDED",
    "message": "Your workspace has been suspended. Please contact support."
  }
}
```

---

### 6. Activate Tenant

**PATCH** `/api/tenants/:id/activate`

Reactivates a previously suspended tenant. All employees and customers regain full access immediately.

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |

#### URL Parameter

| Parameter | Description |
|---|---|
| `id` | MongoDB `_id` of the tenant |

#### Request Payload

No body required.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Tenant activated successfully",
  "data": {
    "tenant": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "tenantId": "TEN-DIGOPT-A3X7K",
      "status": "ACTIVE",
      "suspensionReason": null,
      "subscription": {
        "isActive": true
      }
    }
  }
}
```

---

### 7. Delete Tenant

**DELETE** `/api/tenants/:id`

Permanently deletes a tenant and all employee accounts associated with that tenant. **This action is irreversible.**

#### Request Headers

| Header | Value |
|---|---|
| `Authorization` | `Bearer <PLATFORM_OWNER_TOKEN>` |

#### URL Parameter

| Parameter | Description |
|---|---|
| `id` | MongoDB `_id` of the tenant |

#### Request Payload

No body required.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Tenant \"DigiOptics Wholesale\" and all associated employees deleted successfully",
  "data": null
}
```

#### Error Responses

| Code | Error Code | Description |
|---|---|---|
| `404` | `NOT_FOUND` | Tenant not found |
| `500` | `DELETE_TENANT_ERROR` | Internal server error |

> **Warning:** Deleting a tenant removes the tenant document and all `Employee` records where `tenantId` matches. Customer data, orders, products, and other business data are not automatically deleted and must be cleaned up separately if required.

---

## Available Page Keys

Used in `selectedPages` for `CUSTOM` plan:

```
DASHBOARD           REGISTER_CUSTOMER   REGISTER_STAFF
STAFF_LIST          CUSTOMER_LIST       SHIP_TO
APPROVALS           CORRECTIONS         NEW_ORDER
ALL_ORDERS          PENDING_ORDERS      OTHER_SALES
SALES_LIST          RETURN_REFUND       EXCHANGE_REQUESTS
DRAFTS              DAILY_REPORT        MAIN_REPORT
ADD_REPAIR          REPAIR_LIST         ADD_VENDOR
VENDOR_LIST         VENDOR_ORDER        QUALITY
FITTING             SHIPPING            INVENTORY
```

## Available Permission Keys

Used in `autoPermissions` for `CUSTOM` plan:

```
ADD_STAFF           UPDATE_STAFF        DELETE_STAFF
ADD_CUSTOMER        UPDATE_CUSTOMER     DELETE_CUSTOMER
ADD_ORDER           UPDATE_ORDER        DELETE_ORDER
APPROVE_ORDER       ADD_DRAFT           UPDATE_DRAFT
DELETE_DRAFT        ADD_REPAIR          UPDATE_REPAIR
DELETE_REPAIR       ADD_VENDOR          UPDATE_VENDOR
DELETE_VENDOR       UPDATE_QUALITY      UPDATE_FITTING
UPDATE_SHIPPING     UPDATE_INVENTORY    VIEW_REPORTS
EXPORT_REPORTS
```

---

## Plan Types Summary

| Plan | Pages | Permissions |
|---|---|---|
| `PRO` | All 27 pages automatically assigned | All 24 permissions automatically assigned |
| `PREMIUM` | Default 8 pages automatically assigned | None |
| `CUSTOM` | `selectedPages` array required | `autoPermissions` array optional |
