# Theaters API

The Theaters API provides endpoints for managing movie theaters, including their relationships with locations, screens, capacity management, and operational status.

## Base URL
```
/api/theaters
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get All Theaters
Retrieve a paginated list of theaters with filtering and sorting options.

**Endpoint**: `GET /api/theaters`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin, User  

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max: 100) |
| sortBy | string | "name" | Sort field |
| sortOrder | string | "asc" | Sort order (asc/desc) |
| search | string | - | Search term |
| location_id | string | - | Filter by location ID |
| status | string | - | Filter by status (true/false) |
| includeDeleted | string | "false" | Include deleted theaters |
| hasScreens | string | - | Filter by having screens (true/false) |
| minCapacity | number | - | Minimum capacity filter |
| maxCapacity | number | - | Maximum capacity filter |
| amenities | string/array | - | Filter by amenities |
| dateFrom | date | - | Filter by creation date from |
| dateTo | date | - | Filter by creation date to |

#### Response
```json
{
  "success": true,
  "data": {
    "theaters": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Cineplex Downtown",
        "location_id": {
          "_id": "507f1f77bcf86cd799439012",
          "address": "123 Main Street",
          "city": "Phnom Penh",
          "province": "Phnom Penh"
        },
        "screens_id": [
          {
            "_id": "507f1f77bcf86cd799439013",
            "name": "Screen 1",
            "type": "standard",
            "capacity": 150
          }
        ],
        "status": true,
        "description": "Premium theater with modern amenities",
        "capacity": 1200,
        "totalScreens": 8,
        "amenities": ["dolby_atmos", "imax", "luxury_seating"],
        "operatingHours": {
          "openTime": "09:00",
          "closeTime": "23:00",
          "isOpen24Hours": false
        },
        "contact": {
          "phone": "+855123456789",
          "email": "info@cineplex.com"
        },
        "createdAt": "2025-09-28T09:00:00.000Z",
        "updatedAt": "2025-09-28T09:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 25,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Get Theater by ID
Retrieve a specific theater by its ID.

**Endpoint**: `GET /api/theaters/:id`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Response
```json
{
  "success": true,
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "location_id": {
        "_id": "507f1f77bcf86cd799439012",
        "address": "123 Main Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "businessHours": {
          "openTime": "09:00",
          "closeTime": "23:00"
        }
      },
      "screens_id": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "name": "Screen 1",
          "type": "standard",
          "capacity": 150,
          "status": true
        },
        {
          "_id": "507f1f77bcf86cd799439014",
          "name": "Screen 2",
          "type": "imax",
          "capacity": 200,
          "status": true
        }
      ],
      "status": true,
      "description": "Premium theater with modern amenities",
      "capacity": 1200,
      "totalScreens": 8,
      "amenities": ["dolby_atmos", "imax", "luxury_seating"],
      "operatingHours": {
        "openTime": "09:00",
        "closeTime": "23:00",
        "isOpen24Hours": false
      },
      "contact": {
        "phone": "+855123456789",
        "email": "info@cineplex.com"
      },
      "createdBy": {
        "_id": "507f1f77bcf86cd799439015",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 3. Create Theater
Create a new theater.

**Endpoint**: `POST /api/theaters`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "name": "Cineplex Downtown",
  "location_id": "507f1f77bcf86cd799439012",
  "screens_id": [
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014"
  ],
  "status": true,
  "description": "Premium theater with modern amenities",
  "capacity": 1200,
  "totalScreens": 8,
  "amenities": ["dolby_atmos", "imax", "luxury_seating"],
  "operatingHours": {
    "openTime": "09:00",
    "closeTime": "23:00",
    "isOpen24Hours": false
  },
  "contact": {
    "phone": "+855123456789",
    "email": "info@cineplex.com"
  }
}
```

#### Response
```json
{
  "success": true,
  "message": "Theater created successfully",
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "location_id": {
        "_id": "507f1f77bcf86cd799439012",
        "address": "123 Main Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh"
      },
      "screens_id": [
        "507f1f77bcf86cd799439013",
        "507f1f77bcf86cd799439014"
      ],
      "status": true,
      "description": "Premium theater with modern amenities",
      "capacity": 1200,
      "totalScreens": 8,
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 4. Update Theater
Update an existing theater's information.

**Endpoint**: `PUT /api/theaters/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "description": "Updated premium theater with IMAX and Dolby Atmos",
  "capacity": 1500,
  "totalScreens": 10,
  "amenities": ["dolby_atmos", "imax", "luxury_seating", "4dx"]
}
```

#### Response
```json
{
  "success": true,
  "message": "Theater updated successfully",
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "description": "Updated premium theater with IMAX and Dolby Atmos",
      "capacity": 1500,
      "totalScreens": 10,
      "amenities": ["dolby_atmos", "imax", "luxury_seating", "4dx"],
      "updatedAt": "2025-09-28T09:15:00.000Z"
    }
  }
}
```

### 5. Update Theater Status
Update a theater's operational status.

**Endpoint**: `PUT /api/theaters/:id/status`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "status": false
}
```

#### Response
```json
{
  "success": true,
  "message": "Theater status updated successfully",
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "status": false,
      "updatedAt": "2025-09-28T09:20:00.000Z"
    }
  }
}
```

### 6. Update Theater Capacity
Update a theater's total capacity.

**Endpoint**: `PUT /api/theaters/:id/capacity`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "capacity": 1800
}
```

#### Response
```json
{
  "success": true,
  "message": "Theater capacity updated successfully",
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "capacity": 1800,
      "updatedAt": "2025-09-28T09:25:00.000Z"
    }
  }
}
```

### 7. Get Active Theaters
Retrieve all active theaters.

**Endpoint**: `GET /api/theaters/active`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| location_id | string | Filter by location ID |
| limit | number | Maximum results (default: 50) |

#### Response
```json
{
  "success": true,
  "data": {
    "theaters": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Cineplex Downtown",
        "location_id": {
          "_id": "507f1f77bcf86cd799439012",
          "address": "123 Main Street",
          "city": "Phnom Penh",
          "province": "Phnom Penh"
        },
        "status": true,
        "capacity": 1200,
        "totalScreens": 8
      }
    ],
    "count": 15,
    "filters": {
      "location_id": null
    }
  }
}
```

### 8. Get Theaters by Location
Retrieve theaters filtered by location.

**Endpoint**: `GET /api/theaters/location/:locationId`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| locationId | string | Location ID |

#### Response
```json
{
  "success": true,
  "data": {
    "theaters": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Cineplex Downtown",
        "location_id": {
          "_id": "507f1f77bcf86cd799439012",
          "address": "123 Main Street",
          "city": "Phnom Penh"
        },
        "status": true,
        "capacity": 1200,
        "totalScreens": 8
      }
    ],
    "location_id": "507f1f77bcf86cd799439012",
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 3,
      "limit": 10
    }
  }
}
```

### 9. Soft Delete Theater
Deactivate a theater (soft delete).

**Endpoint**: `DELETE /api/theaters/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Theater deactivated successfully",
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "location_id": "507f1f77bcf86cd799439012",
      "status": false,
      "deletedAt": "2025-09-28T09:30:00.000Z",
      "deletedBy": "507f1f77bcf86cd799439015"
    }
  }
}
```

### 10. Restore Theater
Restore a soft-deleted theater.

**Endpoint**: `PUT /api/theaters/:id/restore`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Theater restored successfully",
  "data": {
    "theater": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "location_id": "507f1f77bcf86cd799439012",
      "status": true,
      "deletedAt": null,
      "restoredAt": "2025-09-28T09:35:00.000Z",
      "restoredBy": "507f1f77bcf86cd799439015"
    }
  }
}
```

### 11. Force Delete Theater
Permanently delete a theater.

**Endpoint**: `DELETE /api/theaters/:id/force-delete`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Theater permanently deleted",
  "data": {
    "deletedTheater": {
      "id": "507f1f77bcf86cd799439011",
      "name": "Cineplex Downtown",
      "location_id": "507f1f77bcf86cd799439012",
      "description": "Premium theater with modern amenities"
    },
    "warning": "This action is irreversible"
  }
}
```

### 12. Get Theater Statistics
Get comprehensive theater statistics.

**Endpoint**: `GET /api/theaters/stats`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "total": 50,
    "active": 45,
    "deleted": 5,
    "disabled": 3,
    "percentageActive": 90,
    "topLocations": [
      {"_id": "507f1f77bcf86cd799439012", "name": "Phnom Penh", "count": 15},
      {"_id": "507f1f77bcf86cd799439013", "name": "Siem Reap", "count": 8},
      {"_id": "507f1f77bcf86cd799439014", "name": "Battambang", "count": 5}
    ],
    "capacityStats": {
      "averageCapacity": 850,
      "totalCapacity": 42500,
      "maxCapacity": 2000,
      "minCapacity": 100
    }
  }
}
```

### 13. Get Deleted Theaters
Retrieve all soft-deleted theaters.

**Endpoint**: `GET /api/theaters/deleted`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "theaters": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Old Cinema",
        "location_id": {
          "_id": "507f1f77bcf86cd799439012",
          "address": "456 Old Street",
          "city": "Phnom Penh"
        },
        "deletedAt": "2025-09-28T09:30:00.000Z",
        "deletedBy": {
          "_id": "507f1f77bcf86cd799439015",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "deleteInfo": {
          "deletedAt": "2025-09-28T09:30:00.000Z",
          "deletedBy": "507f1f77bcf86cd799439015",
          "daysSinceDeleted": 1
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 5,
      "limit": 10
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    "Theater name is required",
    "Location ID is required",
    "Capacity cannot be negative"
  ]
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "A theater with this name already exists at this location"
}
```

## Data Validation

### Theater Name Requirements
- Minimum length: 2 characters
- Maximum length: 100 characters
- Required field
- Auto-capitalized

### Location Requirements
- Valid MongoDB ObjectId format
- Location must exist
- Required field

### Screen Management
- Array of valid MongoDB ObjectId references
- Optional field
- Automatically updates `totalScreens` count

### Capacity Validation
- Non-negative integer
- Minimum: 0
- Optional field with default 0

### Amenities
Valid amenity types:
- `dolby_atmos`
- `imax`
- `3d_capable`
- `4dx`
- `luxury_seating`
- `recliner_seats`
- `food_service`
- `wheelchair_accessible`
- `parking`
- `valet_parking`
- `air_conditioning`
- `heating`

### Operating Hours Format
- Time format: HH:MM (24-hour format)
- Pattern: `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/`
- If `isOpen24Hours` is true, specific times are ignored

### Contact Validation
- Phone: International format `/^(\+?[1-9]\d{1,14})?$/`
- Email: Valid email format
- Both optional

## Business Rules

1. **Unique Names**: Each theater name must be unique within a location
2. **Status Logic**: 
   - Soft delete sets `status` to `false`
   - Restore sets `status` to `true`
3. **Screen Management**: Adding/removing screens automatically updates `totalScreens`
4. **Capacity Calculation**: Can be manually set or auto-calculated from screens
5. **Location Dependency**: Theater must belong to an existing location

## Virtual Fields

### Display Name
Simple display identifier:
```
"Cineplex Downtown"
```

### Operating Hours Display
Formatted operating hours:
```
"09:00 - 23:00" or "24 Hours" or "Hours not specified"
```

### Delete Info
Information about deletion (when applicable):
```json
{
  "deletedAt": "2025-09-28T09:30:00.000Z",
  "deletedBy": "507f1f77bcf86cd799439015",
  "daysSinceDeleted": 1
}
```

---

**Last Updated**: September 28, 2025  
**Version**: 1.0.0