import express from 'express'
import upload from '../middleware/upload.js'

const router = express.Router()

// POST /api/upload
router.post('/', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Return the file URL
    const fileUrl = `/uploads/${req.file.filename}`
    res.json({ url: fileUrl })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
