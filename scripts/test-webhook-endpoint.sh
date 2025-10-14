#!/bin/bash

# Test webhook endpoint
echo "🧪 Testing webhook endpoint..."
echo ""

# Simulate a Shopify order webhook
curl -X POST "https://cartuplift.vercel.app/webhooks/orders/create" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Shop-Domain: sectionappblocks.myshopify.com" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Hmac-SHA256: test" \
  -d '{
    "id": 9999999999,
    "email": "test@example.com",
    "total_price": "150.00",
    "line_items": [
      {
        "product_id": 9654262522156,
        "variant_id": 48794594689324,
        "title": "Test Product",
        "quantity": 1,
        "price": "75.00"
      }
    ]
  }' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "If you see HTTP Status: 200, the endpoint is working!"
echo "If you see HTTP Status: 401, the HMAC signature validation is working (expected without real Shopify signature)"
