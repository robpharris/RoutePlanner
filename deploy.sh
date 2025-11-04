#!/bin/bash

# Production Deployment Script for Route Planner
# This script sets up the application for production use

set -e  # Exit on any error

echo "🚀 Starting Route Planner Production Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="routeplanner"
DOMAIN="${1:-localhost}"
EMAIL="${2:-admin@example.com}"

echo -e "${YELLOW}Domain: $DOMAIN${NC}"
echo -e "${YELLOW}Email: $EMAIL${NC}"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}This script should not be run as root${NC}" 
   exit 1
fi

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Docker Compose is required but not installed${NC}"; exit 1; }

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p ssl backups logs

# Generate environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    
    # Generate secure passwords and secrets
    DB_PASSWORD=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > .env << EOF
# Generated on $(date)
DB_TYPE=postgresql
DB_HOST=database
DB_PORT=5432
DB_NAME=routeplanner
DB_USER=routeplanner
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://$DOMAIN
EOF
    
    echo -e "${GREEN}.env file created with secure passwords${NC}"
    echo -e "${YELLOW}Please update GOOGLE_MAPS_API_KEY in .env file${NC}"
else
    echo -e "${GREEN}.env file already exists${NC}"
fi

# Build and start services
echo -e "${YELLOW}Building and starting Docker services...${NC}"
docker-compose up -d --build

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 30

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}Services started successfully!${NC}"
else
    echo -e "${RED}Some services failed to start${NC}"
    docker-compose logs
    exit 1
fi

# Setup SSL certificate if domain is not localhost
if [ "$DOMAIN" != "localhost" ]; then
    echo -e "${YELLOW}Setting up SSL certificate...${NC}"
    
    # Check if certbot is installed
    if command -v certbot >/dev/null 2>&1; then
        # Request certificate
        sudo certbot certonly --standalone \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            -d $DOMAIN
        
        # Copy certificates
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/
        sudo chown $USER:$USER ssl/*.pem
        
        # Update nginx config for SSL
        cat > nginx-ssl.conf << 'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend:3001;
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
EOF
        
        sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx-ssl.conf > nginx.conf
        rm nginx-ssl.conf
        
        # Restart services with SSL
        docker-compose restart frontend
        
        echo -e "${GREEN}SSL certificate configured for $DOMAIN${NC}"
    else
        echo -e "${YELLOW}Certbot not found. SSL setup skipped.${NC}"
        echo -e "${YELLOW}Install certbot and run: sudo certbot --nginx -d $DOMAIN${NC}"
    fi
fi

# Setup backup cron job
echo -e "${YELLOW}Setting up automated backups...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && docker-compose exec -T database pg_dump -U routeplanner routeplanner > backups/backup_\$(date +\%Y\%m\%d_\%H\%M\%S).sql") | crontab -

# Create management scripts
echo -e "${YELLOW}Creating management scripts...${NC}"

# Backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T database pg_dump -U routeplanner routeplanner > backups/backup_$DATE.sql
echo "Backup created: backups/backup_$DATE.sql"

# Keep only last 30 days
find backups -name "backup_*.sql" -mtime +30 -delete
EOF

# Update script
cat > update.sh << 'EOF'
#!/bin/bash
echo "Pulling latest changes..."
git pull origin main

echo "Rebuilding services..."
docker-compose build --no-cache

echo "Restarting services..."
docker-compose up -d

echo "Update complete!"
EOF

# Status script
cat > status.sh << 'EOF'
#!/bin/bash
echo "=== Service Status ==="
docker-compose ps

echo -e "\n=== Resource Usage ==="
docker stats --no-stream

echo -e "\n=== Recent Logs ==="
docker-compose logs --tail=20
EOF

chmod +x backup.sh update.sh status.sh

# Display success information
echo -e "\n${GREEN}🎉 Route Planner deployed successfully!${NC}\n"

if [ "$DOMAIN" = "localhost" ]; then
    echo -e "Frontend: ${GREEN}http://localhost${NC}"
    echo -e "Backend API: ${GREEN}http://localhost:3001${NC}"
else
    echo -e "Frontend: ${GREEN}https://$DOMAIN${NC}"
    echo -e "Backend API: ${GREEN}https://$DOMAIN/api${NC}"
fi

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Update GOOGLE_MAPS_API_KEY in .env file"
echo "2. Test the application in your browser"
echo "3. Set up monitoring (optional)"
echo "4. Configure firewall rules"

echo -e "\n${YELLOW}Management Commands:${NC}"
echo "./backup.sh      - Create database backup"
echo "./update.sh      - Update application"
echo "./status.sh      - Check service status"
echo "docker-compose logs -f  - View live logs"

echo -e "\n${YELLOW}Environment File:${NC}"
echo "Your database password and JWT secret are in .env file"
echo "Keep this file secure and never commit it to version control"

echo -e "\n${GREEN}Deployment complete! 🚀${NC}"