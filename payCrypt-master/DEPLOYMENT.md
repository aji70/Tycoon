# Backend Deployment Guide

## 🚀 Quick Deploy to Railway (Recommended)

### Step 1: Prepare Your Backend
1. Make sure your backend code is in a Git repository
2. Copy `.env.example` to `.env` and fill in your values
3. Test locally: `npm run dev`

### Step 2: Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# In your backend directory
cd backend
railway init

# Deploy
railway up
```

### Step 3: Configure Environment Variables
In Railway dashboard, add these environment variables:
- `DB_HOST` - Your database host
- `DB_PORT` - Database port (usually 3306 for MySQL)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Your JWT secret key
- `NODE_ENV` - Set to "production"
- `FRONTEND_URL` - Your Vercel app URL (e.g., https://your-app.vercel.app)

### Step 4: Set Up Database
Railway provides managed MySQL/PostgreSQL:
1. Add MySQL plugin in Railway dashboard
2. Copy connection details to your environment variables
3. Run migrations: `railway run npm run migrate`

### Step 5: Update Frontend
Update your frontend's `.env.local`:
```
VITE_API_BASE_URL=https://your-railway-app.railway.app/api
```

## 🔄 Alternative: Render

### Step 1: Connect GitHub
1. Push your backend to GitHub
2. Go to render.com and connect your repository

### Step 2: Configure Build
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node

### Step 3: Add Environment Variables
Same as Railway, add all your environment variables in Render dashboard.

## 🔧 Alternative: Vercel (Serverless)

Since your frontend is on Vercel, you could also deploy your backend as Vercel serverless functions:

### Step 1: Create API Routes
Move your routes to `api/` directory in your project root:
```
api/
  auth/
    login.js
    register.js
  users/
    index.js
  transactions/
    index.js
```

### Step 2: Convert to Serverless
Each route becomes a serverless function. Example `api/auth/login.js`:
```javascript
import { login } from '../../backend/controllers/authController.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return login(req, res);
  }
  res.status(405).json({ error: 'Method not allowed' });
}
```

## 📊 Database Options

### Railway MySQL (Recommended)
- Built-in MySQL service
- Automatic backups
- Easy connection

### PlanetScale (MySQL)
- Serverless MySQL
- Great for scaling
- Free tier available

### Supabase (PostgreSQL)
- PostgreSQL with real-time features
- Built-in auth (could replace your auth system)
- Free tier generous

## 🔒 Security Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure CORS for your Vercel domain
- [ ] Use HTTPS in production
- [ ] Set up proper database permissions
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets

## 🚨 Common Issues

1. **CORS Errors**: Make sure FRONTEND_URL matches your Vercel domain
2. **Database Connection**: Check your connection string format
3. **Environment Variables**: Ensure all required vars are set
4. **Port Issues**: Most platforms auto-assign ports, use `process.env.PORT`

## 📝 Next Steps After Deployment

1. Test all API endpoints
2. Update frontend API URL
3. Set up monitoring/logging
4. Configure database backups
5. Set up CI/CD pipeline
