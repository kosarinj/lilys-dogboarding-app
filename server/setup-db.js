import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { Client } = pg

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔌 Connecting to database...')
    await client.connect()
    console.log('✅ Connected to database')

    console.log('📝 Reading schema file...')
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')

    console.log('🏗️  Creating database schema...')
    await client.query(schemaSQL)
    console.log('✅ Database schema created successfully!')

    console.log('\n📊 Database setup complete!')
    console.log('Tables created:')
    console.log('  - customers')
    console.log('  - dogs')
    console.log('  - rates (with default values)')
    console.log('  - stays')
    console.log('  - bills')
    console.log('  - bill_items')
    console.log('  - payments')
    console.log('  - admin_users')

  } catch (error) {
    console.error('❌ Error setting up database:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

setupDatabase()
