import express from 'express'
import multer from 'multer'
import cloudinary from '../config/cloudinary.js'
import { Readable } from 'stream'

const router = express.Router()

// Configure multer to use memory storage
const storage = multer.memoryStorage()
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(file.originalname.toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'))
    }
  }
})

// POST /api/upload
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Check if Cloudinary is configured
    console.log('Cloudinary config check:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
    })

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      console.warn('⚠️ Cloudinary not configured. Using fallback local storage.')
      // Return a mock URL for development/testing
      const mockUrl = `/uploads/mock-${Date.now()}.jpg`
      return res.json({ url: mockUrl, mock: true })
    }

    console.log('✓ Cloudinary configured, uploading to cloud...')

    // Upload to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'dog-boarding',
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error)
          return res.status(500).json({ error: 'Failed to upload image' })
        }

        // Return the Cloudinary URL
        res.json({ url: result.secure_url })
      }
    )

    // Convert buffer to stream and pipe to Cloudinary
    const bufferStream = Readable.from(req.file.buffer)
    bufferStream.pipe(uploadStream)

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
