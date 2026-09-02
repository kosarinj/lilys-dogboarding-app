import express from 'express'
import { query } from '../models/db.js'
import { requireAuth } from '../middleware/auth.js'
import { holidaysForYears } from '../utils/usHolidays.js'
import { holidayChargeForStay, getHolidaySurcharge, refreshHolidayFees } from '../services/holidays.js'

const router = express.Router()

/**
 * The holiday calendar behind the boarding surcharge.
 *
 * Defaults are seeded and can be switched off but not deleted — a deleted
 * default returns on the next seed, so disabling has to be the durable action.
 * Custom ones she adds are hers and can be removed outright.
 */

// GET /api/holidays?year=2026
router.get('/', requireAuth, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    const rows = await query(
      `SELECT id, holiday_date, name, enabled, source
       FROM holidays
       WHERE EXTRACT(YEAR FROM holiday_date) = $1
       ORDER BY holiday_date`,
      [year]
    )
    res.json({
      success: true,
      year,
      surcharge: await getHolidaySurcharge(),
      holidays: rows.rows.map(h => ({
        id: h.id,
        date: h.holiday_date instanceof Date
          ? `${h.holiday_date.getFullYear()}-${String(h.holiday_date.getMonth() + 1).padStart(2, '0')}-${String(h.holiday_date.getDate()).padStart(2, '0')}`
          : String(h.holiday_date).slice(0, 10),
        name: h.name,
        enabled: h.enabled,
        custom: h.source !== 'default',
      })),
    })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// POST /api/holidays — add one she wants that isn't in the defaults.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { date, name } = req.body || {}
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
      return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' })
    }
    if (!String(name || '').trim()) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }
    const r = await query(
      `INSERT INTO holidays (holiday_date, name, source) VALUES ($1, $2, 'custom')
       ON CONFLICT (holiday_date, name) DO UPDATE SET enabled = true
       RETURNING id`,
      [date, String(name).trim().slice(0, 120)]
    )
    // A stay quoted before this holiday existed is now under-priced. Re-price
    // the ones this date touches, or the surcharge only appears on stays booked
    // after Lily happened to add it.
    const touched = await refreshHolidayFees({ from: date, to: date })
    res.json({ success: true, id: r.rows[0]?.id, staysRepriced: touched })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// PATCH /api/holidays/:id — switch one on or off.
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { enabled } = req.body || {}
    const d = await query(`SELECT holiday_date FROM holidays WHERE id = $1`, [req.params.id])
    await query(`UPDATE holidays SET enabled = $2 WHERE id = $1`, [req.params.id, !!enabled])
    const on = d.rows[0]?.holiday_date
    const touched = on ? await refreshHolidayFees({ from: on, to: on }) : 0
    res.json({ success: true, staysRepriced: touched })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// DELETE /api/holidays/:id — custom only; a default is disabled instead.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const r = await query(`SELECT source FROM holidays WHERE id = $1`, [req.params.id])
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' })
    if (r.rows[0].source === 'default') {
      return res.status(400).json({
        success: false,
        error: 'Built-in holidays can be switched off but not deleted — a deleted one would return on the next update.',
      })
    }
    const d = await query(`SELECT holiday_date FROM holidays WHERE id = $1`, [req.params.id])
    const on = d.rows[0]?.holiday_date
    await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id])
    const touched = on ? await refreshHolidayFees({ from: on, to: on }) : 0
    res.json({ success: true, staysRepriced: touched })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// POST /api/holidays/seed — pull in a future year's dates on demand.
router.post('/seed', requireAuth, async (req, res) => {
  try {
    const year = Number(req.body?.year) || new Date().getFullYear() + 1
    let added = 0
    for (const h of holidaysForYears(year, year)) {
      const r = await query(
        `INSERT INTO holidays (holiday_date, name, source) VALUES ($1, $2, 'default')
         ON CONFLICT (holiday_date, name) DO NOTHING`,
        [h.date, h.name]
      )
      added += r.rowCount || 0
    }
    res.json({ success: true, year, added })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

/**
 * GET /api/holidays/preview?from=&to= — what a stay would be charged.
 *
 * Lets the surcharge be checked before a bill exists, rather than discovered on
 * one that's already been sent.
 */
router.get('/preview/range', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query
    if (!from || !to) return res.status(400).json({ success: false, error: 'from and to are required' })
    const charge = await holidayChargeForStay({ check_in_date: from, check_out_date: to })
    res.json({ success: true, ...charge })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

export default router
