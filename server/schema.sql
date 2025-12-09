-- Lily's Dog Boarding Database Schema

-- Create ENUM types
CREATE TYPE dog_size AS ENUM ('small', 'medium', 'large');
CREATE TYPE rate_type AS ENUM ('regular', 'holiday');
CREATE TYPE stay_status AS ENUM ('upcoming', 'active', 'completed', 'cancelled');
CREATE TYPE bill_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE user_role AS ENUM ('admin', 'staff');

-- Customers table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dogs table
CREATE TABLE dogs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  breed VARCHAR(255),
  age INTEGER,
  size dog_size NOT NULL,
  food_preferences TEXT,
  behavioral_notes TEXT,
  special_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rates table
CREATE TABLE rates (
  id SERIAL PRIMARY KEY,
  dog_size dog_size NOT NULL,
  rate_type rate_type NOT NULL,
  price_per_day DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dog_size, rate_type)
);

-- Stays table
CREATE TABLE stays (
  id SERIAL PRIMARY KEY,
  dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  rate_type rate_type NOT NULL,
  days_count INTEGER NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  notes TEXT,
  status stay_status DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bills table
CREATE TABLE bills (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bill_code VARCHAR(12) UNIQUE NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status bill_status DEFAULT 'draft',
  payment_method VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bill items table
CREATE TABLE bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  stay_id INTEGER REFERENCES stays(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(50),
  stripe_payment_id VARCHAR(255),
  status payment_status DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_dogs_customer_id ON dogs(customer_id);
CREATE INDEX idx_stays_dog_id ON stays(dog_id);
CREATE INDEX idx_stays_dates ON stays(check_in_date, check_out_date);
CREATE INDEX idx_bills_customer_id ON bills(customer_id);
CREATE INDEX idx_bills_code ON bills(bill_code);
CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);

-- Settings table for global configuration
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default rates (example)
INSERT INTO rates (dog_size, rate_type, price_per_day) VALUES
  ('small', 'regular', 40.00),
  ('small', 'holiday', 60.00),
  ('medium', 'regular', 50.00),
  ('medium', 'holiday', 75.00),
  ('large', 'regular', 60.00),
  ('large', 'holiday', 90.00);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
  ('dropoff_fee', 15.00, 'Fee for drop-off service'),
  ('pickup_fee', 15.00, 'Fee for pick-up service');
