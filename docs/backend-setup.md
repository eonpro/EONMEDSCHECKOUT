# Backend Database Setup Guide

## Current Status
✅ **Frontend**: Complete and working
✅ **Payment Processing**: Working with Stripe
✅ **Metadata**: Sending all order data to Stripe
⚠️ **Database**: Not yet configured (orders only exist in Stripe)

## What's Working Now
Even without a database, your checkout is fully functional:
- Payments are processed successfully
- All order data is stored in Stripe's dashboard
- Customer receives email receipt from Stripe
- You can view all orders in Stripe Dashboard → Payments

## Setting Up AWS RDS Database

### 1. Create RDS Instance
```bash
# Using AWS Console:
1. Go to RDS Dashboard
2. Create database → PostgreSQL or MySQL
3. Choose "Free tier" template for testing
4. Set master username and password
5. Enable public access (for now)
6. Create database
```

### 2. Database Schema
Use the schema provided in `/docs/database/schema.sql`:
- `orders` table: Stores main order information
- `order_items` table: Stores individual items in each order

### 3. Environment Variables to Add
```env
# Add to Vercel Dashboard
DATABASE_URL=postgresql://username:password@your-rds-endpoint.amazonaws.com:5432/dbname
# or for MySQL:
DATABASE_URL=mysql://username:password@your-rds-endpoint.amazonaws.com:3306/dbname
```

### 4. Update Webhook to Save Orders
The webhook at `/api/payment/webhook.ts` is ready but needs database connection:

```typescript
// Currently has placeholder at line 102-105:
// TODO: Save order to database
// This is where you'd save the order details to your database
// using the metadata from the payment intent
```

### 5. Install Database Client
```bash
# For PostgreSQL:
npm install @prisma/client prisma
# or
npm install pg

# For MySQL:
npm install mysql2
```

### 6. Create Database Connection Module
Create `/api/lib/db.ts`:
```typescript
import { Pool } from 'pg'; // or mysql2

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;
```

### 7. Update Webhook to Save Orders
```typescript
import db from '../lib/db';

// In the payment_intent.succeeded handler:
const { metadata } = paymentIntent;
await db.query(
  'INSERT INTO orders (...) VALUES (...)',
  [/* values from metadata */]
);
```

## Alternative: Start Without Database

You can operate without a database initially:
1. **Use Stripe as your database** - All order data is there
2. **Export from Stripe** - Download CSV of orders when needed
3. **Manual fulfillment** - Process orders from Stripe dashboard
4. **Add database later** - When volume justifies it

## Order Data Available in Stripe

Every payment includes:
- Customer email
- Shipping address (in shipping field)
- Order details (in metadata):
  - Medication type
  - Plan selected
  - Add-ons
  - Shipping method
  - Price breakdown
  - Timestamp

## Next Steps

### Option 1: Quick Start (No Database)
1. ✅ Your checkout is ready to use
2. Process orders from Stripe Dashboard
3. Export data as needed
4. Add database when ready

### Option 2: Full Setup
1. Create AWS RDS instance
2. Run schema.sql to create tables  
3. Add DATABASE_URL to Vercel
4. Update webhook to save orders
5. Create admin dashboard (optional)

## Testing Your Current Setup

1. **Make a test payment**
   - Use test card: 4242 4242 4242 4242
   - Check Stripe Dashboard → Payments

2. **View order details**
   - Click on the payment
   - Check "Metadata" section for all order info
   - Check "Shipping" section for address

3. **Webhook logs**
   - Stripe Dashboard → Webhooks
   - View webhook attempts and responses

## Support

For database setup help:
- AWS RDS: https://aws.amazon.com/rds/getting-started/
- Prisma ORM: https://www.prisma.io/docs
- Stripe Webhooks: https://stripe.com/docs/webhooks
