import express from 'express'
import { query } from '../models/db.js'

const router = express.Router()

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY name')
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query('SELECT * FROM customers WHERE id = $1', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { name, phone, email } = req.body
    const result = await query(
      'INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, email]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, phone, email } = req.body
    const result = await query(
      'UPDATE customers SET name = $1, phone = $2, email = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, phone, email, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING *', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' })
    }
    res.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
