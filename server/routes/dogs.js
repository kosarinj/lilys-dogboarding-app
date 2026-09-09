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

/**
 * A dog's photo gallery.
 *
 * Separate from dogs.photo_url, which is the avatar and stays the avatar. These
 * are the extra pictures, and the starred ones are what that dog's owner sees
 * on their own booking page — which is the whole point of starring them, so the
 * flag is per photo rather than a count Lily has to keep in her head.
 *
 * Routes are mounted under /api/dogs, so they inherit requireAuth. Only Lily
 * uploads, stars or deletes; customers only ever read, and they read through
 * the booking payload, which is scoped to their own dogs.
 */

// GET /api/dogs/:id/photos
router.get('/:id/photos', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, dog_id, url, caption, in_collage, sort_order, created_at
       FROM dog_photos WHERE dog_id = $1
       ORDER BY sort_order, id`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/dogs/:id/photos
router.post('/:id/photos', async (req, res) => {
  try {
    const { url, caption } = req.body
    if (!url) return res.status(400).json({ error: 'A photo URL is required' })

    // New photos go to the end of the gallery, and are starred to begin with.
    // She has just chosen to upload this picture of this dog; making her then
    // find it and tick it as well is a second decision for the same intent.
    const next = await query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM dog_photos WHERE dog_id = $1`,
      [req.params.id]
    )
    const result = await query(
      `INSERT INTO dog_photos (dog_id, url, caption, in_collage, sort_order)
       VALUES ($1, $2, $3, true, $4) RETURNING *`,
      [req.params.id, url, caption || null, next.rows[0].n]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/dogs/photos/:photoId — star it, unstar it, or retitle it.
router.patch('/photos/:photoId', async (req, res) => {
  try {
    const { in_collage, caption } = req.body
    const result = await query(
      `UPDATE dog_photos
       SET in_collage = COALESCE($2, in_collage),
           caption = COALESCE($3, caption)
       WHERE id = $1 RETURNING *`,
      [req.params.photoId, in_collage === undefined ? null : !!in_collage, caption ?? null]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Photo not found' })
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/dogs/photos/:photoId
router.delete('/photos/:photoId', async (req, res) => {
  try {
    const result = await query(`DELETE FROM dog_photos WHERE id = $1 RETURNING id`, [req.params.photoId])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Photo not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
