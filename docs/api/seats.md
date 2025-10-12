# Seats API

The Seats API provides endpoints for managing theater seats, including seat configuration, and status management.

## Base URL
```
/api/seats
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Seat Types
- `regular` - Regular seating
- `vip` - VIP seating with luxury amenities
- `couple` - A seat for two people
- `queen` - A large seat for two people

## Seat Statuses
- `active` - Seat is operational and available for booking
- `maintenance` - Seat is under maintenance
- `out_of_order` - Seat is broken or unusable
- `reserved` - Seat is temporarily reserved
- `closed` - The seat is not available for booking.

## Endpoints

### 1. Get All Seats
Retrieve a paginated list of seats with filtering and sorting options.

**Endpoint**: `GET /api/seats`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin, User  

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max: 100) |
| sortBy | string | "row" | Sort field (row, seat_number, seat_type, status, price) |
| sortOrder | string | "asc" | Sort order (asc/desc) |
| search | string | - | Search term |
| seat_type | string | - | Filter by seat type |
| status | string | - | Filter by status |
| includeDeleted | string | "false" | Include deleted seats |

#### Response
```json
{
  "success": true,
  "data": {
    "seats": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "row": "A",
        "seat_number": "1",
        "seat_type": "premium",
        "status": "active",
        "price": 15.99,
        "createdAt": "2025-09-28T09:00:00.000Z",
        "updatedAt": "2025-09-28T09:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 50,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Get Seat by ID
Retrieve a specific seat by its ID.

**Endpoint**: `GET /api/seats/:id`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Response
```json
{
  "success": true,
  "data": {
    "seat": {
      "_id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "seat_type": "premium",
      "status": "active",
      "price": 15.99,
      "notes": "Premium seat with extra legroom",
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 3. Create Seat
Create a new seat.

**Endpoint**: `POST /api/seats`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "row": "A",
  "seat_number": "1",
  "seat_type": "premium",
  "status": "active",
  "price": 15.99,
  "notes": "Premium seat with extra legroom"
}
```

#### Response
```json
{
  "success": true,
  "message": "Seat created successfully",
  "data": {
    "seat": {
      "_id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "seat_type": "premium",
      "status": "active",
      "price": 15.99,
      "notes": "Premium seat with extra legroom",
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 4. Update Seat
Update an existing seat's information.

**Endpoint**: `PUT /api/seats/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "seat_type": "vip",
  "price": 25.99,
  "notes": "Upgraded to VIP with reclining feature"
}
```

#### Response
```json
{
  "success": true,
  "message": "Seat updated successfully",
  "data": {
    "seat": {
      "_id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "seat_type": "vip",
      "status": "active",
      "price": 25.99,
      "notes": "Upgraded to VIP with reclining feature",
      "updatedAt": "2025-09-28T09:15:00.000Z"
    }
  }
}
```

### 5. Update Seat Status
Update a seat's operational status.

**Endpoint**: `PUT /api/seats/:id/status`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "status": "maintenance"
}
```

#### Response
```json
{
  "success": true,
  "message": "Seat status updated successfully",
  "data": {
    "seat": {
      "_id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "status": "maintenance",
      "updatedAt": "2025-09-28T09:20:00.000Z"
    }
  }
}
```

### 6. Get Seats by Type
Retrieve seats filtered by seat type.

**Endpoint**: `GET /api/seats/type/:type`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Seat type (regular, vip, couple, queen) |

#### Response
```json
{
  "success": true,
  "data": {
    "seats": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "row": "A",
        "seat_number": "1",
        "seat_type": "premium",
        "price": 15.99
      }
    ],
    "seatType": "premium",
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 15,
      "limit": 10
    }
  }
}
```

### 7. Soft Delete Seat
Deactivate a seat (soft delete).

**Endpoint**: `DELETE /api/seats/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Seat deactivated successfully",
  "data": {
    "seat": {
      "_id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "status": "closed",
      "deletedAt": "2025-09-28T09:25:00.000Z",
      "deletedBy": "507f1f77bcf86cd799439012"
    }
  }
}
```

### 8. Restore Seat
Restore a soft-deleted seat.

**Endpoint**: `PUT /api/seats/:id/restore`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Seat restored successfully",
  "data": {
    "seat": {
      "_id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "status": "active",
      "deletedAt": null,
      "restoredAt": "2025-09-28T09:30:00.000Z",
      "restoredBy": "507f1f77bcf86cd799439012"
    }
  }
}
```

### 9. Force Delete Seat
Permanently delete a seat.

**Endpoint**: `DELETE /api/seats/:id/force-delete`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "Seat permanently deleted",
  "data": {
    "deletedSeat": {
      "id": "507f1f77bcf86cd799439011",
      "row": "A",
      "seat_number": "1",
      "seat_type": "premium"
    },
    "warning": "This action is irreversible"
  }
}
```

### 10. Get Seat Statistics
Get comprehensive seat statistics.

**Endpoint**: `GET /api/seats/stats`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "total": 500,
    "active": 480,
    "deleted": 20,
    "seatTypes": {
      "regular": 300,
      "vip": 120,
      "couple": 50,
      "queen": 10
    },
    "statuses": {
      "active": 400,
      "maintenance": 50,
      "outOfOrder": 30,
      "reserved": 0
    },
    "percentageActive": 96
  }
}
```

### 11. Get Deleted Seats
Retrieve all soft-deleted seats.

**Endpoint**: `GET /api/seats/deleted`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "seats": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "row": "A",
        "seat_number": "1",
        "seat_type": "premium",
        "deletedAt": "2025-09-28T09:25:00.000Z",
        "deletedBy": "507f1f77bcf86cd799439012",
        "deleteInfo": {
          "deletedAt": "2025-09-28T09:25:00.000Z",
          "deletedBy": "507f1f77bcf86cd799439012",
          "daysSinceDeleted": 2
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 20,
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
    "Row is required",
    "Seat number must contain only letters and numbers"
  ]
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Seat with this row and seat number already exists"
}
```

## Data Validation

### Row Format
- Must start with a letter
- Can contain letters and numbers
- Maximum length: 5 characters
- Pattern: `/^[A-Z][A-Z0-9]*$/`
- Automatically converted to uppercase

### Seat Number Format
- Can contain letters and numbers
- Maximum length: 10 characters
- Pattern: `/^[A-Z0-9]+$/`
- Automatically converted to uppercase

### Price Validation
- Must be a positive number
- Minimum value: 0
- Precision: 2 decimal places

### Notes
- Maximum length: 500 characters
- Optional field

## Business Rules

1. **Unique Seats**: Each seat must be unique.
2. **Soft Delete**: Deleted seats are set to `closed` status.
3. **Restore Logic**: Restored seats are set to `active` status.

---

**Last Updated**: October 13, 2025  
**Version**: 2.0.0
