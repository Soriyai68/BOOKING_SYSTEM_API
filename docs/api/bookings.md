# Bookings API

## Create Booking

Creates a new booking.

**URL** : `/api/bookings`

**Method** : `POST`

**Auth required** : YES

**Data constraints**

```json
{
    "userId": "[string, required]",
    "showtimeId": "[string, required]",
    "seats": "[array, required]",
    "total_price": "[number, required]",
    "payment_method": "[string, required, enum: ['Bakong', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer']]",
    "payment_id": "[string, optional]",
    "payment_status": "[string, optional, default: 'Pending']",
    "booking_status": "[string, optional, default: 'Confirmed']",
    "noted": "[string, optional]"
}
```

### `expired_at` Handling

The `expired_at` field for a booking is handled automatically based on the `payment_method`:

-   If `payment_method` is `'Cash'`, `expired_at` will be `null`, meaning the booking does not expire automatically.
-   For all other payment methods, `expired_at` is set to 15 minutes before the showtime's start time. If the booking is not paid by this time, it will be automatically cancelled.
