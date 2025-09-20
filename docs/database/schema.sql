-- EONMeds Checkout Database Schema
-- For AWS RDS (PostgreSQL or MySQL)

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50) NOT NULL, -- 'pending', 'paid', 'failed', 'refunded'
    
    -- Product details
    medication_type VARCHAR(50),
    plan_type VARCHAR(100),
    plan_price DECIMAL(10, 2),
    
    -- Add-ons
    addons JSON, -- Store as JSON array
    
    -- Shipping
    shipping_address JSON NOT NULL,
    shipping_method VARCHAR(50),
    shipping_cost DECIMAL(10, 2),
    
    -- Metadata
    metadata JSON,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_payment_intent (payment_intent_id),
    INDEX idx_customer_email (customer_email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Payment events table (for webhook tracking)
CREATE TABLE payment_events (
    id SERIAL PRIMARY KEY,
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    payment_intent_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_stripe_event (stripe_event_id),
    INDEX idx_payment_intent (payment_intent_id)
);

-- Customers table (optional - for future use)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255),
    name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_stripe_customer (stripe_customer_id)
);

-- Example queries:

-- Insert a new order
/*
INSERT INTO orders (
    payment_intent_id, 
    customer_email, 
    amount, 
    status, 
    medication_type,
    plan_type,
    plan_price,
    addons,
    shipping_address,
    shipping_method,
    shipping_cost,
    metadata
) VALUES (
    'pi_xxx',
    'customer@email.com',
    299.00,
    'pending',
    'semaglutide',
    '3-month',
    567.00,
    '["nausea-rx", "fat-burner"]',
    '{"street": "123 Main St", "city": "Tampa", "state": "FL", "zip": "33602", "country": "US"}',
    'standard',
    0.00,
    '{}'
);
*/

-- Update order status when payment succeeds
/*
UPDATE orders 
SET status = 'paid', 
    paid_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE payment_intent_id = 'pi_xxx';
*/

-- Get order by payment intent
/*
SELECT * FROM orders WHERE payment_intent_id = 'pi_xxx';
*/

-- Get customer order history
/*
SELECT * FROM orders 
WHERE customer_email = 'customer@email.com' 
ORDER BY created_at DESC;
*/
