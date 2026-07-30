# Wholesaler Settings — Frontend Integration Guide

## Overview

Add a **Settings** button inside every wholesaler's dashboard. Clicking it opens a Settings page with tabs for each section below. Each section lets the logged-in wholesaler **create**, **view**, **edit**, and **delete** their own master data.

All APIs are tenant-scoped — data is isolated per wholesaler automatically via the auth token.

**Base URL:** `/api/dropdown`  
**Auth:** Bearer token required on every request (`Authorization: Bearer <accessToken>`)

---

## UI Structure

```
Dashboard
└── Settings (button/icon in sidebar or top-right)
    └── Settings Page (tabbed layout)
        ├── Plants
        ├── Labs
        ├── Fitting Centers
        ├── Courier Names
        ├── Brands
        ├── Categories
        └── Specific Labs
```

Each tab renders a list of items with **Add**, **Edit**, and **Delete** controls.

---

## Generic Response Shape

**Success**
```json
{
  "success": true,
  "message": "...",
  "data": { }
}
```

**Error**
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_ERROR | VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR",
    "message": "Human readable message",
    "timestamp": "2026-07-30T00:00:00.000Z"
  }
}
```

---

## 1. Plants

**Purpose:** Manage the manufacturing plants associated with this wholesaler.

### Create
`POST /api/dropdown/plants`

Request body:
```json
{
  "name": "Plant A",
  "description": "Optional description"
}
```
Response `201`:
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Plant A",
    "description": "Optional description",
    "isActive": true,
    "tenantId": "TENANT001",
    "createdAt": "2026-07-30T00:00:00.000Z"
  }
}
```

### Get All
`GET /api/dropdown/plants`

Query params (optional):
- `isActive=true` — filter by active status

Response `200`: array of plant objects.

### Get By ID
`GET /api/dropdown/plants/:id`

### Update
`PUT /api/dropdown/plants/:id`

Request body (all fields optional):
```json
{
  "name": "Updated Plant",
  "description": "Updated description",
  "isActive": false
}
```

### Delete
`DELETE /api/dropdown/plants/:id`

---

## 2. Labs

**Purpose:** Manage lens labs this wholesaler works with.

### Create
`POST /api/dropdown/labs`

Request body:
```json
{
  "name": "Vision Lab",
  "description": "Optional description"
}
```
Response `201`: lab object.

### Get All
`GET /api/dropdown/labs`

Query params (optional): `isActive=true`

### Get By ID
`GET /api/dropdown/labs/:id`

### Update
`PUT /api/dropdown/labs/:id`

Request body (all fields optional):
```json
{
  "name": "Updated Lab",
  "description": "...",
  "isActive": true
}
```

### Delete
`DELETE /api/dropdown/labs/:id`

---

## 3. Fitting Centers

**Purpose:** Manage fitting center locations for this wholesaler.

### Create
`POST /api/dropdown/fitting-centers`

Request body:
```json
{
  "name": "Center North",
  "description": "Optional description"
}
```
Response `201`: fitting center object.

### Get All
`GET /api/dropdown/fitting-centers`

Query params (optional): `isActive=true`

### Get By ID
`GET /api/dropdown/fitting-centers/:id`

### Update
`PUT /api/dropdown/fitting-centers/:id`

Request body (all fields optional):
```json
{
  "name": "Updated Center",
  "description": "...",
  "isActive": true
}
```

### Delete
`DELETE /api/dropdown/fitting-centers/:id`

---

## 4. Courier Names

**Purpose:** Manage courier/delivery partners used by this wholesaler.

### Create
`POST /api/dropdown/courier-names`

Request body:
```json
{
  "name": "BlueDart",
  "description": "Optional description"
}
```
Response `201`: courier name object.

### Get All
`GET /api/dropdown/courier-names`

Query params (optional): `isActive=true`

### Get By ID
`GET /api/dropdown/courier-names/:id`

### Update
`PUT /api/dropdown/courier-names/:id`

Request body (all fields optional):
```json
{
  "name": "Updated Courier",
  "description": "...",
  "isActive": true
}
```

### Delete
`DELETE /api/dropdown/courier-names/:id`

---

## 5. Brands

**Purpose:** Manage lens/product brands sold by this wholesaler. Brand names are stored in uppercase.

### Create
`POST /api/dropdown/brands`

Request body:
```json
{
  "name": "Zeiss",
  "description": "Optional description"
}
```
Response `201`:
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
    "name": "ZEISS",
    "description": "Optional description",
    "isActive": true,
    "tenantId": "TENANT001",
    "createdAt": "2026-07-30T00:00:00.000Z"
  }
}
```

### Get All
`GET /api/dropdown/brands`

Query params (optional):
- `isActive=true`
- `includeCategories=true` — populates categories under each brand

Response `200`: array of brand objects.

### Get By ID
`GET /api/dropdown/brands/:id`

Response includes populated `categories` array.

### Update
`PUT /api/dropdown/brands/:id`

Request body (all fields optional):
```json
{
  "name": "Essilor",
  "description": "...",
  "isActive": true
}
```

### Delete
`DELETE /api/dropdown/brands/:id`

> **Note:** A brand cannot be deleted if it has associated categories. Delete or reassign categories first. Error response will indicate how many categories are blocking deletion.

---

## 6. Categories

**Purpose:** Manage product categories, each belonging to a brand.

### Create
`POST /api/dropdown/categories`

Request body:
```json
{
  "name": "Single Vision",
  "brand": "64f1a2b3c4d5e6f7a8b9c0d2",
  "description": "Optional description"
}
```

- `brand` — MongoDB `_id` of the brand (required)

Response `201`:
```json
{
  "success": true,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d3",
    "name": "Single Vision",
    "brand": {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "ZEISS"
    },
    "description": "Optional description",
    "isActive": true,
    "tenantId": "TENANT001",
    "createdAt": "2026-07-30T00:00:00.000Z"
  }
}
```

### Get All
`GET /api/dropdown/categories`

Query params (optional):
- `brand=<brandId>` — filter by brand
- `isActive=true`

Response `200`: array of category objects with populated brand name.

### Get By Brand
`GET /api/dropdown/categories/brand/:brandId`

Response `200`:
```json
{
  "success": true,
  "data": {
    "brand": "ZEISS",
    "categories": [
      { "_id": "...", "name": "Single Vision", "description": "..." }
    ]
  }
}
```

### Get By ID
`GET /api/dropdown/categories/:id`

### Update
`PUT /api/dropdown/categories/:id`

Request body (all fields optional):
```json
{
  "name": "Progressive",
  "brand": "64f1a2b3c4d5e6f7a8b9c0d2",
  "description": "...",
  "isActive": true
}
```

### Delete
`DELETE /api/dropdown/categories/:id`

---

## 7. Specific Labs

**Purpose:** Manage specific lab sub-entries (more granular than Labs).

### Create
`POST /api/dropdown/specific-labs`

Request body:
```json
{
  "name": "Vision Lab - Unit 2",
  "description": "Optional description"
}
```
Response `201`: specific lab object.

### Get All
`GET /api/dropdown/specific-labs`

Query params (optional): `isActive=true`

### Get By ID
`GET /api/dropdown/specific-labs/:id`

### Update
`PUT /api/dropdown/specific-labs/:id`

Request body (all fields optional):
```json
{
  "name": "Updated Specific Lab",
  "description": "...",
  "isActive": true
}
```

### Delete
`DELETE /api/dropdown/specific-labs/:id`

---

## Error Codes Reference

| Code | HTTP Status | When it happens |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Required field missing |
| `DUPLICATE_ERROR` | 409 | Item with same name already exists for this tenant |
| `NOT_FOUND` | 404 | Item with given ID not found |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Frontend Implementation Notes

1. **Load list on tab open** — call `GET` on mount, show a table/list.
2. **Add button** — opens a modal/drawer with the create form, calls `POST` on submit.
3. **Edit button per row** — opens the same modal pre-filled, calls `PUT` on submit.
4. **Delete button per row** — shows a confirmation dialog, calls `DELETE` on confirm.
5. **Toggle isActive** — can be done via `PUT` with just `{ "isActive": false }`.
6. **Categories tab** — requires a brand selector; load brands first via `GET /api/dropdown/brands`, then use selected brand `_id` as the `brand` field when creating a category. Use `GET /api/dropdown/categories/brand/:brandId` to filter the list by brand.
7. **Duplicate errors** — show the `error.message` from the response directly in the form as a field-level error.
