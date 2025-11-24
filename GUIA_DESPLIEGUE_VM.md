# 🚀 Guía de Despliegue en VM Ubuntu Server - Buho Eats

## ⚠️ IMPORTANTE: VM SIN INTERNET

Esta VM **NO tendrá acceso a Internet** durante desarrollo y evaluación, por lo que:
- ✅ Todo se descarga PRIMERO en tu máquina Windows
- ✅ Se transfiere a la VM mediante carpetas compartidas o SCP local
- ✅ No se usa `apt install`, `npm install` ni `git clone` desde la VM
- ✅ Todos los paquetes .deb y dependencias se descargan previamente

---

## 📋 Requisitos Previos

### VM Configurada
- ✅ Ubuntu Server (20.04 LTS o superior) **SIN Internet**
- ✅ Mínimo 2GB RAM
- ✅ 20GB de disco
- ✅ Acceso por consola o SSH en red local
- ✅ Carpeta compartida con máquina host (recomendado)

### Máquina Host (Windows)
- ✅ Acceso a Internet para descargar todo
- ✅ VirtualBox/VMware con carpetas compartidas
- ✅ O acceso SSH local a la VM

---

## 📦 PASO 1: Preparación en tu Máquina Windows (CON Internet)

### 1.1 Descargar Node.js para Ubuntu

```powershell
# Desde PowerShell en Windows:

# Crear directorio de transferencia
New-Item -ItemType Directory -Path "C:\VM-Transfer\buho-eats" -Force
cd "C:\VM-Transfer\buho-eats"

# Descargar Node.js 18 LTS para Linux (archivo .tar.xz)
# Ir a: https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz
# O usar curl:
curl -o node-v18.19.0-linux-x64.tar.xz https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz
```

### 1.2 Preparar Código Fuente

```powershell
# Copiar tu código al directorio de transferencia
Copy-Item -Recurse "C:\Users\alima\OneDrive\Escritorio\Buho-Eats-Backend" "C:\VM-Transfer\buho-eats\backend"
Copy-Item -Recurse "C:\Users\alima\OneDrive\Escritorio\Buho-Eats-Frontend" "C:\VM-Transfer\buho-eats\frontend"

# Instalar dependencias del backend (en Windows, para luego copiar node_modules)
cd "C:\VM-Transfer\buho-eats\backend"
npm install

# Verificar que se instaló todo
ls node_modules
# Debe mostrar: bcryptjs, better-sqlite3, jsonwebtoken, etc.
```

### 1.3 Descargar Paquetes .deb de Ubuntu

**Opción A: En otra VM con Internet** (recomendado)
```bash
# En una VM temporal Ubuntu CON Internet:

# Crear directorio
mkdir -p ~/packages
cd ~/packages

# Descargar paquetes y sus dependencias
apt download nginx
apt download sqlite3
apt download build-essential

# Descargar dependencias de nginx
apt-cache depends nginx | grep Depends | cut -d: -f2 | xargs apt download

# Comprimir todo
tar -czf ubuntu-packages.tar.gz *.deb

# Copiar a tu Windows
# (usar carpeta compartida o SCP)
```

**Opción B: Descargar manualmente** (más simple)
```powershell
# Ir a packages.ubuntu.com y descargar:
# - nginx_*.deb
# - sqlite3_*.deb
# - build-essential_*.deb (si necesitas compilar)

# Guardar en: C:\VM-Transfer\buho-eats\packages\
```

### 1.4 Descargar PM2 (Node Package)

```powershell
# Ya está incluido en node_modules si lo instalas globalmente
# Pero mejor incluirlo localmente:

cd "C:\VM-Transfer\buho-eats"
npm install pm2

# O descargar el tarball:
npm pack pm2
# Genera: pm2-X.X.X.tgz
```

---

## 🔧 PASO 2: Transferir a la VM (SIN Internet)

### Opción A: Carpeta Compartida de VirtualBox

```powershell
# En VirtualBox:
# 1. VM apagada → Settings → Shared Folders
# 2. Add shared folder:
#    - Folder Path: C:\VM-Transfer
#    - Folder Name: vm-transfer
#    - ✅ Auto-mount
#    - ✅ Make Permanent
```

```bash
# Dentro de la VM Ubuntu:
# La carpeta aparecerá en /media/sf_vm-transfer

# Dar permisos al usuario
sudo usermod -aG vboxsf $USER
# Reiniciar sesión o reiniciar VM

# Verificar acceso
ls /media/sf_vm-transfer
```

### Opción B: SCP en Red Local (sin Internet)

```powershell
# Desde Windows PowerShell:
# (Asumiendo que la VM tiene IP local 192.168.56.101)

scp -r "C:\VM-Transfer\buho-eats" usuario@192.168.56.101:/tmp/
```

---

## 🔧 PASO 3: Instalación en la VM (SIN Internet)

### 3.1 Instalar Node.js (SIN Internet)

```bash
# Desde la VM (usando archivos transferidos)

# Si usaste carpeta compartida:
cd /media/sf_vm-transfer/buho-eats
# Si usaste SCP:
cd /tmp/buho-eats

# Extraer Node.js
sudo mkdir -p /opt/nodejs
sudo tar -xJf node-v18.19.0-linux-x64.tar.xz -C /opt/nodejs --strip-components=1

# Crear enlaces simbólicos
sudo ln -s /opt/nodejs/bin/node /usr/local/bin/node
sudo ln -s /opt/nodejs/bin/npm /usr/local/bin/npm
sudo ln -s /opt/nodejs/bin/npx /usr/local/bin/npx

# Verificar instalación
node --version   # v18.19.0
npm --version    # 10.x.x
```

### 3.2 Instalar Paquetes del Sistema (SIN Internet)

```bash
# Si descargaste paquetes .deb:
cd /media/sf_vm-transfer/buho-eats/packages  # o /tmp/buho-eats/packages

# Instalar paquetes localmente
sudo dpkg -i nginx_*.deb
sudo dpkg -i sqlite3_*.deb

# Si hay dependencias faltantes (normalmente están en la ISO de Ubuntu):
# Puedes ignorarlas si nginx y sqlite3 funcionan

# Verificar instalación
nginx -v
sqlite3 --version
```

### 3.3 Crear Usuario Dedicado

```bash
# Crear usuario para la aplicación (sin privilegios de root)
sudo adduser --system --group --home /opt/buho-eats buho-eats

# Verificar
id buho-eats
# Salida: uid=XXX(buho-eats) gid=XXX(buho-eats) groups=XXX(buho-eats)
```

---

## 📁 PASO 4: Desplegar la Aplicación (SIN Internet)

### 4.1 Copiar el Código

```bash
# Copiar desde carpeta compartida o /tmp
sudo mkdir -p /opt/buho-eats

# Si usaste carpeta compartida:
sudo cp -r /media/sf_vm-transfer/buho-eats/backend /opt/buho-eats/
sudo cp -r /media/sf_vm-transfer/buho-eats/frontend /opt/buho-eats/

# Si usaste SCP:
sudo cp -r /tmp/buho-eats/backend /opt/buho-eats/
sudo cp -r /tmp/buho-eats/frontend /opt/buho-eats/

# Configurar permisos
sudo chown -R buho-eats:buho-eats /opt/buho-eats/

# Verificar que node_modules se copió con todo
ls /opt/buho-eats/backend/node_modules/
# Debe mostrar: bcryptjs, better-sqlite3, jsonwebtoken, pm2, etc.
```

### 4.2 NO hay npm install (ya viene con node_modules)

```bash
# ✅ NO HACER: npm install (requiere Internet)
# ✅ YA ESTÁ: node_modules fue copiado desde Windows

# Solo verificar que funcionan las dependencias
cd /opt/buho-eats/backend
node -e "console.log(require('bcryptjs'))" # Debe mostrar objeto
node -e "console.log(require('jsonwebtoken'))" # Debe mostrar objeto
```

### 4.3 Configurar Variables de Entorno

```bash
# Crear archivo .env
sudo -u buho-eats nano /opt/buho-eats/backend/.env

# Contenido del archivo .env:
```

```env
# Backend Configuration
NODE_ENV=production
PORT=3000

# JWT Secret (generar uno único)
JWT_SECRET=un_secret_muy_seguro_y_aleatorio_cambiar_esto_12345abcdef

# Database
DATABASE_PATH=/opt/buho-eats/backend/database/buho_eats.db

# Frontend URL (cambiar por IP de la VM, ej: 192.168.56.101)
FRONTEND_URL=http://192.168.56.101

# Logs
LOG_DIR=/var/log/buho-eats
```

```bash
# Guardar: Ctrl+O, Enter, Ctrl+X

# Configurar permisos (solo el usuario puede leer)
sudo chmod 600 /opt/buho-eats/backend/.env
```

**Generar JWT_SECRET seguro (opcional):**
```bash
# Generar secret aleatorio (si openssl está instalado)
openssl rand -hex 32
# Copiar el resultado y pegarlo en .env como JWT_SECRET
```

### 4.4 Inicializar la Base de Datos

```bash
cd /opt/buho-eats/backend

# Crear directorio de base de datos
sudo -u buho-eats mkdir -p database

# Ejecutar script de inicialización
sudo -u buho-eats node scripts/initDatabase.js

# Verificar que se creó la BD
ls -lh database/
# Debe mostrar: buho_eats.db

# Configurar permisos restrictivos
sudo chmod 700 /opt/buho-eats/backend/database
sudo chmod 600 /opt/buho-eats/backend/database/*.db
```

### 4.5 Crear Directorio de Logs

```bash
# Crear directorio de logs
sudo mkdir -p /var/log/buho-eats

# Dar permisos al usuario
sudo chown buho-eats:buho-eats /var/log/buho-eats
sudo chmod 750 /var/log/buho-eats
```

---

## 🔥 PASO 5: Configurar Firewall (UFW)

```bash
# Habilitar firewall
sudo ufw enable

# Reglas básicas
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH/Consola (IMPORTANTE: no te bloquees)
# Solo si usas SSH en red local
sudo ufw allow 22/tcp

# Permitir HTTP (puerto 80)
sudo ufw allow 80/tcp

# Permitir HTTPS (puerto 443) - opcional si usas SSL
sudo ufw allow 443/tcp

# NO abrir puerto 3000 (backend) - solo accesible internamente

# Verificar reglas
sudo ufw status numbered

# Salida esperada:
# Status: active
#      To                         Action      From
#      --                         ------      ----
# [ 1] 22/tcp                     ALLOW IN    Anywhere
# [ 2] 80/tcp                     ALLOW IN    Anywhere
# [ 3] 443/tcp                    ALLOW IN    Anywhere
```

---

## 🚀 PASO 6: Iniciar el Backend con PM2 (SIN Internet)

### 6.1 Configurar PM2

```bash
cd /opt/buho-eats/backend

# PM2 ya está en node_modules (no necesita npm install -g)
# Crear enlace simbólico para usarlo fácilmente
sudo ln -s /opt/buho-eats/backend/node_modules/.bin/pm2 /usr/local/bin/pm2

# Verificar
pm2 --version

# Crear archivo de configuración PM2
sudo -u buho-eats nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'buho-eats-backend',
    script: './server.js',
    cwd: '/opt/buho-eats/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/buho-eats/backend-error.log',
    out_file: '/var/log/buho-eats/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### 6.2 Iniciar el Backend

```bash
# Iniciar con PM2 como usuario buho-eats
sudo -u buho-eats pm2 start ecosystem.config.js

# Verificar que está corriendo
sudo -u buho-eats pm2 status

# Salida esperada:
# ┌─────┬──────────────────────┬─────────┬──────┐
# │ id  │ name                 │ status  │ cpu  │
# ├─────┼──────────────────────┼─────────┼──────┤
# │  0  │ buho-eats-backend    │ online  │ 0%   │
# └─────┴──────────────────────┴─────────┴──────┘

# Ver logs en tiempo real
sudo -u buho-eats pm2 logs buho-eats-backend

# Guardar configuración para auto-inicio
sudo -u buho-eats pm2 save

# Configurar inicio automático al reiniciar la VM
sudo env PATH=$PATH:/usr/local/bin pm2 startup systemd -u buho-eats --hp /opt/buho-eats
# Ejecutar el comando que PM2 te muestra
```

### 6.3 Probar el Backend

```bash
# Probar que responde
curl http://localhost:3000/health

# Salida esperada:
# {"status":"ok","timestamp":"2025-11-24T..."}
```

---

## 🌐 PASO 7: Configurar Nginx como Reverse Proxy

### 7.1 Verificar Nginx (ya instalado en paso 3.2)

```bash
# Verificar instalación
nginx -v
sudo systemctl status nginx

# Si no está activo, iniciarlo
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 7.2 Configurar el Frontend

```bash
# Copiar frontend a directorio de Nginx
sudo cp -r /opt/buho-eats/frontend /var/www/buho-eats-frontend

# Configurar permisos
sudo chown -R www-data:www-data /var/www/buho-eats-frontend
sudo chmod -R 755 /var/www/buho-eats-frontend

# Crear directorio para uploads
sudo mkdir -p /var/www/buho-eats-frontend/assets/img/restaurants/uploads
sudo chown -R www-data:www-data /var/www/buho-eats-frontend/assets/img/restaurants/uploads
```

### 7.3 Configurar Archivo de Nginx

```bash
# Crear configuración del sitio
sudo nano /etc/nginx/sites-available/buho-eats
```

```nginx
# Configuración de Buho Eats
server {
    listen 80;
    server_name _;  # Acepta cualquier IP/nombre

    # Frontend - Servir archivos estáticos
    location / {
        root /var/www/buho-eats-frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - Reverse proxy a Node.js
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Archivos subidos (imágenes de restaurantes)
    location /assets/img/restaurants/uploads/ {
        alias /opt/buho-eats/backend/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Headers de seguridad
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/buho-eats-access.log;
    error_log /var/log/nginx/buho-eats-error.log;

    # Limitar tamaño de uploads
    client_max_body_size 10M;
}
```

```bash
# Guardar: Ctrl+O, Enter, Ctrl+X

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/buho-eats /etc/nginx/sites-enabled/

# Deshabilitar sitio default
sudo rm /etc/nginx/sites-enabled/default

# Probar configuración
sudo nginx -t

# Si todo está OK, reiniciar Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 7.4 Actualizar Configuración del Frontend

**IMPORTANTE:** Esto se debe hacer ANTES de copiar el frontend a la VM.

```powershell
# En tu máquina Windows, editar:
# C:\VM-Transfer\buho-eats\frontend\assets\js\config.js

# Cambiar API_BASE_URL a ruta relativa:
```

```javascript
const CONFIG = {
    // Usar ruta relativa (funciona con cualquier IP)
    API_BASE_URL: '/api',
    
    // Resto de configuración...
    TOKEN_KEY: 'auth_token',
    USER_KEY: 'user_data',
    ITEMS_PER_PAGE: 10,
    SESSION_TIMEOUT: 30 * 60 * 1000
};
```

```powershell
# Guardar y volver a copiar a la VM si ya lo habías copiado
```

**Si ya copiaste el frontend a la VM, editarlo allí:**
```bash
sudo nano /var/www/buho-eats-frontend/assets/js/config.js
# Cambiar API_BASE_URL: '/api'
```

---

## 🔒 PASO 8: Configurar HTTPS con SSL (Opcional)

⚠️ **NOTA:** Sin Internet, solo puedes usar certificado autofirmado.

### Opción A: Certificado Autofirmado (Sin Internet)

```bash
# Crear certificado autofirmado
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/buho-eats.key \
    -out /etc/nginx/ssl/buho-eats.crt \
    -subj "/C=ES/ST=State/L=City/O=BuhoEats/CN=IP_DE_TU_VM"

# Configurar permisos
sudo chmod 600 /etc/nginx/ssl/buho-eats.key
sudo chmod 644 /etc/nginx/ssl/buho-eats.crt
```

```bash
# Actualizar configuración de Nginx
sudo nano /etc/nginx/sites-available/buho-eats
```

```nginx
# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name IP_DE_TU_VM;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name IP_DE_TU_VM;

    # Certificados SSL
    ssl_certificate /etc/nginx/ssl/buho-eats.crt;
    ssl_certificate_key /etc/nginx/ssl/buho-eats.key;

    # Configuración SSL segura
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Resto de la configuración (location /, /api/, etc.)
    # ... (copiar del paso 6.3)
}
```

```bash
# Reiniciar Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### Opción B: Let's Encrypt

❌ **NO DISPONIBLE sin Internet**. Let's Encrypt requiere conexión para validar el dominio.

---

## 🧪 PASO 9: Verificar el Despliegue

### 8.1 Verificar Backend

```bash
# Ver estado de PM2
sudo -u buho-eats pm2 status

# Ver logs
sudo -u buho-eats pm2 logs --lines 50

# Probar endpoint
curl http://localhost:3000/health
```

### 8.2 Verificar Frontend + Nginx

```bash
# Estado de Nginx
sudo systemctl status nginx

# Ver logs de Nginx
sudo tail -f /var/log/nginx/buho-eats-access.log
sudo tail -f /var/log/nginx/buho-eats-error.log

# Probar desde la VM
curl http://localhost/
curl http://localhost/api/health
```

### 9.3 Obtener IP de la VM

```bash
# Dentro de la VM, obtener la IP
ip addr show

# O más simple:
hostname -I

# Ejemplo de salida: 192.168.56.101
# Anotar esta IP para usarla desde tu máquina Windows
```

### 9.4 Probar desde tu Máquina Local (Windows)

```powershell
# Desde PowerShell en Windows:

# Probar conectividad
ping 192.168.56.101  # Reemplazar con tu IP

# Probar acceso HTTP (si tienes curl en Windows)
curl http://192.168.56.101
curl http://192.168.56.101/api/health

# O abrir en el navegador:
# http://192.168.56.101
```

### 9.5 Probar la Aplicación Completa

1. **Abrir navegador** en tu máquina Windows
2. **Ir a**: `http://192.168.56.101` (tu IP de VM)
3. **Registrar usuario**: Crear cuenta de prueba
4. **Iniciar sesión**: Verificar autenticación
5. **Probar funcionalidades**:
   - Ver restaurantes
   - Crear reseña
   - Marcar favoritos
   - Probar perfil

---

## 📊 PASO 10: Monitoreo y Mantenimiento

### 9.1 Ver Estado del Sistema

```bash
# Estado de servicios
sudo systemctl status nginx
sudo -u buho-eats pm2 status

# Uso de recursos
htop  # Instalar: sudo apt install htop

# Espacio en disco
df -h

# Logs del sistema
sudo journalctl -xe
```

### 9.2 Comandos Útiles de PM2

```bash
# Ver logs en tiempo real
sudo -u buho-eats pm2 logs

# Reiniciar aplicación
sudo -u buho-eats pm2 restart buho-eats-backend

# Detener aplicación
sudo -u buho-eats pm2 stop buho-eats-backend

# Ver información detallada
sudo -u buho-eats pm2 show buho-eats-backend

# Ver uso de recursos
sudo -u buho-eats pm2 monit
```

### 9.3 Backup de la Base de Datos

```bash
# Crear script de backup
sudo nano /opt/buho-eats/backup.sh
```

```bash
#!/bin/bash
# Backup de base de datos Buho Eats

BACKUP_DIR="/opt/buho-eats/backups"
DB_PATH="/opt/buho-eats/backend/database/buho_eats.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/buho_eats_$TIMESTAMP.db"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Hacer backup
sqlite3 $DB_PATH ".backup $BACKUP_FILE"

# Comprimir
gzip $BACKUP_FILE

# Mantener solo últimos 7 backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completado: $BACKUP_FILE.gz"
```

```bash
# Dar permisos de ejecución
sudo chmod +x /opt/buho-eats/backup.sh
sudo chown buho-eats:buho-eats /opt/buho-eats/backup.sh

# Probar backup
sudo -u buho-eats /opt/buho-eats/backup.sh

# Programar backup diario con cron
sudo -u buho-eats crontab -e

# Agregar línea:
0 2 * * * /opt/buho-eats/backup.sh >> /var/log/buho-eats/backup.log 2>&1
```

---

## 🔧 PASO 11: Troubleshooting (SIN Internet)

### Problema: Backend no inicia

```bash
# Ver logs detallados
sudo -u buho-eats pm2 logs buho-eats-backend --err

# Verificar puerto
sudo ss -tlnp | grep 3000
# O si netstat está disponible:
sudo netstat -tlnp | grep 3000

# Verificar permisos
ls -la /opt/buho-eats/backend/

# Probar manualmente
cd /opt/buho-eats/backend
sudo -u buho-eats node server.js

# Verificar dependencias
node -e "console.log(require('bcryptjs'))"
node -e "console.log(require('jsonwebtoken'))"
```

### Problema: Frontend no carga

```bash
# Ver logs de Nginx
sudo tail -n 50 /var/log/nginx/buho-eats-error.log

# Verificar permisos
ls -la /var/www/buho-eats-frontend/

# Probar configuración de Nginx
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Problema: No puedo acceder desde mi máquina local

```bash
# Verificar firewall
sudo ufw status

# Verificar que Nginx escucha en todas las interfaces
sudo netstat -tlnp | grep :80

# Verificar IP de la VM
ip addr show

# Hacer ping desde Windows
ping IP_DE_TU_VM
```

### Problema: Error de base de datos

```bash
# Verificar que existe la BD
ls -la /opt/buho-eats/backend/database/

# Verificar permisos
sudo chmod 600 /opt/buho-eats/backend/database/*.db
sudo chown buho-eats:buho-eats /opt/buho-eats/backend/database/*.db

# Reinicializar BD (CUIDADO: borra datos)
cd /opt/buho-eats/backend
sudo -u buho-eats node scripts/initDatabase.js
```

### Problema: node_modules no funciona

```bash
# Verificar arquitectura
uname -m  # Debe ser x86_64

# Si better-sqlite3 da error (compilado para otra arquitectura):
# Descargar versión pre-compilada correcta en Windows
# O usar SQLite3 puro sin better-sqlite3
```

---

## 📝 PASO 12: Checklist de Despliegue (SIN Internet)

### Pre-Despliegue (Windows CON Internet)
- [ ] Node.js descargado para Linux (.tar.xz)
- [ ] Código fuente con `npm install` ejecutado
- [ ] node_modules completo (backend)
- [ ] Paquetes .deb descargados (nginx, sqlite3)
- [ ] config.js modificado (API_BASE_URL: '/api')
- [ ] Todo copiado a C:\VM-Transfer\buho-eats\

### Transferencia a VM
- [ ] VM Ubuntu Server instalada (SIN Internet)
- [ ] Carpeta compartida configurada O acceso SSH local
- [ ] Archivos transferidos a /tmp/ o /media/sf_vm-transfer/

### Instalación en VM (SIN Internet)
- [ ] Node.js extraído a /opt/nodejs
- [ ] Enlaces simbólicos creados (node, npm, pm2)
- [ ] Nginx instalado desde .deb
- [ ] SQLite3 disponible

### Configuración
- [ ] Usuario `buho-eats` creado
- [ ] Código copiado a `/opt/buho-eats/`
- [ ] Dependencias instaladas (`npm install`)
- [ ] `.env` configurado con valores correctos
- [ ] Base de datos inicializada
- [ ] Directorio de logs creado

### Seguridad
- [ ] Firewall UFW configurado
- [ ] Permisos de archivos restrictivos (600/640/750)
- [ ] Usuario sin privilegios de root
- [ ] Variables de entorno protegidas
- [ ] HTTPS configurado (opcional)

### Servicios
- [ ] Backend iniciado con PM2
- [ ] PM2 configurado para auto-inicio
- [ ] Nginx configurado como reverse proxy
- [ ] Nginx habilitado y corriendo

### Verificación
- [ ] Backend responde en `localhost:3000/health`
- [ ] Frontend carga en `http://IP_VM/`
- [ ] API accesible en `http://IP_VM/api/health`
- [ ] Registro de usuario funciona
- [ ] Login funciona
- [ ] Funcionalidades básicas funcionan

### Mantenimiento
- [ ] Backups configurados
- [ ] Logs rotan correctamente
- [ ] Monitoreo activo

---

## 🎯 Resumen de Comandos Importantes

```bash
# Ver estado de todo
sudo systemctl status nginx
sudo -u buho-eats pm2 status
sudo ufw status

# Reiniciar servicios
sudo systemctl restart nginx
sudo -u buho-eats pm2 restart buho-eats-backend

# Ver logs
sudo -u buho-eats pm2 logs
sudo tail -f /var/log/nginx/buho-eats-error.log
sudo tail -f /var/log/buho-eats/backend-error.log

# Obtener IP de la VM
hostname -I

# Backup manual
sudo -u buho-eats /opt/buho-eats/backup.sh
```

---

## 📋 Diagrama de Arquitectura en VM

```
┌─────────────────────────────────────────────────────┐
│          Máquina Host (Windows)                     │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │    Navegador Web                              │  │
│  │    http://192.168.56.101                      │  │
│  └───────────────┬───────────────────────────────┘  │
│                  │                                   │
│                  │ Red NAT/Host-Only                │
└──────────────────┼───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│          VM Ubuntu Server (SIN Internet)             │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Firewall UFW                                  │ │
│  │  - Puerto 80 (HTTP) ✅                         │ │
│  │  - Puerto 443 (HTTPS) ✅                       │ │
│  │  - Puerto 3000 (Backend) ❌ (solo localhost)   │ │
│  └────────────────┬───────────────────────────────┘ │
│                   │                                  │
│  ┌────────────────▼───────────────────────────────┐ │
│  │  Nginx (Reverse Proxy)                        │ │
│  │  - Sirve frontend estático                     │ │
│  │  - Proxy /api/ → localhost:3000                │ │
│  └────────┬──────────────────┬────────────────────┘ │
│           │                  │                       │
│  ┌────────▼────────┐  ┌──────▼──────────────────┐  │
│  │  Frontend       │  │  Backend (Node.js)      │  │
│  │  /var/www/      │  │  PM2 → server.js        │  │
│  │  buho-eats-     │  │  Puerto: 3000           │  │
│  │  frontend/      │  │  Usuario: buho-eats     │  │
│  └─────────────────┘  └──────┬──────────────────┘  │
│                               │                      │
│                        ┌──────▼──────────────────┐  │
│                        │  SQLite Database        │  │
│                        │  /opt/buho-eats/        │  │
│                        │  backend/database/      │  │
│                        │  buho_eats.db           │  │
│                        └─────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 🚨 Consideraciones Importantes para VM SIN Internet

### ✅ Funcionará:
- ✅ Aplicación completa (frontend + backend)
- ✅ Base de datos SQLite
- ✅ Autenticación JWT
- ✅ Todas las funcionalidades de usuario/owner/admin
- ✅ Subida de imágenes
- ✅ PM2 para auto-restart
- ✅ Nginx como reverse proxy
- ✅ Firewall UFW

### ❌ NO funcionará (requiere Internet):
- ❌ `npm install` dentro de la VM
- ❌ `apt install` dentro de la VM
- ❌ Certificados Let's Encrypt
- ❌ CDNs externos (si los usas)
- ❌ Git clone dentro de la VM
- ❌ Actualizaciones automáticas

### 🔧 Soluciones:
- ✅ Preparar TODO en Windows primero
- ✅ Copiar node_modules completo
- ✅ Usar certificado autofirmado para HTTPS
- ✅ Usar Tailwind local (ya incluido en el proyecto)
- ✅ Transferir código via carpeta compartida o SCP

---

## 📞 Soporte y Resolución de Problemas

### Si encuentras problemas:

1. **Revisar logs**: PM2 y Nginx logs son esenciales
   ```bash
   sudo -u buho-eats pm2 logs
   sudo tail -f /var/log/nginx/buho-eats-error.log
   ```

2. **Verificar permisos**: 
   ```bash
   ls -la /opt/buho-eats/
   ls -la /opt/buho-eats/backend/database/
   ```

3. **Probar manualmente**:
   ```bash
   cd /opt/buho-eats/backend
   sudo -u buho-eats node server.js
   ```

4. **Verificar conectividad**:
   ```bash
   # En la VM:
   curl http://localhost:3000/health
   curl http://localhost/api/health
   
   # Desde Windows:
   curl http://192.168.56.101/api/health
   ```

5. **Verificar firewall**:
   ```bash
   sudo ufw status verbose
   sudo ss -tlnp | grep -E '(80|3000)'
   ```

---

## ✅ Checklist Final

Antes de presentar el proyecto, verificar:

- [ ] VM Ubuntu Server **SIN conexión a Internet** (desconectar adaptador de red)
- [ ] Aplicación accesible desde navegador host
- [ ] Login/registro funciona
- [ ] CRUD de reseñas funciona
- [ ] Dashboard de admin funciona
- [ ] Sistema de ban/strikes funciona
- [ ] Firewall UFW activo y configurado
- [ ] PM2 ejecutando el backend
- [ ] Nginx sirviendo frontend y proxy a backend
- [ ] Logs generándose correctamente
- [ ] Permisos de archivos restrictivos (600/640/750)
- [ ] Usuario dedicado `buho-eats` (sin privilegios de root)
- [ ] Base de datos con datos de prueba

---

**¡Listo!** 🎉 Tu aplicación Buho Eats está desplegada en VM Ubuntu Server **SIN Internet**, cumpliendo con todos los requisitos del proyecto. 🦉✨
