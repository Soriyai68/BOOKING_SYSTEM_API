# Movie Booking System API Documentation

Welcome to the comprehensive documentation for the Movie Booking System API. This documentation covers everything you need to know about setting up, configuring, and using the API.

## 📋 Table of Contents

### 🚀 Getting Started
- [Installation Guide](./setup/installation.md)
- [Environment Configuration](./setup/environment.md)
- [Quick Start](./setup/quick-start.md)
- [Docker Setup](./setup/docker.md)

### 📡 API Reference
- [Authentication](./api/authentication.md)
- [Users API](./api/users.md)
- [Seats API](./api/seats.md)
- [Locations API](./api/locations.md)
- [Error Handling](./api/errors.md)
- [Rate Limiting](./api/rate-limiting.md)

### 🗄️ Database
- [Models Overview](./database/models.md)
- [Schema Definitions](./database/schemas.md)
- [Relationships](./database/relationships.md)
- [Indexes](./database/indexes.md)
- [Migrations](./database/migrations.md)

### 💻 Code Examples
- [Authentication Examples](./examples/authentication.md)
- [CRUD Operations](./examples/crud-operations.md)
- [Advanced Queries](./examples/advanced-queries.md)
- [Error Handling](./examples/error-handling.md)

### 📚 Guides
- [Best Practices](./guides/best-practices.md)
- [Security Guidelines](./guides/security.md)
- [Performance Optimization](./guides/performance.md)
- [Troubleshooting](./guides/troubleshooting.md)
- [Contributing](./guides/contributing.md)

## 🏗️ System Overview

The Movie Booking System API is a RESTful service built with:
- **Framework**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi schema validation
- **File Storage**: AWS S3 compatible storage
- **Real-time**: Socket.io for live updates

## 🎯 Core Features

### User Management
- Role-based authentication (User, Admin, SuperAdmin)
- Phone-based OTP authentication
- Profile management
- Soft delete functionality

### Seat Management
- Theater seat configuration
- Multiple seat types (standard, premium, vip, wheelchair, recliner)
- Availability tracking
- Status management (active, maintenance, out_of_order, reserved)

### Location Management
- Cinema location tracking
- Geographic coordinates support
- Business hours management
- Contact information
- Amenities tracking

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Request sanitization
- Rate limiting
- Input validation
- SQL injection prevention
- CORS protection

## 🚦 API Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200  | OK | Request successful |
| 201  | Created | Resource created successfully |
| 400  | Bad Request | Invalid request data |
| 401  | Unauthorized | Authentication required |
| 403  | Forbidden | Insufficient permissions |
| 404  | Not Found | Resource not found |
| 409  | Conflict | Resource already exists |
| 429  | Too Many Requests | Rate limit exceeded |
| 500  | Internal Server Error | Server error |

## 📊 Response Format

All API responses follow a consistent format:

```json
{
  "success": boolean,
  "message": "string",
  "data": object | array,
  "pagination": {
    "currentPage": number,
    "totalPages": number,
    "totalCount": number,
    "limit": number,
    "hasNextPage": boolean,
    "hasPrevPage": boolean
  }
}
```

## 🔄 Versioning

Current API version: **v1.0.0**

The API uses semantic versioning (SemVer). Breaking changes will increment the major version.

## 📞 Support

- **Email**: support@moviebooking.com
- **Documentation Issues**: Create an issue in the repository
- **Feature Requests**: Use the feature request template

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🤝 Contributing

Please read our [Contributing Guidelines](./guides/contributing.md) before submitting pull requests.

---

**Last Updated**: September 28, 2025  
**Version**: 1.0.0