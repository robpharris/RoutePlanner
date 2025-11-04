# 🚀 Production Deployment Guide

## Overview

This guide helps you deploy the Route Planner application to replace your paid mobile app subscription. The application supports both development (SQLite) and production (PostgreSQL) databases.

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

## 🏗️ Architecture Options

### Option 1: Self-Hosted (Recommended for cost savings)
- **VPS**: DigitalOcean, Linode, Vultr ($5-20/month)
- **Database**: PostgreSQL or SQLite
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (free)

### Option 2: Platform-as-a-Service
- **Frontend**: Vercel, Netlify (free tier available)
- **Backend**: Railway, Render, Heroku ($7-25/month)
- **Database**: Railway PostgreSQL, PlanetScale, Neon

### Option 3: Cloud Providers
- **AWS**: EC2 + RDS
- **Google Cloud**: Cloud Run + Cloud SQL
- **Azure**: Container Apps + PostgreSQL

## 🐳 Docker Deployment (Recommended)

### 1. Create Docker files

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_TYPE=postgresql
      - DB_HOST=database
      - DB_NAME=routeplanner
      - DB_USER=routeplanner
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
    depends_on:
      - database

  database:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=routeplanner
      - POSTGRES_USER=routeplanner
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 2. Environment Setup

Create `.env` file:
```bash
DB_PASSWORD=your_secure_database_password
JWT_SECRET=your_jwt_secret_32_chars_minimum
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3. Deploy
```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Scale if needed
docker-compose up -d --scale backend=2
```

## 🌐 VPS Deployment (DigitalOcean Example)

### 1. Server Setup
```bash
# Create droplet (Ubuntu 22.04, $6/month minimum)
# SSH into server

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Database Setup
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE routeplanner;
CREATE USER routeplanner WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE routeplanner TO routeplanner;
\q
```

### 3. Application Setup
```bash
# Clone your repository
git clone https://github.com/yourusername/routeplanner.git
cd routeplanner

# Backend setup
cd backend
npm install --production
npm run build

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3001
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=routeplanner
DB_USER=routeplanner
DB_PASSWORD=your_secure_password
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
EOF

# Start backend with PM2
pm2 start npm --name "routeplanner-backend" -- start

# Frontend setup
cd ../
npm install
npm run build

# Serve frontend with PM2
pm2 serve dist 8080 --name "routeplanner-frontend"

# Save PM2 configuration
pm2 save
pm2 startup
```

### 4. Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/routeplanner

# Add configuration:
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/routeplanner /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. SSL Setup (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📱 Progressive Web App (PWA) Setup

To make your app installable like a native mobile app:

### 1. Add PWA Manifest
```json
// public/manifest.json
{
  "name": "Route Planner Pro",
  "short_name": "RoutePlanner",
  "description": "Professional delivery route planning",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#667eea",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png", 
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 2. Add Service Worker
```javascript
// public/sw.js
const CACHE_NAME = 'routeplanner-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

## 🔐 Security Considerations

### 1. Environment Variables
- Never commit API keys to version control
- Use different keys for development/production
- Rotate keys regularly

### 2. Database Security
- Use strong passwords
- Enable SSL connections
- Regular backups
- Limit database access

### 3. Application Security
- Implement rate limiting
- Input validation
- CORS configuration
- HTTPS only in production

## 💾 Backup Strategy

### Automated Backups
```bash
# Create backup script
cat > /home/ubuntu/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U routeplanner routeplanner > /backup/routeplanner_$DATE.sql
# Keep only last 30 days
find /backup -name "routeplanner_*.sql" -mtime +30 -delete
EOF

chmod +x /home/ubuntu/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /home/ubuntu/backup-db.sh" | crontab -
```

## 📊 Monitoring & Maintenance

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# Log monitoring
pm2 logs

# System resources
htop
df -h
```

### 2. Update Process
```bash
# Update application
git pull origin main
cd backend && npm install && npm run build
pm2 restart routeplanner-backend

cd ../ && npm install && npm run build
pm2 restart routeplanner-frontend
```

## 💰 Cost Breakdown

### Self-Hosted Option (~$8-15/month):
- **VPS**: $6-12/month (2GB RAM, 50GB storage)
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)
- **Google Maps API**: $0-200/month (depending on usage)

### Cloud Platform (~$15-30/month):
- **Hosting**: $7-15/month
- **Database**: $5-10/month  
- **Domain**: $10-15/year
- **CDN**: $0-5/month

## 🚀 Performance Optimization

### 1. Database Optimization
- Enable query caching
- Add proper indexes
- Regular VACUUM (PostgreSQL)

### 2. Application Optimization  
- Enable gzip compression
- Use CDN for static assets
- Implement API caching
- Database connection pooling

### 3. Frontend Optimization
- Bundle splitting
- Lazy loading
- Service worker caching
- Image optimization

## 📞 Support & Maintenance

### Regular Tasks:
- **Weekly**: Check logs and performance
- **Monthly**: Update dependencies
- **Quarterly**: Security audit and backup testing

This deployment replaces your mobile app subscription with a self-hosted solution that you fully control!