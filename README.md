# Lily's Dog Boarding Management App

A comprehensive web application for managing dog boarding business operations including customer management, billing, payments, and analytics.

## Features

- **Customer & Dog Management**: Track customer information and dog profiles with preferences
- **Boarding Stays**: Manage check-ins, check-outs, and calculate costs automatically
- **Billing System**: Generate bills with unique codes for easy customer access
- **Payment Processing**: Accept payments via Stripe, with Venmo/Zelle/PayPal options
- **Analytics**: View business insights including busiest months and top customers
- **Mobile-Responsive**: Fully functional on desktop and mobile devices

## Tech Stack

### Frontend
- React with React Router
- Vite for build tooling
- Axios for API calls
- Recharts for analytics visualization

### Backend
- Node.js with Express
- PostgreSQL database
- JWT authentication
- Stripe for payments
- Nodemailer for email

### Deployment
- Railway (with PostgreSQL addon)
- Docker containerization

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Stripe account (for payments)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd lilys-dogboarding-app
```

2. Install dependencies:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Set up environment variables:
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create database
createdb lilys_dogboarding

# Run schema
psql lilys_dogboarding < server/schema.sql
```

5. Start development servers:
```bash
# Terminal 1: Start server (from server/ directory)
npm run dev

# Terminal 2: Start client (from client/ directory)
npm run dev
```

6. Open browser:
- Client: http://localhost:3000
- Server: http://localhost:5000

## Deployment to Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and initialize:
```bash
railway login
railway init
```

3. Add PostgreSQL addon:
```bash
railway add postgresql
```

4. Set environment variables in Railway dashboard

5. Deploy:
```bash
git push railway main
```

## Project Structure

```
lilys-dogboarding-app/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── utils/
│   └── package.json
├── server/          # Express backend
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── models/
│   └── package.json
├── Dockerfile
└── README.md
```

## Database Schema

- **customers**: Customer contact information
- **dogs**: Dog profiles linked to customers
- **rates**: Boarding rates by dog size and date type
- **stays**: Boarding stay records
- **bills**: Generated bills with unique codes
- **bill_items**: Line items for bills
- **payments**: Payment records
- **admin_users**: Admin login credentials

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Dogs
- `GET /api/dogs` - List all dogs
- `POST /api/dogs` - Create dog profile
- `PUT /api/dogs/:id` - Update dog
- `DELETE /api/dogs/:id` - Delete dog

### Stays
- `GET /api/stays` - List all stays
- `POST /api/stays` - Create stay
- `PUT /api/stays/:id` - Update stay

### Bills
- `GET /api/bills` - List all bills
- `GET /api/bills/:code` - Get bill by code (guest access)
- `POST /api/bills` - Generate bill
- `PUT /api/bills/:id` - Update bill

### Payments
- `POST /api/payments` - Process payment

### Analytics
- `GET /api/analytics/monthly-revenue` - Monthly revenue data
- `GET /api/analytics/top-dogs` - Most frequent visitors

## License

MIT
