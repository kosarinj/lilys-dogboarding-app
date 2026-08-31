import { query } from './models/db.js'
import { generateBookingCode } from './utils/bookingCode.js'
import { holidaysForYears } from './utils/usHolidays.js'

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

    // Add drop-off/pick-up service fields to stays table
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS requires_dropoff BOOLEAN DEFAULT false
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS requires_pickup BOOLEAN DEFAULT false
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS dropoff_fee DECIMAL(10,2) DEFAULT 0
    `)
    await query(`
      ALTER TABLE stays ADD COLUMN IF NOT EXISTS pickup_fee DECIMAL(10,2) DEFAULT 0
    `)
    console.log('✓ Added requires_dropoff, requires_pickup, dropoff_fee, pickup_fee to stays')

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

    // Add 'custom' to rate_type enum if it exists as an enum
    try {
      await query(`ALTER TYPE rate_type ADD VALUE IF NOT EXISTS 'custom'`)
      console.log('✓ Added custom to rate_type enum')
    } catch (e) {
      // If rate_type is not an enum or already has 'custom', ignore
      console.log('rate_type enum update skipped:', e.message)
    }

    // Auth: ensure the admin_users table + supporting types exist (idempotent)
    await query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'staff');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role user_role DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`CREATE TABLE IF NOT EXISTS app_config (key VARCHAR(64) PRIMARY KEY, value TEXT NOT NULL)`)
    console.log('✓ Auth tables (admin_users, app_config) ready')

    // ── Customer self-booking ────────────────────────────────────────────
    // Each customer gets a permanent booking code, the same shape as bill_code.
    // The link is handed out by Lily, which is what keeps this to people she
    // already boards for — there is no signup, so a stranger has no way in.
    await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS booking_code VARCHAR(12) UNIQUE`)

    // A request is a stay that hasn't been agreed to yet. Making it a status
    // rather than a separate table means an approved request becomes an
    // ordinary stay with no copying — everything downstream (bills, calendar,
    // analytics) already understands stays.
    // Deliberately NOT wrapped in a DO block: ALTER TYPE ... ADD VALUE can't run
    // inside a transaction on older Postgres, and a DO block is one. Run bare and
    // swallow the duplicate here instead.
    try {
      await query(`ALTER TYPE stay_status ADD VALUE IF NOT EXISTS 'requested'`)
    } catch (e) {
      if (!/already exists|duplicate/i.test(e.message)) console.error('stay_status enum:', e.message)
    }
    // Who asked, and when — so a request can be shown apart from a stay Lily
    // entered herself, and declines keep a reason rather than vanishing.
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP`)
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS decline_reason TEXT`)
    // Payment held against a request. The card is authorized when the request is
    // made and only captured when she approves, so the money is committed
    // without being taken from someone whose dates might be declined.
    // payment_state: null (no card) | authorized | captured | released | expired
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255)`)
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS payment_state VARCHAR(20)`)
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS quoted_total DECIMAL(10,2)`)
    // How a stay was actually settled. bills has this already; stays didn't, and
    // a Venmo marked paid against a stay had nowhere to record that it was Venmo.
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)`)
    // When the customer was actually told, and how. Without this a manually
    // sent text leaves no trace, so there's no way to tell an approval that was
    // passed on from one that's been sitting unmentioned for two days.
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP`)
    await query(`ALTER TABLE stays ADD COLUMN IF NOT EXISTS notified_via VARCHAR(20)`)

    // Backfill codes for existing customers. Done in JS rather than SQL so the
    // alphabet matches the bill codes she already reads out over the phone.
    const missing = await query(`SELECT id FROM customers WHERE booking_code IS NULL`)
    for (const row of missing.rows) {
      // Retry on the vanishingly unlikely collision rather than failing the boot.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateBookingCode()
        try {
          await query(`UPDATE customers SET booking_code = $1 WHERE id = $2`, [code, row.id])
          break
        } catch (e) { if (attempt === 4) console.error('booking code failed for customer', row.id) }
      }
    }
    if (missing.rows.length) console.log(`✓ Booking codes issued to ${missing.rows.length} customer(s)`)

    // Capacity. Stored in the same settings table as the fees, so she can change
    // it without a deploy. max_dogs_per_night is what stops self-booking from
    // overbooking her; max_dog_size is an index into ('small','medium','large')
    // — 2 means large dogs can't be requested, which is her rule today.
    await query(`
      INSERT INTO settings (setting_key, setting_value, description)
      VALUES
        ('max_dogs_per_night', 3, 'How many dogs can be boarded on the same night'),
        ('max_dog_size', 2, 'Largest dog size that can be requested online: 1 small, 2 medium, 3 large')
      ON CONFLICT (setting_key) DO NOTHING
    `)
    console.log('✓ Booking settings ready')

    // ── Holiday calendar ─────────────────────────────────────────────────
    // Boarding over a holiday is worth more and is harder to staff, so those
    // nights carry a surcharge. Kept as dated rows rather than rules because
    // most of these move — Thanksgiving is the fourth Thursday, Easter follows
    // the lunar calendar — and a hand-typed list is right for one year and
    // quietly wrong after that.
    //
    // `enabled` rather than deleting: switching one off should be reversible,
    // and a deleted default would come back on the next seed.
    await query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id SERIAL PRIMARY KEY,
        holiday_date DATE NOT NULL,
        name VARCHAR(120) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        source VARCHAR(20) DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(holiday_date, name)
      )
    `)

    // Seeded a few years ahead and one behind, so past stays can still be
    // re-billed correctly. ON CONFLICT DO NOTHING means a re-run never
    // resurrects something switched off or overwrites a renamed one.
    {
      const thisYear = new Date().getFullYear()
      const seed = holidaysForYears(thisYear - 1, thisYear + 3)
      let added = 0
      for (const h of seed) {
        const r = await query(
          `INSERT INTO holidays (holiday_date, name, source) VALUES ($1, $2, 'default')
           ON CONFLICT (holiday_date, name) DO NOTHING`,
          [h.date, h.name]
        )
        added += r.rowCount || 0
      }
      if (added) console.log(`✓ Seeded ${added} holiday date(s)`)
    }

    await query(`
      INSERT INTO settings (setting_key, setting_value, description)
      VALUES ('holiday_surcharge_per_day', 17.00, 'Extra charge per dog per holiday night')
      ON CONFLICT (setting_key) DO NOTHING
    `)
    console.log('✓ Holiday calendar ready')

    console.log('✓ All migrations completed successfully')
  } catch (error) {
    console.error('Migration error:', error.message)
    // Don't throw - allow server to start even if migrations fail
  }
}
