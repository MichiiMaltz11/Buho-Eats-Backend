/**
 * Configuración de Base de Datos
 * Maneja la conexión a SQLite usando better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./env');

let db = null;

/**
 * Inicializa la conexión a la base de datos
 */
function initDatabase() {
    try {
        const dbPath = path.resolve(config.database.path);
        const dbDir = path.dirname(dbPath);

        // Crear directorio si no existe
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Conectar a la base de datos
        db = new Database(dbPath, {
            verbose: config.logging.level === 'debug' ? console.log : null
        });

        // Habilitar foreign keys
        db.pragma('foreign_keys = ON');

        console.log('Base de datos conectada:', dbPath);
        return db;
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
        process.exit(1);
    }
}

/**
 * Obtiene la instancia de la base de datos
 */
function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

/**
 * Cierra la conexión a la base de datos
 */
function closeDatabase() {
    if (db) {
        db.close();
        console.log('Base de datos cerrada');
    }
}

/**
 * Ejecuta un query de forma segura con parámetros
 */
function query(sql, params = []) {
    const database = getDatabase();
    
    try {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            return database.prepare(sql).all(params);
        } else {
            return database.prepare(sql).run(params);
        }
    } catch (error) {
        console.error('Error en query:', error.message);
        throw error;
    }
}

/**
 * Ejecuta una transacción
 */
function transaction(callback) {
    const database = getDatabase();
    const trans = database.transaction(callback);
    return trans();
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase,
    query,
    transaction
};
