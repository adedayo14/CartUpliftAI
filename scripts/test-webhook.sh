#!/bin/bash

# Test webhook endpoint to verify it's working
# This simulates what Shopify sends when an order is created

WEBHOOK_URL="https://cartuplift.vercel.app/webhooks/orders/create"
SHOP="sectionappblocks.myshopify.com"

# Sample order payload with recommended products
# Replace product IDs with actual IDs from your recommendations
PAYLOAD='{
  "id": 999999999,
  "email": "test@example.com",
  "created_at": "2025-10-14T12:00:00Z",
  "updated_at": "2025-10-14T12:00:00Z",
  "total_price": "150.00",
  "subtotal_price": "150.00",
  "currency": "GBP",
  "financial_status": "paid",
  "fulfillment_status": null,
  "line_items": [
    {
      "id": 1111111111,
      "variant_id": 48794594689324,
      "title": "Hi top calf leather",
      "quantity": 1,
      "price": "75.00",
      "product_id": 9654262522156
    },
    {
      "id": 2222222222,
      "variant_id": 48794609598764,
      "title": "The Letterman",
      "quantity": 1,
      "price": "75.00",
      "product_id": 9654270976300
    }
  ],
  "customer": {
    "id": 8888888888,
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
  }
}'

echo "🧪 Testing webhook endpoint: $WEBHOOK_URL"
echo "📦 Shop: $SHOP"
echo ""
echo "Payload:"
echo "$PAYLOAD" | jq '.'
echo ""
echo "Sending request..."
echo ""

# Note: We can't fully test this without the HMAC signature that Shopify provides
# But we can at least verify the endpoint is reachable and returns a response

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Shop-Domain: $SHOP" \
  -H "X-Shopify-Topic: orders/create" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook endpoint is responding"
else
  echo "⚠️  Unexpected status code: $HTTP_CODE"
fi

echo ""
echo "📋 Next steps:"
echo "1. Check Vercel logs: https://vercel.com/adedayo14/cartuplift/logs"
echo "2. Look for '🎯 Order webhook START' message"
echo "3. Verify attribution records created in database"
