# Order Product Fields API

**Base URL:** `/api/order`
**Auth:** Bearer token required on all endpoints

All DigiProduct-based endpoints are tenant-scoped — data is filtered by the logged-in user's `tenantId` automatically.

---

## 1. Get Tint Options

`GET /api/order/product/get-tint`

Returns all available tint options (global — same for all tenants).

**Response `200`:**
```json
{
  "success": true,
  "message": "Tint options retrieved successfully",
  "data": [
    { "_id": "...", "name": "Blue Tint" },
    { "_id": "...", "name": "Green Tint" }
  ]
}
```

---

## 2. Get Frame Types

`GET /api/order/product/get-frame-types`

Returns all frame types (global — same for all tenants).

**Response `200`:**
```json
{
  "success": true,
  "message": "Frame types retrieved successfully",
  "data": [
    { "_id": "...", "name": "Full Frame" },
    { "_id": "...", "name": "Rimless" }
  ]
}
```

---

## 3. Get Product Brands

`GET /api/order/product-fields/brand`

Returns distinct product brands from DigiProduct for the logged-in tenant.

**Response `200`:**
```json
{
  "success": true,
  "message": "Product brands retrieved successfully",
  "data": [
    { "_id": "...", "name": "ZEISS" },
    { "_id": "...", "name": "ESSILOR" }
  ]
}
```

---

## 4. Get Product Categories

`GET /api/order/product-fields/category`

Returns distinct product categories from DigiProduct for the logged-in tenant.

**Query params (optional):**
| Param | Type | Description |
|---|---|---|
| `brand` | string | Filter categories by brand name |

**Examples:**
```
GET /api/order/product-fields/category
GET /api/order/product-fields/category?brand=ZEISS
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Product categories retrieved successfully",
  "data": [
    { "_id": "...", "name": "SINGLE VISION" },
    { "_id": "...", "name": "PROGRESSIVE" }
  ]
}
```

---

## 5. Get Product Treatments

`GET /api/order/product-fields/treatment`

Returns all product treatments (global — same for all tenants).

**Response `200`:**
```json
{
  "success": true,
  "message": "Product treatments retrieved successfully",
  "data": [
    { "_id": "...", "name": "Anti Reflective" },
    { "_id": "...", "name": "Blue Cut" }
  ]
}
```

---

## 6. Get Product Indexes

`GET /api/order/product-fields/index`

Returns distinct lens index values from DigiProduct for the logged-in tenant, sorted numerically.

**Response `200`:**
```json
{
  "success": true,
  "message": "Product indexes retrieved successfully",
  "data": [
    { "_id": "...", "value": 1.5 },
    { "_id": "...", "value": 1.6 },
    { "_id": "...", "value": 1.67 }
  ]
}
```

---

## 7. Get Product Types

`GET /api/order/product-fields/productType`

Returns all product types (global — same for all tenants).

**Response `200`:**
```json
{
  "success": true,
  "message": "Product types retrieved successfully",
  "data": [
    { "_id": "...", "name": "Lens" },
    { "_id": "...", "name": "Frame" }
  ]
}
```

---

## 8. Get Product Coatings

`GET /api/order/product-fields/coating`

Returns distinct coating values from DigiProduct for the logged-in tenant.

**Query params (optional):**
| Param | Type | Description |
|---|---|---|
| `brand` | string | Filter by brand name |
| `category` | string | Filter by category name |

**Examples:**
```
GET /api/order/product-fields/coating
GET /api/order/product-fields/coating?brand=ZEISS
GET /api/order/product-fields/coating?brand=ZEISS&category=PROGRESSIVE
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Product coatings retrieved successfully",
  "data": [
    { "_id": "...", "name": "HMC" },
    { "_id": "...", "name": "SHMC" }
  ]
}
```

---

## 9. Get Product Names

`GET /api/order/product-names`

Returns paginated product records from DigiProduct for the logged-in tenant.

**Query params (optional):**
| Param | Type | Default | Description |
|---|---|---|---|
| `search` | string | `""` | Search within product name |
| `brand` | string | — | Filter by brand name |
| `category` | string | — | Filter by category name |
| `page` | number | `1` | Page number |
| `limit` | number | `100` | Results per page |

**Examples:**
```
GET /api/order/product-names
GET /api/order/product-names?search=prime&brand=ZEISS&page=1&limit=50
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Product names retrieved successfully",
  "data": {
    "data": [
      {
        "_id": "...",
        "productName": "ZEISS PRIME 1.6",
        "brand": "ZEISS",
        "category": "SINGLE VISION",
        "coating": "HMC",
        "price": 1200,
        "mrp": 1500,
        "gst": 12,
        "qty": 50
      }
    ],
    "pagination": {
      "total": 120,
      "page": 1,
      "limit": 50,
      "totalPages": 3
    }
  }
}
```

---

## Tenant Scope Summary

| Endpoint | Tenant-scoped |
|---|---|
| `/product/get-tint` | No (global) |
| `/product/get-frame-types` | No (global) |
| `/product-fields/brand` | Yes |
| `/product-fields/category` | Yes |
| `/product-fields/treatment` | No (global) |
| `/product-fields/index` | Yes |
| `/product-fields/productType` | No (global) |
| `/product-fields/coating` | Yes |
| `/product-names` | Yes |
