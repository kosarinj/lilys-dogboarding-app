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
    const { customer_id, name, breed, age, size, food_preferences, behavioral_notes, special_instructions } = req.body
    const result = await query(
      `INSERT INTO dogs (customer_id, name, breed, age, size, food_preferences, behavioral_notes, special_instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, name, breed, age, size, food_preferences, behavioral_notes, special_instructions]
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
    const { name, breed, age, size, food_preferences, behavioral_notes, special_instructions } = req.body
    const result = await query(
      `UPDATE dogs SET name = $1, breed = $2, age = $3, size = $4, food_preferences = $5,
       behavioral_notes = $6, special_instructions = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [name, breed, age, size, food_preferences, behavioral_notes, special_instructions, id]
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
