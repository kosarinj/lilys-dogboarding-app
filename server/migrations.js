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
        ('dropoff_fee', 15.00, 'Fee for drop-off service'),
        ('pickup_fee', 15.00, 'Fee for pick-up service')
      ON CONFLICT (setting_key) DO NOTHING
    `)
    console.log('✓ Default settings configured')

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

    console.log('✓ All migrations completed successfully')
  } catch (error) {
    console.error('Migration error:', error.message)
    // Don't throw - allow server to start even if migrations fail
  }
}
