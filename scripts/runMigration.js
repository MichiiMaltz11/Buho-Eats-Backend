/**
 * Script para ejecutar migración de base de datos
 */
// Detectar qué archivo de BD está usando el servidor
const dbPath = process.env.DB_PATH || './database/buho-eats.db';
const db = require('better-sqlite3')(dbPath);
const fs = require('fs');
const path = require('path');

console.log('🔄 Ejecutando migración de base de datos...');
console.log(`📂 Usando: ${dbPath}\n`);

try {
    // Leer archivo SQL
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');
    
    // Ejecutar cada statement individualmente
    const statements = [
        // Agregar columna strikes
        "ALTER TABLE users ADD COLUMN strikes INTEGER DEFAULT 0",
        
        // Crear tabla review_reports
        `CREATE TABLE IF NOT EXISTS review_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL,
            reporter_id INTEGER NOT NULL,
            reason TEXT NOT NULL CHECK(reason IN ('spam', 'ofensivo', 'falso', 'inapropiado', 'otro')),
            description TEXT,
            status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'aprobado', 'rechazado')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            resolved_by INTEGER,
            FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
            FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
        )`,
        
        // Índices para review_reports
        "CREATE INDEX IF NOT EXISTS idx_review_reports_review ON review_reports(review_id)",
        "CREATE INDEX IF NOT EXISTS idx_review_reports_reporter ON review_reports(reporter_id)",
        "CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status)",
        
        // Crear tabla admin_audit
        `CREATE TABLE IF NOT EXISTS admin_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER,
            action TEXT NOT NULL,
            target_user_id INTEGER,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
        
        // Índices para admin_audit
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit(admin_id)",
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit(action)",
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit(target_user_id)",
        
        // Insertar admin de prueba (Password: Admin123!)
        `INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role, strikes, is_active)
         VALUES (1, 'Admin', 'Sistema', 'admin@buhoeats.com', '$2b$10$6OibciOQhNmJl0YgeFj9u.M8xeWF2XWAlHHRRY.SstjjHKfny6KYG', 'admin', 0, 1)`
    ];
    
    let executed = 0;
    let skipped = 0;
    
    for (const statement of statements) {
        try {
            db.exec(statement);
            executed++;
            console.log('✓ Ejecutado:', statement.substring(0, 60) + '...');
        } catch (error) {
            if (error.message.includes('duplicate column') || 
                error.message.includes('already exists')) {
                skipped++;
                console.log('⊘ Ya existe:', statement.substring(0, 60) + '...');
            } else {
                console.error('✗ Error:', error.message);
                console.error('  Statement:', statement.substring(0, 100));
            }
        }
    }
    
    console.log(`\n✅ Migración completada:`);
    console.log(`   - ${executed} statements ejecutados`);
    console.log(`   - ${skipped} statements omitidos (ya existían)`);
    
    // Verificar resultados
    console.log('\n📊 Verificando tablas:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const criticalTables = ['review_reports', 'admin_audit'];
    
    criticalTables.forEach(table => {
        const exists = tables.some(t => t.name === table);
        console.log(`   ${exists ? '✓' : '✗'} ${table}`);
    });
    
    console.log('\n📊 Verificando columnas de users:');
    const userCols = db.prepare('PRAGMA table_info(users)').all();
    const hasStrikes = userCols.some(col => col.name === 'strikes');
    console.log(`   ${hasStrikes ? '✓' : '✗'} columna 'strikes'`);
    
    db.close();
    console.log('\n✅ Base de datos lista para Owner y Admin\n');
    
} catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
}
