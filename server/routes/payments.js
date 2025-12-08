import express from 'express'

const router = express.Router()

router.post('/', (req, res) => {
  res.json({ message: 'Payments endpoint - to be implemented' })
})

export default router
