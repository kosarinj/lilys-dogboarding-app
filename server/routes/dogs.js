import express from 'express'
import { query } from '../models/db.js'

const router = express.Router()

// GET /api/dogs
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*, c.name as customer_name, c.phone as customer_phone
      FROM dogs d
      JOIN customers c ON d.customer_id = c.id
      ORDER BY d.name
    `)
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/dogs/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query(`
      SELECT d.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM dogs d
      JOIN customers c ON d.customer_id = c.id
      WHERE d.id = $1
    `, [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/dogs
router.post('/', async (req, res) => {
  try {
    const { customer_id, name, breed, age, age_months, location, size, status, food_preferences, behavioral_notes, special_instructions, photo_url, pickup_fee_override, dropoff_fee_override, custom_daily_rate } = req.body
    const result = await query(
      `INSERT INTO dogs (customer_id, name, breed, age, age_months, location, size, status, food_preferences, behavioral_notes, special_instructions, photo_url, pickup_fee_override, dropoff_fee_override, custom_daily_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [customer_id, name, breed, age, age_months, location, size, status || 'active', food_preferences, behavioral_notes, special_instructions, photo_url, pickup_fee_override, dropoff_fee_override, custom_daily_rate]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/dogs/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, breed, age, age_months, location, size, status, food_preferences, behavioral_notes, special_instructions, photo_url, pickup_fee_override, dropoff_fee_override, custom_daily_rate } = req.body
    const result = await query(
      `UPDATE dogs SET name = $1, breed = $2, age = $3, age_months = $4, location = $5, size = $6,
       status = $7, food_preferences = $8, behavioral_notes = $9, special_instructions = $10, photo_url = $11,
       pickup_fee_override = $12, dropoff_fee_override = $13, custom_daily_rate = $14,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 RETURNING *`,
      [name, breed, age, age_months, location, size, status || 'active', food_preferences, behavioral_notes, special_instructions, photo_url, pickup_fee_override, dropoff_fee_override, custom_daily_rate, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/dogs/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query('DELETE FROM dogs WHERE id = $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' })
    }
    res.json({ message: 'Dog deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/dogs/migrate - Add missing columns to dogs table
router.post('/migrate', async (req, res) => {
  try {
    const migrations = [
      { column: 'status', type: 'VARCHAR(20) DEFAULT \'active\'' },
      { column: 'pickup_fee_override', type: 'DECIMAL(10,2)' },
      { column: 'dropoff_fee_override', type: 'DECIMAL(10,2)' },
      { column: 'custom_daily_rate', type: 'DECIMAL(10,2)' }
    ]

    let added = []
    let existing = []

    for (const migration of migrations) {
      const columnCheck = await query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dogs' AND column_name = $1
      `, [migration.column])

      if (columnCheck.rows.length === 0) {
        await query(`ALTER TABLE dogs ADD COLUMN ${migration.column} ${migration.type}`)
        added.push(migration.column)
        console.log(`Added column: ${migration.column}`)
      } else {
        existing.push(migration.column)
      }
    }

    res.json({
      success: true,
      message: `Migration complete: ${added.length} columns added, ${existing.length} already existed`,
      added,
      existing
    })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
