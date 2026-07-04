# Seller Module & E-Commerce Promotions (Developer 5 Scope)

This module implements the complete workflow for Seller management, registration, order queue, dashboard stats, promo codes CRUD & validation, product reviews aggregation, and loyalty points.

## Implemented Features

1. **Seller (Vendor) Management**
   - Mongoose model (`Seller.js`) containing: `userId`, `storeName`, `description`, `logo`, `phone`, `address`, `payoutInfo`, `status`.
   - Post-save hook to sync Mongoose `User` roles and `sellerStatus` changes with `Seller.status`.

2. **Seller Registration Flow**
   - Endpoint to submit a seller registration application (`POST /api/v1/sellers/register`).
   - Automatically registers with `pending` status.
   - Leverages existing admin endpoint (`PATCH /api/v1/admin/users/:id/status`) to approve or restrict status.

3. **Seller Dashboard & Stats**
   - Retrieves product and order counts, low stock alerts, and calculates total sales (`GET /api/v1/sellers/dashboard/stats`).

4. **Seller Product & Inventory Queue**
   - Retrieve seller-specific products (`GET /api/v1/sellers/products`).
   - Quick updates to stock / inventory availability (`PATCH /api/v1/sellers/products/:id/stock`).
   - Reuses existing Product CRUD routes (`POST /products`, `PUT /products/:id`, `DELETE /products/:id`).

5. **Seller Order Queue**
   - Lists orders containing the seller's products (`GET /api/v1/sellers/orders`).
   - Status transitions (Processing, Shipped, Delivered) using `PATCH /api/v1/sellers/orders/:id/status`.
   - Restricts access to ensure sellers cannot view or modify orders belonging to others.

6. **Promo Codes**
   - Mongoose model (`PromoCode.js`) and CRUD endpoints.
   - Hooked checkout validation to deduct percentage or fixed discounts from order total.

7. **Reviews & Ratings**
   - Mongoose model (`Review.js`) with index enforcing one review per customer per product.
   - Automatically computes and updates aggregate rating on the `Product` model.

8. **Loyalty Points**
   - Mongoose model (`Loyalty.js`) tracks point balances.
   - Integrates with checkout: redeem points (1 point = $0.10 discount) and earn points (1 point per $10 spent).

---

## Folder Structure

```
server/src/
├── models/
│   ├── Seller.js
│   ├── PromoCode.js
│   ├── Review.js
│   └── Loyalty.js
└── modules/
    ├── bonus/
    │   ├── bonus.controller.js
    │   ├── bonus.routes.js
    │   └── checkout.wrapper.js
    └── sellers/
        ├── README.md             <-- (This file)
        ├── seller.controller.js
        ├── seller.middleware.js
        ├── seller.routes.js
        └── seller.validators.js
```

---

## API Endpoints

### 1. Seller Management & Registration
* **`POST /api/v1/sellers/register`**
  - **Auth**: Required
  - **Body**: `{ "storeName": "My Store", "description": "Good stuff", "phone": "123", "address": "Cairo", "payoutInfo": "PayPal" }`
  - **Response**: `201 Created` with `{ success: true, seller }`

* **`GET /api/v1/sellers/profile`**
  - **Auth**: Required
  - **Response**: `200 OK` with `{ success: true, seller }`

* **`PUT /api/v1/sellers/profile`**
  - **Auth**: Required
  - **Body**: `{ "description": "Updated description" }`
  - **Response**: `200 OK` with `{ success: true, seller }`

### 2. Seller Operations (Approved Sellers Only)
* **`GET /api/v1/sellers/dashboard/stats`**
  - **Auth**: Required (Role: Seller, Status: Approved)
  - **Response**: `200 OK` with stats overview (sales, orders count, low stock alert)

* **`GET /api/v1/sellers/products`**
  - **Auth**: Required (Role: Seller, Status: Approved)
  - **Response**: `200 OK` with listed products list

* **`PATCH /api/v1/sellers/products/:id/stock`**
  - **Auth**: Required (Role: Seller, Status: Approved)
  - **Body**: `{ "stock": 50 }`
  - **Response**: `200 OK` with updated product details

* **`GET /api/v1/sellers/orders`**
  - **Auth**: Required (Role: Seller, Status: Approved)
  - **Response**: `200 OK` with orders list containing seller's items

* **`PATCH /api/v1/sellers/orders/:id/status`**
  - **Auth**: Required (Role: Seller, Status: Approved)
  - **Body**: `{ "status": "processing" }`
  - **Response**: `200 OK` with updated order status

### 3. Promotions & Checkout Extras (Bonus Module)
* **`POST /api/v1/bonus/promo-codes`**
  - **Auth**: Required (Admin / Seller)
  - **Body**: `{ "code": "WELCOME10", "discountType": "percentage", "discountValue": 10, "minOrderAmount": 50 }`

* **`GET /api/v1/bonus/promo-codes`**
  - **Auth**: Required (Admin / Seller)

* **`GET /api/v1/bonus/promo-codes/:code/validate`**
  - **Query**: `?subtotal=100`

* **`POST /api/v1/bonus/reviews`**
  - **Auth**: Required (Customer)
  - **Body**: `{ "productId": "id", "rating": 5, "comment": "Excellent" }`

* **`GET /api/v1/bonus/loyalty`**
  - **Auth**: Required

---

## Environment Variables

Ensure the following variables are defined in your `.env` file:
* `MONGO_URI`: MongoDB connection URL
* `JWT_SECRET`: Token signature key
* `JWT_REFRESH_SECRET`: Token signature key for session refreshes

---

## Running the Application & Tests

### Install Dependencies
```bash
# In server directory
npm install

# In client directory
npm install
```

### Run Tests
```bash
# In server directory
npm test
```

### Start Dev Servers
```bash
# Run Express Server
npm run dev

# Run Vue client
npm run dev
```
