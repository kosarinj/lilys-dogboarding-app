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

    console.log('✓ All migrations completed successfully')
  } catch (error) {
    console.error('Migration error:', error.message)
    // Don't throw - allow server to start even if migrations fail
  }
}
