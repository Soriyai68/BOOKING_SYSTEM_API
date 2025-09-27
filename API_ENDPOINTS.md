# 🎬 Movie Booking System - Complete API Endpoints

## 📚 **Table of Contents**
1. [Authentication Endpoints](#authentication-endpoints)
2. [User Management Endpoints](#user-management-endpoints)
3. [Seat Management Endpoints](#seat-management-endpoints)
4. [General Information](#general-information)

---

## 🔐 **Authentication Endpoints** `/api/auth`

### **Public Routes (No Authentication Required)**
| Method | Endpoint | Description | Validation Schema |
|--------|----------|-------------|-------------------|
| `POST` | `/api/auth/send-otp` | Send OTP to phone number | `sendOTPSchema` |
| `POST` | `/api/auth/verify-otp` | Verify OTP and login/register | `verifyOTPSchema` |
| `POST` | `/api/auth/admin-login` | Admin/SuperAdmin login with password | `adminLoginSchema` |
| `POST` | `/api/auth/refresh-token` | Refresh access token | `refreshTokenSchema` |

### **Protected Routes (Authentication Required)**
| Method | Endpoint | Description | Authorization |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/logout` | Logout user/admin | User/Admin/SuperAdmin |
| `GET` | `/api/auth/profile` | Get current user profile | User/Admin/SuperAdmin |
| `GET` | `/api/auth/sessions` | Get user's active sessions | User/Admin/SuperAdmin |
| `DELETE` | `/api/auth/sessions/:sessionId` | Logout specific session | User/Admin/SuperAdmin |
| `GET` | `/api/auth/stats` | Get authentication statistics | User/Admin/SuperAdmin |

---

## 👤 **User Management Endpoints** `/api/users`

### **Utility Routes (Admin/SuperAdmin Only)**
| Method | Endpoint | Description | Validation Schema |
|--------|----------|-------------|-------------------|
| `GET` | `/api/users/stats` | Get user statistics | - |
| `GET` | `/api/users/deleted` | Get deleted/deactivated users | `paginationSchema` (query) |
| `POST` | `/api/users/search` | Advanced user search | `advancedSearchSchema` |
| `POST` | `/api/users/batch-delete` | Delete multiple users | `batchDeleteSchema` |

### **Parameter-Based Routes**
| Method | Endpoint | Description | Authorization | Validation Schema |
|--------|----------|-------------|---------------|-------------------|
| `GET` | `/api/users/role/:role` | Get users by role | Admin/SuperAdmin | `roleParamSchema` (params), `paginationSchema` (query) |
| `GET` | `/api/users/phone/:phone` | Get user by phone | Admin/SuperAdmin | `phoneParamSchema` (params) |
| `PUT` | `/api/users/:id/restore` | Restore deleted user | Admin/SuperAdmin | `userIdParamSchema` (params) |
| `PUT` | `/api/users/:id/last-login` | Update last login timestamp | User/Admin/SuperAdmin | `userIdParamSchema` (params) |
| `DELETE` | `/api/users/:id/force` | Permanently delete user | SuperAdmin Only | `userIdParamSchema` (params) |

### **Core CRUD Routes**
| Method | Endpoint | Description | Authorization | Validation Schema |
|--------|----------|-------------|---------------|-------------------|
| `GET` | `/api/users` | Get all users (paginated) | Admin/SuperAdmin | `getAllUsersQuerySchema` (query) |
| `POST` | `/api/users` | Create new user | Admin/SuperAdmin | `createUserSchema` |
| `GET` | `/api/users/:id` | Get user by ID | User/Admin/SuperAdmin | `userIdParamSchema` (params) |
| `PUT` | `/api/users/:id` | Update user | User/Admin/SuperAdmin | `userIdParamSchema` (params), `updateUserSchema` |
| `DELETE` | `/api/users/:id` | Soft delete (deactivate) user | Admin/SuperAdmin | `userIdParamSchema` (params) |

---

## 🪑 **Seat Management Endpoints** `/api/seats`

### **Utility Routes**
| Method | Endpoint | Description | Authorization | Validation Schema |
|--------|----------|-------------|---------------|-------------------|
| `GET` | `/api/seats/stats` | Get seat statistics | Admin/SuperAdmin | - |
| `GET` | `/api/seats/available` | Get available seats | User/Admin/SuperAdmin | `availableSeatsQuerySchema` (query) |
| `GET` | `/api/seats/unavailable` | Get unavailable seats | Admin/SuperAdmin | `availableSeatsQuerySchema` (query) |
| `POST` | `/api/seats/search` | Advanced seat search | User/Admin/SuperAdmin | `searchSeatSchema` |
| `POST` | `/api/seats/batch-delete` | Delete multiple seats | Admin/SuperAdmin | `batchDeleteSchema` |
| `POST` | `/api/seats/bulk` | Create multiple seats | Admin/SuperAdmin | `bulkSeatSchema` |

### **Parameter-Based Routes**
| Method | Endpoint | Description | Authorization | Validation Schema |
|--------|----------|-------------|---------------|-------------------|
| `GET` | `/api/seats/type/:type` | Get seats by type | User/Admin/SuperAdmin | `seatTypeParamSchema` (params), `availableSeatsQuerySchema` (query) |
| `GET` | `/api/seats/row/:row` | Get seats by row | User/Admin/SuperAdmin | `rowParamSchema` (params) |
| `PUT` | `/api/seats/:id/toggle` | Toggle seat availability | Admin/SuperAdmin | `seatIdParamSchema` (params) |
| `PUT` | `/api/seats/:id/restore` | Restore seat (mark available) | Admin/SuperAdmin | `seatIdParamSchema` (params) |
| `DELETE` | `/api/seats/:id/force` | Permanently delete seat | SuperAdmin Only | `seatIdParamSchema` (params) |

### **Core CRUD Routes**
| Method | Endpoint | Description | Authorization | Validation Schema |
|--------|----------|-------------|---------------|-------------------|
| `GET` | `/api/seats` | Get all seats (paginated) | User/Admin/SuperAdmin | `getSeatQuerySchema` (query) |
| `POST` | `/api/seats` | Create new seat | Admin/SuperAdmin | `createSeatSchema` |
| `GET` | `/api/seats/:id` | Get seat by ID | User/Admin/SuperAdmin | `seatIdParamSchema` (params) |
| `PUT` | `/api/seats/:id` | Update seat | Admin/SuperAdmin | `seatIdParamSchema` (params), `updateSeatSchema` |
| `DELETE` | `/api/seats/:id` | Soft delete (mark unavailable) | Admin/SuperAdmin | `seatIdParamSchema` (params) |

---

## 🔍 **General Information**

### **Base URL**
```
http://localhost:3000
```

### **Authentication**
- **Header**: `Authorization: Bearer <token>`
- **Token Types**: JWT Access Token
- **Refresh**: Use `/api/auth/refresh-token` endpoint

### **Authorization Levels**
- **User**: Regular authenticated user
- **Admin**: Administrative user
- **SuperAdmin**: Super administrative user (highest privileges)

### **Response Format**
All endpoints return responses in this format:
```json
{
  "success": true|false,
  "message": "Description of the result",
  "data": {
    // Response data here
  },
  "pagination": {  // For paginated responses
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 100,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

### **Error Responses**
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages array"] // For validation errors
}
```

### **Common Query Parameters**

#### **Pagination**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10, max: 100)

#### **Sorting**
- `sortBy` (string): Field to sort by
- `sortOrder` (string): 'asc' or 'desc' (default: 'desc')

#### **Filtering**
- `search` (string): General search term
- `dateFrom` (ISO date): Filter from date
- `dateTo` (ISO date): Filter to date

### **Validation Schemas Used**

#### **User Schemas**
- `createUserSchema`: User creation validation
- `updateUserSchema`: User update validation
- `getAllUsersQuerySchema`: Get all users query validation
- `advancedSearchSchema`: Advanced search validation
- `batchDeleteSchema`: Batch deletion validation
- `userIdParamSchema`: User ID parameter validation
- `phoneParamSchema`: Phone parameter validation
- `roleParamSchema`: Role parameter validation
- `paginationSchema`: Pagination validation

#### **Seat Schemas**
- `createSeatSchema`: Seat creation validation
- `updateSeatSchema`: Seat update validation
- `getSeatQuerySchema`: Get all seats query validation
- `searchSeatSchema`: Seat search validation
- `batchDeleteSchema`: Batch deletion validation
- `seatIdParamSchema`: Seat ID parameter validation (UUID)
- `rowParamSchema`: Row parameter validation
- `seatTypeParamSchema`: Seat type parameter validation
- `availableSeatsQuerySchema`: Available seats query validation
- `bulkSeatSchema`: Bulk seat creation validation

#### **Auth Schemas**
- `sendOTPSchema`: OTP request validation
- `verifyOTPSchema`: OTP verification validation
- `adminLoginSchema`: Admin login validation
- `refreshTokenSchema`: Token refresh validation

### **Seat Types Available**
- `regular` - Standard seats
- `vip` - VIP seats
- `couple` - Couple seats
- `king` - King size seats
- `queen` - Queen size seats

### **User Roles Available**
- `user` - Regular user
- `admin` - Administrator
- `superadmin` - Super Administrator

### **HTTP Status Codes Used**
- `200` - OK (Success)
- `201` - Created (Resource created successfully)
- `400` - Bad Request (Validation error)
- `401` - Unauthorized (Authentication required)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found (Resource not found)
- `409` - Conflict (Resource already exists)
- `429` - Too Many Requests (Rate limiting)
- `500` - Internal Server Error

---

## 📋 **Quick Reference**

### **Most Common Endpoints**
```bash
# Authentication
POST /api/auth/send-otp          # Send OTP
POST /api/auth/verify-otp        # Login/Register
POST /api/auth/logout            # Logout

# Users
GET  /api/users                  # List users (Admin)
POST /api/users                  # Create user (Admin)
GET  /api/users/:id              # Get user
PUT  /api/users/:id              # Update user

# Seats
GET  /api/seats                  # List all seats
GET  /api/seats/available        # Available seats
POST /api/seats                  # Create seat (Admin)
PUT  /api/seats/:id              # Update seat (Admin)
```

### **Admin Only Endpoints**
- User management (create, delete, restore)
- Seat management (create, update, delete)
- Statistics and analytics
- Batch operations

### **SuperAdmin Only Endpoints**
- Force delete users
- Force delete seats
- System-level operations

This comprehensive API provides full CRUD functionality for a movie booking system with robust authentication, authorization, validation, and administrative capabilities! 🎯