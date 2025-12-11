import express from 'express'
import { query } from '../models/db.js'

const router = express.Router()

// Generate unique bill code
function generateBillCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'BILL-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET /api/bills/unbilled/stays - Get active and completed stays without bills (must be before /:id)
router.get('/unbilled/stays', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, d.name as dog_name, d.size as dog_size, d.photo_url as dog_photo_url,
             c.id as customer_id, c.name as customer_name, c.phone as customer_phone
      FROM stays s
      JOIN dogs d ON s.dog_id = d.id
      JOIN customers c ON d.customer_id = c.id
      WHERE s.status IN ('active', 'completed')
        AND s.id NOT IN (SELECT stay_id FROM bill_items)
      ORDER BY c.name, s.check_out_date DESC
    `)
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/bills - Get all bills
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      ORDER BY b.created_at DESC
    `)
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/bills/:id - Get bill by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Get bill with customer info
    const billResult = await query(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = $1
    `, [id])

    if (billResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' })
    }

    const bill = billResult.rows[0]

    // Get bill items with stay details
    const itemsResult = await query(`
      SELECT bi.*, s.*, d.name as dog_name, d.size as dog_size, d.photo_url as dog_photo_url
      FROM bill_items bi
      JOIN stays s ON bi.stay_id = s.id
      JOIN dogs d ON s.dog_id = d.id
      WHERE bi.bill_id = $1
      ORDER BY s.check_in_date
    `, [id])

    bill.items = itemsResult.rows

    res.json(bill)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/bills/code/:code - Get bill by code (for guest access)
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params

    const billResult = await query(`
      SELECT b.*, c.name as customer_name, c.phone as customer_phone
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.bill_code = $1
    `, [code])

    if (billResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' })
    }

    const bill = billResult.rows[0]

    const itemsResult = await query(`
      SELECT bi.*, s.*, d.name as dog_name, d.size as dog_size
      FROM bill_items bi
      JOIN stays s ON bi.stay_id = s.id
      JOIN dogs d ON s.dog_id = d.id
      WHERE bi.bill_id = $1
      ORDER BY s.check_in_date
    `, [bill.id])

    bill.items = itemsResult.rows

    res.json(bill)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/bills - Create bill from stays
router.post('/', async (req, res) => {
  try {
    const { customer_id, stay_ids, notes } = req.body

    if (!customer_id || !stay_ids || stay_ids.length === 0) {
      return res.status(400).json({ error: 'Customer ID and at least one stay required' })
    }

    // Get stay details
    const staysResult = await query(`
      SELECT * FROM stays
      WHERE id = ANY($1) AND status IN ('active', 'completed')
    `, [stay_ids])

    if (staysResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active or completed stays found' })
    }

    const stays = staysResult.rows

    // Calculate totals
    let subtotal = 0
    stays.forEach(stay => {
      subtotal += parseFloat(stay.total_cost)
    })

    const tax = 0 // No tax for now
    const total_amount = subtotal + tax

    // Generate unique bill code
    let bill_code = generateBillCode()
    let isUnique = false
    while (!isUnique) {
      const existing = await query('SELECT id FROM bills WHERE bill_code = $1', [bill_code])
      if (existing.rows.length === 0) {
        isUnique = true
      } else {
        bill_code = generateBillCode()
      }
    }

    const bill_date = new Date()
    const due_date = new Date(bill_date)
    due_date.setDate(due_date.getDate() + 7) // Due in 7 days

    // Create bill
    const billResult = await query(`
      INSERT INTO bills (customer_id, bill_code, bill_date, due_date, subtotal, tax, total_amount, paid_amount, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [customer_id, bill_code, bill_date, due_date, subtotal, tax, total_amount, 0, 'draft', notes])

    const bill = billResult.rows[0]

    // Create bill items
    for (const stay of stays) {
      const description = `Boarding - ${stay.days_count} day${stay.days_count > 1 ? 's' : ''}`
      await query(`
        INSERT INTO bill_items (bill_id, stay_id, description, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [bill.id, stay.id, description, stay.days_count, stay.daily_rate, stay.total_cost])
    }

    res.status(201).json(bill)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/bills/:id - Update bill
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { status, paid_amount, payment_method, notes } = req.body

    const result = await query(`
      UPDATE bills
      SET status = COALESCE($1, status),
          paid_amount = COALESCE($2, paid_amount),
          payment_method = COALESCE($3, payment_method),
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [status, paid_amount, payment_method, notes, id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/bills/:id - Delete bill
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Delete bill items first
    await query('DELETE FROM bill_items WHERE bill_id = $1', [id])

    // Delete bill
    const result = await query('DELETE FROM bills WHERE id = $1 RETURNING *', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' })
    }

    res.json({ message: 'Bill deleted successfully' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
