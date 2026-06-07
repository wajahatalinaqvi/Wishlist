// middleware/auth.js
// -----------------------------------------------------------------------------
// Request-validation middleware for the wishlist routes.
//
// Exposes:
//   - validateCustomerId: ensures a customerId is present and well-formed
//     (in the JSON body for POST/DELETE, or the query string for GET).
//   - validateProductId: ensures a productId is present and well-formed
//     (in the JSON body for add/remove).
//   - auth: a placeholder Authorization-header check kept for future use.
//
// Both validators accept only scalar (string/number) IDs and normalize them to
// a trimmed string, so storage and comparisons stay consistent regardless of
// whether the client sent "123" or 123.
// -----------------------------------------------------------------------------

/**
 * Coerce a raw ID value to a clean string, or return null if it's unusable.
 * Rejects arrays/objects (e.g. a duplicated ?customerId= query param) and
 * blank/whitespace-only values.
 *
 * @param {*} raw - The value pulled from the body or query string.
 * @returns {string|null} The trimmed string ID, or null when invalid.
 */
function normalizeId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return null;
  }
  const value = String(raw).trim();
  return value.length > 0 ? value : null;
}

/**
 * Ensure the request carries a valid customerId before it reaches a handler.
 *
 * Looks in both req.body (POST/DELETE) and req.query (GET) so the same
 * middleware works for every wishlist route. On success it normalizes the value
 * onto req.customerId for convenient downstream access.
 *
 * @returns {void} Sends 400 on failure, otherwise calls next().
 */
function validateCustomerId(req, res, next) {
  // POST/DELETE send JSON bodies; GET sends a query param — accept either.
  const raw =
    (req.body && req.body.customerId) ||
    (req.query && req.query.customerId);


  const customerId = normalizeId(raw);

  // Reject the request if no valid customer was identified.
  if (!customerId) {
    console.log("there is no cusotmer id");
    return res.status(400).json({ error: 'customerId is required' });
  }

  // Normalize for handlers so they don't each re-check body vs query.
  req.customerId = customerId;

  // Hand control to the next middleware or the route handler.
  next();
}

/**
 * Ensure the request carries a valid productId in the JSON body before it
 * reaches a handler (used by the add/remove routes). Normalizes the value onto
 * req.productId.
 *
 * @returns {void} Sends 400 on failure, otherwise calls next().
 */
function validateProductId(req, res, next) {
  const productId = normalizeId(req.body && req.body.productId);

  if (!productId) {
    return res
      .status(400)
      .json({ error: 'productId is required and must be a string or number' });
  }

  req.productId = productId;
  next();
}

/**
 * Placeholder Authorization-header guard.
 *
 * Not wired into the wishlist routes yet, but kept here so real session/JWT
 * verification can be added later without restructuring the middleware layer.
 */
function auth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({ error: 'Invalid Authorization token' });
  }

  // TODO: replace with real verification (Shopify session token or signed JWT).
  req.token = token;
  next();
}

module.exports = { validateCustomerId, validateProductId, auth };
