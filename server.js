// server.js
// -----------------------------------------------------------------------------
// Main entry point for the Wishlist backend service.
// Initializes Express, middleware, API routes, and starts the HTTP server.
// -----------------------------------------------------------------------------

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const wishlistRoutes = require('./routes/wishlist');

const app = express();

// -----------------------------------------------------------------------------
// Global Middleware
// -----------------------------------------------------------------------------

// Allow frontend (Shopify storefront) to communicate with this API.
app.use(cors());

// Parse JSON request bodies into req.body
app.use(express.json());

// -----------------------------------------------------------------------------
// Health Check Route
// -----------------------------------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'wishlist-api',
    time: new Date().toISOString(),
  });
});

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------

app.use('/api/wishlist', wishlistRoutes);

// -----------------------------------------------------------------------------
// Server Bootstrap
// -----------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[wishlist-api] server is running on port ${PORT}`);
});