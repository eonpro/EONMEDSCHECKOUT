#!/bin/bash

echo "🚀 Redeploying with webhook configuration..."
echo "================================="
echo ""

cd /Users/italo/Desktop/checkout\ page\ eonmeds/eonmeds-checkout

echo "📦 Building project..."
npm run build

echo ""
echo "🔄 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next: Test the webhook by making a test payment"
echo "Then check webhook logs at: https://dashboard.stripe.com/test/webhooks/we_1S9XvVDQlH4O9FhriRYrdBgx"
