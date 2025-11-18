/**
 * Configuración de Variables de Entorno
 * Carga y valida las variables de entorno necesarias para la aplicación
 */

const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    
    if (!fs.existsSync(envPath)) {
        console.error('Archivo .env no encontrado');
        process.exit(1);
    }

    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');

    lines.forEach(line => {
        line = line.trim();
        
        // Ignorar líneas vacías y comentarios
        if (!line || line.startsWith('#')) {
            return;
        }

        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();

        if (key && value) {
            process.env[key.trim()] = value;
        }
    });
}

// Validar que las variables requeridas existan
function validateEnv() {
    const required = [
        'PORT',
        'JWT_SECRET',
        'JWT_EXPIRATION',
        'DB_PATH',
        'MAX_LOGIN_ATTEMPTS',
        'LOCKOUT_DURATION',
        'BCRYPT_ROUNDS'
    ];

    const missing = [];

    required.forEach(key => {
        if (!process.env[key]) {
            missing.push(key);
        }
    });

    if (missing.length > 0) {
        console.error('Variables de entorno faltantes:', missing.join(', '));
        process.exit(1);
    }
}

// Obtener configuración
function getConfig() {
    return {
        port: parseInt(process.env.PORT) || 3000,
        jwt: {
            secret: process.env.JWT_SECRET,
            expiration: process.env.JWT_EXPIRATION || '2h'
        },
        database: {
            path: process.env.DB_PATH || './database/buho-eats.db'
        },
        security: {
            maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
            lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 900000, // 15 min
            bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
            sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 1800000 // 30 min
        },
        cors: {
            allowedOrigins: process.env.ALLOWED_ORIGINS ? 
                process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : 
                ['http://localhost:8000']
        },
        logging: {
            level: process.env.LOG_LEVEL || 'info'
        }
    };
}

// Inicializar
loadEnv();
validateEnv();

module.exports = getConfig();
