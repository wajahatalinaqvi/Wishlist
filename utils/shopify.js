// utils/shopify.js
// -----------------------------------------------------------------------------
// Shopify Admin API helpers for wishlist metafield management.
// Handles customer wishlist storage + product resolution.
// -----------------------------------------------------------------------------

const API_VERSION = '2026-04';

const WISHLIST_NAMESPACE = 'wishlist';
const WISHLIST_KEY = 'products';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

function getConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    throw new Error(
      '[shopify] Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN'
    );
  }

  const baseUrl = `https://${storeDomain}/admin/api/${API_VERSION}`;

  return { baseUrl, accessToken };
}

// -----------------------------------------------------------------------------
// Core Fetch Wrapper
// -----------------------------------------------------------------------------

async function shopifyFetch(path, options = {}) {
  const { baseUrl, accessToken } = getConfig();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        ...(options.headers || {}),
      },
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      throw new Error(
        `[shopify] ${response.status} - ${
          data?.errors ? JSON.stringify(data.errors) : response.statusText
        }`
      );
    }

    return data;
  } catch (err) {
    console.error('[shopifyFetch error]', err.message);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function parseWishlistValue(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Wishlist Metafield
// -----------------------------------------------------------------------------

async function getWishlistMetafield(customerId) {
  const path =
    `/customers/${encodeURIComponent(customerId)}/metafields.json` +
    `?namespace=${WISHLIST_NAMESPACE}`;

  const data = await shopifyFetch(path, { method: 'GET' });

  const metafields = data?.metafields || [];

  return metafields.find((m) => m.key === WISHLIST_KEY) || null;
}

async function saveWishlistMetafield(customerId, wishlist) {
  const existing = await getWishlistMetafield(customerId);
  const value = JSON.stringify(wishlist);

  if (existing) {
    await shopifyFetch(`/metafields/${existing.id}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        metafield: {
          id: existing.id,
          value,
          type: 'json',
        },
      }),
    });
  } else {
    await shopifyFetch(
      `/customers/${encodeURIComponent(customerId)}/metafields.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          metafield: {
            namespace: WISHLIST_NAMESPACE,
            key: WISHLIST_KEY,
            value,
            type: 'json',
          },
        }),
      }
    );
  }

  return wishlist;
}

// -----------------------------------------------------------------------------
// Product Resolver
// -----------------------------------------------------------------------------

async function getProduct(productId) {
  const data = await shopifyFetch(
    `/products/${encodeURIComponent(productId)}.json`,
    { method: 'GET' }
  );

  const product = data?.product;
  if (!product) return null;

  const variant = product?.variants?.[0] || null;

  const image =
    product?.image?.src ||
    product?.images?.[0]?.src ||
    '';

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    image,
    price: variant?.price || null,
    variantId: variant?.id || null,
  };
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

module.exports = {
  getWishlistMetafield,
  saveWishlistMetafield,
  getProduct,
  parseWishlistValue,
};