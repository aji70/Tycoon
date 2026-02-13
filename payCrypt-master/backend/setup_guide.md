# Paycrypt ==> Express.js + Knex.js + MySQL API Setup Guide

A comprehensive backend API built with modern JavaScript using ES6 modules.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL
- **Query Builder:** Knex.js
- **Authentication:** JWT + bcrypt
- **Validation:** Joi
- **Security:** Helmet, CORS, Rate Limiting

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## 🚀 Quick Setup

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/llinsss/payCrypt_v2
cd payCrypt_v2/backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Server Configuration
NODE_ENV=development
PORT=3000
```

> **Important:** Replace all placeholder values with your actual configuration!

### 3. Database Setup

```bash
# Create your MySQL database first
mysql -u root -p
CREATE DATABASE your_database_name;
exit 

or use phpmyadmin ui in xampp/lampp environment

# Run migrations to create tables
npm run migrate

# (Optional) Run seeds to populate with sample data
npm run seed
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Your API will be running at `http://localhost:3000`

## 🔧 Available Commands

### Development
```bash
npm run dev          # Start development server with nodemon
npm start            # Start production server
```

### Database Migrations
```bash
npm run migrate:make <name>     # Create new migration
npm run migrate                 # Run all pending migrations
npm run migrate:rollback        # Rollback last migration
npm run migrate:rollback:all    # Rollback all migrations
npm run migrate:status          # Check migration status
```

### Database Seeds
```bash
npm run seed:make <name>        # Create new seed file
npm run seed                    # Run all seeds
```

### Database Utilities
```bash
npm run db:reset               # Reset database (rollback, migrate, seed)
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users (Protected)
- `GET /api/users/profile` - View user profile
- `POST /api/users/profile` - Edit user profile

### Health Check
- `GET /health` - Server health status

## 🔐 Authentication

Include JWT token in request headers:
```
Authorization: Bearer <your-jwt-token>
```

## 📝 Example Requests

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tag": "johndoe",
    "email": "john@doe.com",
    "password": "xxxxxx",
    "address": "0x00000000000000000000000"
  }'
```

### Login User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "john@doe.com or johndoe",
    "password": "xxxxxx"
  }'
```

## 🛡️ Security Features

- **Helmet** - Sets security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Prevents spam/abuse
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt encryption
- **Input Validation** - Joi schema validation

## 🐛 Troubleshooting

### Database Connection Issues
1. Verify MySQL is running: `brew services start mysql` (macOS) or `sudo service mysql start` (Linux)
2. Check database credentials in `.env` file
3. Ensure database exists: `CREATE DATABASE your_database_name;`

### Migration Errors
1. Check database connection first
2. Verify migration files are properly formatted
3. Use `npm run migrate:status` to check current state

### JWT Token Issues
1. Ensure `JWT_SECRET` is set in `.env`
2. Check token format: `Bearer <token>`
3. Verify token hasn't expired (24h default)

## 🚀 Deployment Tips

1. Set `NODE_ENV=production` in production
2. Use proper MySQL credentials
3. Generate strong `JWT_SECRET`
4. Consider using PM2 for process management
5. Set up proper logging and monitoring

---

Happy coding! 🎉