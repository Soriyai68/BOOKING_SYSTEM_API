# Users API

The Users API provides endpoints for managing user accounts, authentication, and user-related operations.

## Base URL
```
/api/users
```

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get All Users
Retrieve a paginated list of users with filtering and sorting options.

**Endpoint**: `GET /api/users`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin, User  

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max: 100) |
| sortBy | string | "createdAt" | Sort field |
| sortOrder | string | "desc" | Sort order (asc/desc) |
| search | string | - | Search term |
| role | string | - | Filter by role |
| status | string | - | Filter by status (true/false) |
| includeDeleted | string | "false" | Include deleted users |

#### Response
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "phone": "+855123456789",
        "name": "John Doe",
        "role": "user",
        "provider": "phone",
        "isVerified": true,
        "isActive": true,
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

### 2. Get User by ID
Retrieve a specific user by their ID.

**Endpoint**: `GET /api/users/:id`  
**Authentication**: Required  
**Authorization**: All authenticated users  

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | User ID (MongoDB ObjectId) |

#### Response
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+855123456789",
      "name": "John Doe",
      "role": "user",
      "provider": "phone",
      "isVerified": true,
      "isActive": true,
      "lastLogin": "2025-09-28T08:30:00.000Z",
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 3. Create User
Create a new user account.

**Endpoint**: `POST /api/users`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "phone": "+855123456789",
  "name": "John Doe",
  "role": "user",
  "password": "password123",
  "isVerified": false,
  "isActive": true
}
```

#### Response
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+855123456789",
      "name": "John Doe",
      "role": "user",
      "provider": "phone",
      "isVerified": false,
      "isActive": true,
      "createdAt": "2025-09-28T09:00:00.000Z",
      "updatedAt": "2025-09-28T09:00:00.000Z"
    }
  }
}
```

### 4. Update User
Update an existing user's information.

**Endpoint**: `PUT /api/users/:id`  
**Authentication**: Required  
**Authorization**: User (own profile), Admin, SuperAdmin  

#### Request Body
```json
{
  "name": "John Smith",
  "isActive": true
}
```

#### Response
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+855123456789",
      "name": "John Smith",
      "role": "user",
      "isVerified": true,
      "isActive": true,
      "updatedAt": "2025-09-28T09:15:00.000Z"
    }
  }
}
```

### 5. Soft Delete User
Deactivate a user (soft delete).

**Endpoint**: `DELETE /api/users/:id`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+855123456789",
      "name": "John Smith",
      "isActive": false,
      "deletedAt": "2025-09-28T09:20:00.000Z",
      "deletedBy": "507f1f77bcf86cd799439012"
    }
  }
}
```

### 6. Restore User
Restore a soft-deleted user.

**Endpoint**: `PUT /api/users/:id/restore`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "message": "User restored successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "phone": "+855123456789",
      "name": "John Smith",
      "isActive": true,
      "deletedAt": null,
      "restoredAt": "2025-09-28T09:25:00.000Z",
      "restoredBy": "507f1f77bcf86cd799439012"
    }
  }
}
```

### 7. Force Delete User
Permanently delete a user (SuperAdmin only).

**Endpoint**: `DELETE /api/users/:id/force-delete`  
**Authentication**: Required  
**Authorization**: SuperAdmin only  

#### Response
```json
{
  "success": true,
  "message": "User permanently deleted",
  "data": {
    "deletedUser": {
      "id": "507f1f77bcf86cd799439011",
      "phone": "+855123456789",
      "name": "John Smith",
      "role": "user"
    },
    "warning": "This action is irreversible"
  }
}
```

### 8. Get User Statistics
Get comprehensive user statistics.

**Endpoint**: `GET /api/users/stats`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "active": 1200,
    "inactive": 50,
    "users": 1100,
    "admins": 5,
    "superAdmins": 2,
    "verified": 1000,
    "phoneUsers": 1250,
    "createdThisMonth": 85,
    "percentageActive": 96,
    "percentageVerified": 83
  }
}
```

### 9. Get Deleted Users
Retrieve all soft-deleted users.

**Endpoint**: `GET /api/users/deleted`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Response
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "phone": "+855123456789",
        "name": "John Smith",
        "deletedAt": "2025-09-28T09:20:00.000Z",
        "deletedBy": "507f1f77bcf86cd799439012",
        "deleteInfo": {
          "deletedAt": "2025-09-28T09:20:00.000Z",
          "deletedBy": "507f1f77bcf86cd799439012",
          "daysSinceDeleted": 5
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 15,
      "limit": 10
    }
  }
}
```

### 10. Search Users
Advanced user search with multiple criteria.

**Endpoint**: `POST /api/users/search`  
**Authentication**: Required  
**Authorization**: Admin, SuperAdmin  

#### Request Body
```json
{
  "query": "john",
  "fields": ["name", "phone"],
  "page": 1,
  "limit": 10,
  "exact": false,
  "caseSensitive": false,
  "role": "user",
  "isActive": true,
  "dateFrom": "2025-01-01",
  "dateTo": "2025-12-31"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "phone": "+855123456789",
        "name": "John Doe",
        "role": "user",
        "isActive": true
      }
    ],
    "search": {
      "query": "john",
      "totalResults": 3,
      "resultCount": 3
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 3,
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
    "Phone number is required",
    "Name must be at least 2 characters"
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "User with this phone number already exists"
}
```

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated users**: 1000 requests per 15 minutes
- **Admin users**: 5000 requests per 15 minutes

## Data Validation

### Phone Number Format
- Must follow international format: `+855123456789`
- Pattern: `/^\\+?[1-9]\\d{1,14}$/`

### Name Requirements
- Minimum length: 2 characters
- Maximum length: 50 characters
- Trimmed whitespace

### Password Requirements (Admin/SuperAdmin)
- Minimum length: 6 characters
- Required for admin and superadmin roles

### Role Values
- `user` - Regular user
- `admin` - Administrator
- `superadmin` - Super administrator

---

**Last Updated**: September 28, 2025  
**Version**: 1.0.0