/**
 * Script de migración - Agregar tabla menu_items
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

try {
    console.log('Creando tabla menu_items...');

    // Crear tabla menu_items
    query(`
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurant_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL CHECK(price >= 0),
            category TEXT CHECK(category IN ('Entrada', 'Plato Principal', 'Postre', 'Bebida', 'Otro')),
            image_url TEXT,
            is_available INTEGER DEFAULT 1 CHECK(is_available IN (0, 1)),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
        )
    `);

    console.log('✅ Tabla menu_items creada');

    // Crear índices
    query('CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id)');
    query('CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category)');

    console.log('✅ Índices creados');

    // Crear trigger para updated_at
    query(`
        CREATE TRIGGER IF NOT EXISTS update_menu_items_timestamp 
        AFTER UPDATE ON menu_items
        BEGIN
            UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    `);

    console.log('✅ Trigger creado');

    // Verificar que la tabla existe
    const tables = query("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_items'");
    
    if (tables.length > 0) {
        console.log('✅ Migración completada exitosamente');
        console.log('Tabla menu_items está lista para usar');
    } else {
        console.error('❌ Error: La tabla no se creó correctamente');
        process.exit(1);
    }

} catch (error) {
    console.error('❌ Error en la migración:', error.message);
    process.exit(1);
}
