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
    const { customer_id, name, breed, age, age_months, location, size, food_preferences, behavioral_notes, special_instructions, photo_url } = req.body
    const result = await query(
      `INSERT INTO dogs (customer_id, name, breed, age, age_months, location, size, food_preferences, behavioral_notes, special_instructions, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [customer_id, name, breed, age, age_months, location, size, food_preferences, behavioral_notes, special_instructions, photo_url]
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
    const { name, breed, age, age_months, location, size, food_preferences, behavioral_notes, special_instructions, photo_url } = req.body
    const result = await query(
      `UPDATE dogs SET name = $1, breed = $2, age = $3, age_months = $4, location = $5, size = $6,
       food_preferences = $7, behavioral_notes = $8, special_instructions = $9, photo_url = $10,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 RETURNING *`,
      [name, breed, age, age_months, location, size, food_preferences, behavioral_notes, special_instructions, photo_url, id]
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

export default router
