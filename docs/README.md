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
- [Theaters API](./api/theaters.md)
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

### Theater Management
- Movie theater configuration
- Location-theater relationships
- Hall management and capacity tracking
- Amenities and features (IMAX, Dolby Atmos, etc.)
- Operating hours and contact information

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

### Documentation: Movie Poster Upload and Management

This document outlines the process of uploading a movie poster, associating it with a movie, and managing the image through the API. The process involves the `upload.controller.js`, the `movie.model.js`, and likely the `movie.controller.js` (which is not shown but can be inferred).

**Key Models and Controllers:**

*   **`movie.model.js`**: Defines the schema for a movie. The crucial field for image uploads is `poster_url`, which is a `String` that stores the URL of the movie's poster.
*   **`upload.controller.js`**: Handles the logic for uploading, deleting, and optimizing images with a cloud provider (in this case, Cloudinary).

---

### The Upload Process: A Step-by-Step Guide

The overall workflow for adding or updating a movie with a poster is as follows:

1.  **Client-Side Upload**: The frontend application sends a request to the API to upload an image file. This request is directed to an endpoint that uses the `uploadImage` method in the `UploadController`.

2.  **Image Upload and Processing (`upload.controller.js`)**:
    *   The `uploadImage` function receives the image file.
    *   It performs validations to ensure a file was uploaded, checks for allowed file types (`jpeg`, `png`, `gif`, `webp`), and verifies the file size (max 10MB).
    *   The image is then streamed to Cloudinary. During the upload, several transformations are applied:
        *   The image is resized to a maximum of 1000x1500 pixels.
        *   Cloudinary automatically optimizes the image quality and format for web delivery.
        *   The uploaded image is stored in the `booking_system/movies` folder in Cloudinary for better organization.
    *   Upon a successful upload, Cloudinary returns a JSON object containing details about the uploaded image, including `secure_url` (the URL of the image) and `public_id` (a unique identifier for the image in Cloudinary).
    *   The `uploadImage` function then sends this JSON object back to the client in the response.

3.  **Associating the Poster with a Movie**:
    *   After the client receives the successful upload response (containing the `secure_url`), it then makes another API call to either create a new movie or update an existing one.
    *   This request is handled by the `movie.controller.js` (not provided, but this is the standard workflow).
    *   In the body of this request, the client includes the `secure_url` received from the `uploadImage` function as the value for the `poster_url` field.

4.  **Saving the Movie (`movie.model.js`)**:
    *   The `movie.controller.js` takes the request body, which now includes the `poster_url`.
    *   It creates or updates a movie document in the database.
    *   The `poster_url` from Cloudinary is saved in the `poster_url` field of the movie document, effectively linking the movie to its uploaded poster.

### Example Workflow

1.  **POST `/api/upload/image`**: The client sends the movie poster image to this endpoint.
2.  The `UploadController.uploadImage` method processes the image and returns:
    ```json
    {
      "success": true,
      "message": "Image uploaded successfully",
      "data": {
        "url": "https://res.cloudinary.com/your_cloud/image/upload/v12345/booking_system/movies/some_public_id.jpg",
        "public_id": "booking_system/movies/some_public_id"
      }
    }
    ```
3.  **POST `/api/movies`** (to create a movie): The client then sends a request to create a new movie with the following body:
    ```json
    {
      "title": "The Amazing Adventure",
      "description": "An epic journey.",
      "duration_minutes": 120,
      "release_date": "2025-12-01",
      "poster_url": "https://res.cloudinary.com/your_cloud/image/upload/v12345/booking_system/movies/some_public_id.jpg"
    }
    ```
4.  The `movie.controller.js` creates a new movie document, and the `poster_url` is saved, linking the movie to its poster.

---

### Other Relevant Operations in `upload.controller.js`

*   **`deleteImage`**: This function allows for the deletion of an image from Cloudinary using its `public_id`. This would be used if a movie's poster is changed or if the movie is deleted, to avoid having orphaned images in cloud storage.
*   **`getOptimizedUrl`**: This utility function can generate different versions of an image on-the-fly by providing a `public_id` and desired transformations (like width, height, and crop type). This is useful for creating thumbnails or different-sized versions of the poster for various parts of the UI without needing to upload multiple files.
