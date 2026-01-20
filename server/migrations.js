import { query } from './models/db.js'

export async function runMigrations() {
  console.log('Running database migrations...')

  try {
    // Create settings table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Settings table ready')

    // Insert default settings if they don't exist
    await query(`
      INSERT INTO settings (setting_key, setting_value, description)
      VALUES
        ('dropoff_fee', 20.00, 'Fee for drop-off service'),
        ('pickup_fee', 20.00, 'Fee for pick-up service')
      ON CONFLICT (setting_key) DO NOTHING
    `)
    console.log('✓ Default settings configured')

    // Update existing fee settings to $20 if they're still at $15
    await query(`
      UPDATE settings SET setting_value = 20.00
      WHERE setting_key IN ('dropoff_fee', 'pickup_fee') AND setting_value = 15.00
    `)
    console.log('✓ Updated fee settings to $20')

    // Add months field to dogs table
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS age_months INTEGER
    `)
    console.log('✓ Added age_months to dogs')

    // Add location field to dogs table
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS location VARCHAR(50)
    `)
    console.log('✓ Added location to dogs')

    // Add stay_type enum and update stays table
    await query(`
      DO $$ BEGIN
        CREATE TYPE stay_type AS ENUM ('boarding', 'daycare');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS stay_type stay_type DEFAULT 'boarding'
    `)
    console.log('✓ Added stay_type to stays')

    // Add check-in and check-out times to stays
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS check_in_time TIME
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS check_out_time TIME
    `)
    console.log('✓ Added check-in/out times to stays')

    // Add special_price field to stays
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS special_price DECIMAL(10,2)
    `)
    console.log('✓ Added special_price to stays')

    // Add stay_type to rates table (boarding vs daycare)
    await query(`
      ALTER TABLE rates ADD COLUMN IF NOT EXISTS service_type stay_type DEFAULT 'boarding'
    `)
    console.log('✓ Added service_type to rates')

    // Create daycare rates by duplicating existing rates
    // First check if daycare rates already exist
    const daycareCheck = await query(`SELECT COUNT(*) as count FROM rates WHERE service_type = 'daycare'`)
    if (parseInt(daycareCheck.rows[0].count) === 0) {
      await query(`
        INSERT INTO rates (dog_size, rate_type, service_type, price_per_day, created_at, updated_at)
        SELECT dog_size, rate_type, 'daycare'::stay_type, price_per_day * 0.7, created_at, updated_at
        FROM rates
        WHERE service_type = 'boarding'
        ON CONFLICT DO NOTHING
      `)
      console.log('✓ Created daycare rates (70% of boarding rates)')
    } else {
      console.log('✓ Daycare rates already exist')
    }

    // Add status field to dogs table
    await query(`
      DO $$ BEGIN
        CREATE TYPE dog_status AS ENUM ('active', 'deceased');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS status dog_status DEFAULT 'active'
    `)
    console.log('✓ Added status to dogs')

    // Add photo_url field to dogs table
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500)
    `)
    console.log('✓ Added photo_url to dogs')

    // Add age_entry_date to track when age was first recorded
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS age_entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `)
    console.log('✓ Added age_entry_date to dogs for automatic age tracking')

    // Add extra charge fields to stays table
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS extra_charge DECIMAL(10,2)
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS extra_charge_comments TEXT
    `)
    console.log('✓ Added extra_charge and extra_charge_comments to stays')

    // Add special price comments to stays table
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS special_price_comments TEXT
    `)
    console.log('✓ Added special_price_comments to stays')

    // Add pickup and dropoff fee overrides to dogs table
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS pickup_fee_override DECIMAL(10,2)
    `)
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS dropoff_fee_override DECIMAL(10,2)
    `)
    console.log('✓ Added pickup_fee_override and dropoff_fee_override to dogs')

    // Add rover flag to stays table (20% discount when booked through Rover.com)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS rover BOOLEAN DEFAULT FALSE
    `)
    console.log('✓ Added rover flag to stays')

    // Add is_puppy and puppy_fee to stays table
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS is_puppy BOOLEAN DEFAULT FALSE
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS puppy_fee DECIMAL(10,2) DEFAULT 0
    `)
    console.log('✓ Added is_puppy and puppy_fee to stays')

    // Add custom_daily_rate to dogs table
    await query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS custom_daily_rate DECIMAL(10,2)
    `)
    console.log('✓ Added custom_daily_rate to dogs')

    // Add puppy fee settings
    await query(`
      INSERT INTO settings (setting_key, setting_value, description)
      VALUES
        ('boarding_puppy_fee_regular', 10.00, 'Additional daily fee for puppies (boarding - regular)'),
        ('boarding_puppy_fee_holiday', 15.00, 'Additional daily fee for puppies (boarding - holiday)'),
        ('daycare_puppy_fee_regular', 10.00, 'Additional daily fee for puppies (daycare - regular)'),
        ('daycare_puppy_fee_holiday', 15.00, 'Additional daily fee for puppies (daycare - holiday)')
      ON CONFLICT (setting_key) DO NOTHING
    `)
    console.log('✓ Added puppy fee settings')

    // Change days_count from INTEGER to DECIMAL to support partial days (0.5, 1.5, etc.)
    await query(`
      ALTER TABLE stays ALTER COLUMN days_count TYPE DECIMAL(10,2) USING days_count::DECIMAL(10,2)
    `)
    console.log('✓ Changed days_count to DECIMAL for partial day support')

    // Change bill_items quantity from INTEGER to DECIMAL to support partial days
    await query(`
      ALTER TABLE bill_items ALTER COLUMN quantity TYPE DECIMAL(10,2) USING quantity::DECIMAL(10,2)
    `)
    console.log('✓ Changed bill_items quantity to DECIMAL for partial day support')

    console.log('✓ All migrations completed successfully')
  } catch (error) {
    console.error('Migration error:', error.message)
    // Don't throw - allow server to start even if migrations fail
  }
}
