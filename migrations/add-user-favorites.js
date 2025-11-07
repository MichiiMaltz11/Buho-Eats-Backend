const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'buho-eats.db');
const db = new Database(dbPath);

console.log('🚀 Ejecutando migración: Agregar tabla user_favorites');

try {
    // Verificar si la tabla ya existe
    const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='user_favorites'
    `).get();

    if (tableExists) {
        console.log('⚠️  La tabla user_favorites ya existe');
    } else {
        // Crear tabla de favoritos
        db.exec(`
            CREATE TABLE user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                restaurant_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
                UNIQUE(user_id, restaurant_id)
            );
        `);

        console.log('✅ Tabla user_favorites creada exitosamente');

        // Crear índices para mejorar performance
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_favorites_user 
            ON user_favorites(user_id);
            
            CREATE INDEX IF NOT EXISTS idx_favorites_restaurant 
            ON user_favorites(restaurant_id);
        `);

        console.log('✅ Índices creados exitosamente');
    }

    // Mostrar estructura de la tabla
    const tableInfo = db.prepare('PRAGMA table_info(user_favorites)').all();
    console.log('\n📋 Estructura de user_favorites:');
    console.table(tableInfo);

    // Mostrar índices
    const indexes = db.prepare(`
        SELECT name, sql FROM sqlite_master 
        WHERE type='index' AND tbl_name='user_favorites'
    `).all();
    console.log('\n🔍 Índices de user_favorites:');
    console.table(indexes);

    db.close();
    console.log('\n✅ Migración completada exitosamente');

} catch (error) {
    console.error('❌ Error en la migración:', error.message);
    db.close();
    process.exit(1);
}
