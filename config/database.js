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
 * Ejecutar migraciones desde init.sql
 */
function runMigrations(database) {
    try {
        const sqlPath = path.join(__dirname, '..', 'database', 'init.sql');

        if (!fs.existsSync(sqlPath)) {
            console.error('❌ No existe el archivo init.sql');
            return;
        }

        const initSQL = fs.readFileSync(sqlPath, 'utf8');

        database.exec(initSQL);

        console.log('✅ Migraciones ejecutadas correctamente (init.sql)');
    } catch (error) {
        console.error('❌ Error ejecutando init.sql:', error.message);
    }
}

/**
 * Inicializar la base de datos
 */
function initDatabase() {
    try {
        const dbPath = path.resolve(config.database.path);
        const dbDir = path.dirname(dbPath);

        // Crear directorio si no existe
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        db = new Database(dbPath, {
            verbose: config.logging.level === 'debug' ? console.log : null
        });

        db.pragma('foreign_keys = ON');

        console.log('Base de datos conectada:', dbPath);

        // Ejecutar migraciones
        runMigrations(db);

        return db;
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
        process.exit(1);
    }
}

/**
 * Obtener la instancia de la base
 */
function getDatabase() {
    if (!db) return initDatabase();
    return db;
}

/**
 * Query seguro
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
 * Transacciones
 */
function transaction(callback) {
    const database = getDatabase();
    const trans = database.transaction(callback);
    return trans();
}

/**
 * Cerrar DB
 */
function closeDatabase() {
    if (db) {
        db.close();
        console.log('Base de datos cerrada');
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    query,
    transaction,
    closeDatabase,
};

