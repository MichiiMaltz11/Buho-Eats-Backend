/**
 * Migración: Agregar columna profile_photo a la tabla users
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'buho-eats.db');
const db = new Database(dbPath);

try {
    console.log('Iniciando migración: agregar profile_photo a users...');
    
    // Verificar si la columna ya existe
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasColumn = tableInfo.some(col => col.name === 'profile_photo');
    
    if (hasColumn) {
        console.log('✅ La columna profile_photo ya existe');
    } else {
        // Agregar la columna
        db.prepare('ALTER TABLE users ADD COLUMN profile_photo TEXT').run();
        console.log('✅ Columna profile_photo agregada exitosamente');
    }
    
    // Verificar que se agregó correctamente
    const updatedTableInfo = db.prepare("PRAGMA table_info(users)").all();
    console.log('\nColumnas de la tabla users:');
    updatedTableInfo.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });
    
    db.close();
    console.log('\n✅ Migración completada con éxito');
    
} catch (error) {
    console.error('❌ Error en la migración:', error.message);
    db.close();
    process.exit(1);
}
