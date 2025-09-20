#!/bin/bash

# Test Payment API Endpoints
# This script tests the payment endpoints with sample data

echo "🧪 Testing EonMeds Payment APIs..."
echo "================================="

API_URL="https://eonmeds-checkout-5l45t9aba-eonpro1s-projects.vercel.app/api"

# Test 1: Create Payment Intent for Semaglutide Monthly
echo ""
echo "📝 Test 1: Semaglutide Monthly Subscription ($229)"
echo "---------------------------------------------------"
curl -X POST "$API_URL/payment/create-intent" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25400,
    "customerEmail": "test@eonmeds.com",
    "metadata": {
      "medication": "semaglutide",
      "plan": "monthly",
      "planId": "sema_monthly"
    },
    "shipping_address": {
      "addressLine1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "US"
    },
    "order_data": {
      "medication": "Semaglutide",
      "plan": "Monthly Recurring",
      "price": "$229/month",
      "addons": [],
      "shipping": "Standard",
      "subtotal": "$229",
      "shipping_cost": "$25",
      "total": "$254",
      "payment_type": "subscription"
    }
  }' | python3 -m json.tool

echo ""
echo ""
echo "📝 Test 2: Tirzepatide One-Time Purchase ($399)"
echo "------------------------------------------------"
curl -X POST "$API_URL/payment/create-intent" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 42400,
    "customerEmail": "test2@eonmeds.com",
    "metadata": {
      "medication": "tirzepatide",
      "plan": "one-time",
      "planId": "tirz_onetime"
    },
    "shipping_address": {
      "addressLine1": "456 Broadway",
      "city": "Los Angeles",
      "state": "CA",
      "zipCode": "90001",
      "country": "US"
    },
    "order_data": {
      "medication": "Tirzepatide",
      "plan": "Unique Purchase",
      "price": "$399",
      "addons": [],
      "shipping": "Standard",
      "subtotal": "$399",
      "shipping_cost": "$25",
      "total": "$424",
      "payment_type": "one-time"
    }
  }' | python3 -m json.tool

echo ""
echo ""
echo "📝 Test 3: Semaglutide 3-Month Package ($567)"
echo "-----------------------------------------------"
curl -X POST "$API_URL/payment/create-intent" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 59200,
    "customerEmail": "test3@eonmeds.com",
    "metadata": {
      "medication": "semaglutide",
      "plan": "3-month",
      "planId": "sema_3month"
    },
    "shipping_address": {
      "addressLine1": "789 Park Ave",
      "city": "Chicago",
      "state": "IL",
      "zipCode": "60601",
      "country": "US"
    },
    "order_data": {
      "medication": "Semaglutide",
      "plan": "3-Month Package",
      "price": "$567",
      "addons": [],
      "shipping": "Standard",
      "subtotal": "$567",
      "shipping_cost": "$25",
      "total": "$592",
      "payment_type": "one-time"
    }
  }' | python3 -m json.tool

echo ""
echo "================================="
echo "✅ API Testing Complete!"
echo ""
echo "Check for:"
echo "1. Each request returns a client_secret"
echo "2. No error messages"
echo "3. Proper JSON formatting"
echo ""
echo "Next: Use the client_secret values in the frontend to complete payments"
