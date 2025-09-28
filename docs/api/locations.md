# Locations API

The Locations API provides endpoints for managing cinema locations, including geographic information, business hours, and amenities.

## Base URL
```
/api/locations
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get All Locations
Retrieve a paginated list of locations with filtering and sorting options.

**Endpoint**: `GET /api/locations`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin, User  

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max: 100) |
| sortBy | string | "city" | Sort field |
| sortOrder | string | "asc" | Sort order (asc/desc) |
| search | string | - | Search term |
| city | string | - | Filter by city |
| province | string | - | Filter by province |
| status | string | - | Filter by status (true/false) |
| country | string | - | Filter by country |
| hasCoordinates | string | - | Filter by GPS coordinates (true/false) |
| includeDeleted | string | "false" | Include deleted locations |

#### Response
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "address": "123 Main Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "status": true,
        "description": "Downtown cinema complex",
        "coordinates": {
          "latitude": 11.5564,
          "longitude": 104.9282
        },
        "businessHours": {
          "openTime": "09:00",
          "closeTime": "23:00",
          "isOpen24Hours": false
        },
        "contact": {
          "phone": "+855123456789",
          "email": "info@cinema.com"
        },
        "totalTheaters": 8,
        "totalSeats": 1200,
        "amenities": ["parking", "food_court", "wheelchair_access"],
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

### 2. Get Location by ID
Retrieve a specific location by its ID.

**Endpoint**: `GET /api/locations/:id`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Response
```json
{
  "success": true,
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "status": true,
      "description": "Downtown cinema complex with modern facilities",
      "coordinates": {
        "latitude": 11.5564,
        "longitude": 104.9282
      },
      "postalCode": "12201",
      "country": "Cambodia",
      "businessHours": {
        "openTime": "09:00",
        "closeTime": "23:00",
        "isOpen24Hours": false
      },
      "contact": {
        "phone": "+855123456789",
        "email": "info@cinema.com"
      },
      "totalTheaters": 8,
      "totalSeats": 1200,
      "amenities": ["parking", "food_court", "wheelchair_access", "3d_screens"],
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 3. Create Location
Create a new location.

**Endpoint**: `POST /api/locations`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "address": "123 Main Street",
  "city": "Phnom Penh",
  "province": "Phnom Penh",
  "status": true,
  "description": "Downtown cinema complex",
  "coordinates": {
    "latitude": 11.5564,
    "longitude": 104.9282
  },
  "postalCode": "12201",
  "country": "Cambodia",
  "businessHours": {
    "openTime": "09:00",
    "closeTime": "23:00",
    "isOpen24Hours": false
  },
  "contact": {
    "phone": "+855123456789",
    "email": "info@cinema.com"
  },
  "totalTheaters": 8,
  "totalSeats": 1200,
  "amenities": ["parking", "food_court", "wheelchair_access"]
}
```

#### Response
```json
{
  "success": true,
  "message": "Location created successfully",
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "status": true,
      "description": "Downtown cinema complex",
      "coordinates": {
        "latitude": 11.5564,
        "longitude": 104.9282
      },
      "businessHours": {
        "openTime": "09:00",
        "closeTime": "23:00",
        "isOpen24Hours": false
      },
      "contact": {
        "phone": "+855123456789",
        "email": "info@cinema.com"
      },
      "totalTheaters": 8,
      "totalSeats": 1200,
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 4. Update Location
Update an existing location's information.

**Endpoint**: `PUT /api/locations/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "description": "Updated downtown cinema complex with IMAX",
  "totalTheaters": 10,
  "totalSeats": 1500,
  "amenities": ["parking", "food_court", "wheelchair_access", "imax", "3d_screens"]
}
```

#### Response
```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "description": "Updated downtown cinema complex with IMAX",
      "totalTheaters": 10,
      "totalSeats": 1500,
      "amenities": ["parking", "food_court", "wheelchair_access", "imax", "3d_screens"],
      "updatedAt": "2025-09-28T09:15:00.000Z"
    }
  }
}
```

### 5. Update Location Status
Update a location's operational status.

**Endpoint**: `PUT /api/locations/:id/status`  
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
  "message": "Location status updated successfully",
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "status": false,
      "updatedAt": "2025-09-28T09:20:00.000Z"
    }
  }
}
```

### 6. Update Location Coordinates
Update a location's GPS coordinates.

**Endpoint**: `PUT /api/locations/:id/coordinates`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "latitude": 11.5564,
  "longitude": 104.9282
}
```

#### Response
```json
{
  "success": true,
  "message": "Location coordinates updated successfully",
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "coordinates": {
        "latitude": 11.5564,
        "longitude": 104.9282
      },
      "updatedAt": "2025-09-28T09:25:00.000Z"
    }
  }
}
```

### 7. Get Active Locations
Retrieve all active locations.

**Endpoint**: `GET /api/locations/active`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| city | string | Filter by city |
| province | string | Filter by province |
| limit | number | Maximum results (default: 50) |

#### Response
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "address": "123 Main Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "status": true,
        "totalTheaters": 8,
        "totalSeats": 1200
      }
    ],
    "count": 15,
    "filters": {
      "city": null,
      "province": null
    }
  }
}
```

### 8. Get Locations by City
Retrieve locations filtered by city.

**Endpoint**: `GET /api/locations/city/:city`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| city | string | City name |

#### Response
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "address": "123 Main Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "status": true,
        "totalTheaters": 8
      }
    ],
    "city": "Phnom Penh",
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 3,
      "limit": 10
    }
  }
}
```

### 9. Get Locations by Province
Retrieve locations filtered by province.

**Endpoint**: `GET /api/locations/province/:province`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| province | string | Province name |

#### Response
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "address": "123 Main Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "status": true,
        "totalTheaters": 8
      }
    ],
    "province": "Phnom Penh",
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 12,
      "limit": 10
    }
  }
}
```

### 10. Soft Delete Location
Deactivate a location (soft delete).

**Endpoint**: `DELETE /api/locations/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Location deactivated successfully",
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "status": false,
      "deletedAt": "2025-09-28T09:30:00.000Z",
      "deletedBy": "507f1f77bcf86cd799439012"
    }
  }
}
```

### 11. Restore Location
Restore a soft-deleted location.

**Endpoint**: `PUT /api/locations/:id/restore`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Location restored successfully",
  "data": {
    "location": {
      "_id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "status": true,
      "deletedAt": null,
      "restoredAt": "2025-09-28T09:35:00.000Z",
      "restoredBy": "507f1f77bcf86cd799439012"
    }
  }
}
```

### 12. Force Delete Location
Permanently delete a location.

**Endpoint**: `DELETE /api/locations/:id/force-delete`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Location permanently deleted",
  "data": {
    "deletedLocation": {
      "id": "507f1f77bcf86cd799439011",
      "address": "123 Main Street",
      "city": "Phnom Penh",
      "province": "Phnom Penh",
      "country": "Cambodia"
    },
    "warning": "This action is irreversible"
  }
}
```

### 13. Get Location Statistics
Get comprehensive location statistics.

**Endpoint**: `GET /api/locations/stats`  
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
    "enabled": 40,
    "disabled": 5,
    "withCoordinates": 35,
    "topProvinces": [
      {"_id": "Phnom Penh", "count": 15},
      {"_id": "Siem Reap", "count": 8},
      {"_id": "Battambang", "count": 5}
    ],
    "topCities": [
      {"_id": "Phnom Penh", "count": 15},
      {"_id": "Siem Reap", "count": 8},
      {"_id": "Battambang", "count": 5}
    ],
    "percentageActive": 90,
    "percentageEnabled": 89,
    "percentageWithCoordinates": 78
  }
}
```

### 14. Get Deleted Locations
Retrieve all soft-deleted locations.

**Endpoint**: `GET /api/locations/deleted`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "address": "123 Old Street",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "deletedAt": "2025-09-28T09:30:00.000Z",
        "deletedBy": "507f1f77bcf86cd799439012",
        "deleteInfo": {
          "deletedAt": "2025-09-28T09:30:00.000Z",
          "deletedBy": "507f1f77bcf86cd799439012",
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
    "Address is required",
    "City must be at least 2 characters",
    "Latitude must be between -90 and 90"
  ]
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Location with this address, city, and province already exists"
}
```

## Data Validation

### Address Requirements
- Minimum length: 5 characters
- Maximum length: 200 characters
- Required field

### City/Province Requirements
- Minimum length: 2 characters
- Maximum length: 50 characters
- Automatically capitalized
- Required fields

### Coordinates Validation
- Latitude: -90 to 90
- Longitude: -180 to 180
- Optional field

### Business Hours Format
- Time format: HH:MM (24-hour format)
- Pattern: `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/`
- If `isOpen24Hours` is true, open/close times are ignored

### Contact Validation
- Phone: International format `/^(\+?[1-9]\d{1,14})?$/`
- Email: Valid email format
- Both optional

### Numeric Fields
- `totalTheaters`: Non-negative integer
- `totalSeats`: Non-negative integer

## Business Rules

1. **Unique Locations**: Each location must be unique by address, city, and province combination
2. **Status Logic**: 
   - Soft delete sets `status` to `false`
   - Restore sets `status` to `true`
3. **Business Hours**: 24-hour locations ignore specific open/close times
4. **Geographic Data**: Coordinates are optional but recommended for mapping features

## Virtual Fields

### Full Address
Computed field combining address, city, province, and country:
```
"123 Main Street, Phnom Penh, Phnom Penh, Cambodia"
```

### Display Name
Short identifier for the location:
```
"Phnom Penh - 123 Main Street"
```

### Business Hours Display
Formatted business hours:
```
"09:00 - 23:00" or "24 Hours" or "Hours not specified"
```

---

**Last Updated**: September 28, 2025  
**Version**: 1.0.0