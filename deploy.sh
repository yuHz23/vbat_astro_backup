#!/bin/bash
# Deploy VDG_astro_2 to server 147.93.157.156

SERVER="root@147.93.157.156"
KEY="~/.ssh/id_ed25519"
REMOTE_DIR="/root/VDG_astro_2/VDG_VangBacAnThinh_website"

echo "=== Deploying VDG_astro_2 to server ==="

# 1. Upload backend source
echo "[1/8] Uploading backend..."
scp -i $KEY -r ./VDG_VangBacAnThinh_website/backend/src $SERVER:$REMOTE_DIR/backend/
scp -i $KEY -r ./VDG_VangBacAnThinh_website/backend/config $SERVER:$REMOTE_DIR/backend/
scp -i $KEY ./VDG_VangBacAnThinh_website/backend/package.json $SERVER:$REMOTE_DIR/backend/
scp -i $KEY ./VDG_VangBacAnThinh_website/backend/package-lock.json $SERVER:$REMOTE_DIR/backend/ 2>/dev/null
scp -i $KEY ./VDG_VangBacAnThinh_website/backend/tsconfig.json $SERVER:$REMOTE_DIR/backend/

# 2. Upload frontend source
echo "[2/8] Uploading frontend..."
scp -i $KEY -r ./VDG_VangBacAnThinh_website/frontend/src $SERVER:$REMOTE_DIR/frontend/
scp -i $KEY -r ./VDG_VangBacAnThinh_website/frontend/public $SERVER:$REMOTE_DIR/frontend/
scp -i $KEY ./VDG_VangBacAnThinh_website/frontend/package.json $SERVER:$REMOTE_DIR/frontend/
scp -i $KEY ./VDG_VangBacAnThinh_website/frontend/package-lock.json $SERVER:$REMOTE_DIR/frontend/ 2>/dev/null
scp -i $KEY ./VDG_VangBacAnThinh_website/frontend/astro.config.mjs $SERVER:$REMOTE_DIR/frontend/
scp -i $KEY ./VDG_VangBacAnThinh_website/frontend/tsconfig.json $SERVER:$REMOTE_DIR/frontend/

# 3. Upload admin portal
echo "[3/8] Uploading admin portal..."
ssh -i $KEY $SERVER "mkdir -p $REMOTE_DIR/admin/src $REMOTE_DIR/admin/public"
scp -i $KEY -r ./VDG_VangBacAnThinh_website/admin/src $SERVER:$REMOTE_DIR/admin/
scp -i $KEY -r ./VDG_VangBacAnThinh_website/admin/public $SERVER:$REMOTE_DIR/admin/
scp -i $KEY ./VDG_VangBacAnThinh_website/admin/package.json $SERVER:$REMOTE_DIR/admin/
scp -i $KEY ./VDG_VangBacAnThinh_website/admin/astro.config.mjs $SERVER:$REMOTE_DIR/admin/

# 4. Upload root workspace package.json
echo "[4/8] Uploading workspace config..."
scp -i $KEY ./VDG_VangBacAnThinh_website/package.json $SERVER:$REMOTE_DIR/
scp -i $KEY ./VDG_VangBacAnThinh_website/package-lock.json $SERVER:$REMOTE_DIR/ 2>/dev/null

# 5. Install dependencies
echo "[5/8] Installing dependencies..."
ssh -i $KEY $SERVER "cd $REMOTE_DIR && npm install"

# 6. Build backend
echo "[6/8] Building backend..."
ssh -i $KEY $SERVER "cd $REMOTE_DIR/backend && npm run build"

# 7. Ensure uploads dir exists
echo "[7/8] Ensuring uploads directory..."
ssh -i $KEY $SERVER "mkdir -p $REMOTE_DIR/backend/public/uploads"

# 8. Update start script
echo "[8/8] Updating start script..."
ssh -i $KEY $SERVER "cat > /root/start-vdg2.sh << 'SCRIPT'
#!/bin/bash
export FNM_PATH=\"/root/.local/share/fnm\"
export PATH=\"\$FNM_PATH:\$PATH\"
eval \"\$(fnm env --shell bash)\"
fnm use 22

cd /root/VDG_astro_2/VDG_VangBacAnThinh_website

# Kill old processes
if [ -f /tmp/strapi2.pid ]; then kill \$(cat /tmp/strapi2.pid) 2>/dev/null; fi
if [ -f /tmp/astro2.pid ]; then kill \$(cat /tmp/astro2.pid) 2>/dev/null; fi
if [ -f /tmp/admin2.pid ]; then kill \$(cat /tmp/admin2.pid) 2>/dev/null; fi
sleep 2

# Start backend (Strapi)
cd backend
npm run develop > /tmp/strapi2.log 2>&1 &
STRAPI_PID=\$!
echo \"\$STRAPI_PID\" > /tmp/strapi2.pid
echo \"Strapi PID: \$STRAPI_PID\"

# Wait for Strapi to be ready
echo \"Waiting for Strapi...\"
for i in \$(seq 1 60); do
  if curl -s http://localhost:1337 > /dev/null 2>&1; then
    echo \"Strapi ready!\"
    break
  fi
  sleep 2
done

# Start frontend (port 3330)
cd ../frontend
npx astro dev --port 3330 --host 0.0.0.0 > /tmp/astro2.log 2>&1 &
ASTRO_PID=\$!
echo \"\$ASTRO_PID\" > /tmp/astro2.pid
echo \"Frontend PID: \$ASTRO_PID (port 3330)\"

# Start admin portal (port 3331)
cd ../admin
npx astro dev --port 3331 --host 0.0.0.0 > /tmp/admin2.log 2>&1 &
ADMIN_PID=\$!
echo \"\$ADMIN_PID\" > /tmp/admin2.pid
echo \"Admin PID: \$ADMIN_PID (port 3331)\"

echo \"Done! Strapi:1337, Frontend:3330, Admin:3331\"
SCRIPT
chmod +x /root/start-vdg2.sh"

echo ""
echo "=== Deploy complete! ==="
echo "SSH into server and restart:"
echo "  /root/start-vdg2.sh"
echo ""
echo "Services:"
echo "  Frontend: http://147.93.157.156:3330"
echo "  Admin:    http://147.93.157.156:3331"
echo "  Strapi:   http://147.93.157.156:1337"
