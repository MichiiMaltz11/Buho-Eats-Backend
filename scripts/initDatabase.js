/**
 * Script de Inicialización de Base de Datos
 * Ejecuta el schema SQL para crear todas las tablas
 */

const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../config/database');

console.log('🔧 Inicializando base de datos...\n');

try {
    // Leer el archivo SQL
    const schemaPath = path.join(__dirname, '..', 'database', 'init.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Obtener conexión a la base de datos
    const db = getDatabase();

    // Ejecutar el schema completo
    // Split por ; para ejecutar cada statement individualmente
    const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`📝 Ejecutando ${statements.length} statements SQL...\n`);

    statements.forEach((statement, index) => {
        try {
            db.exec(statement);
            
            // Mostrar progreso para las operaciones importantes
            if (statement.includes('CREATE TABLE')) {
                const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
                console.log(`Tabla creada: ${tableName}`);
            } else if (statement.includes('CREATE INDEX')) {
                const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1];
                console.log(`Índice creado: ${indexName}`);
            } else if (statement.includes('CREATE TRIGGER')) {
                const triggerName = statement.match(/CREATE TRIGGER (?:IF NOT EXISTS )?(\w+)/i)?.[1];
                console.log(`Trigger creado: ${triggerName}`);
            } else if (statement.includes('INSERT')) {
                console.log(`Datos iniciales insertados`);
            }
        } catch (error) {
            console.error(`Error en statement ${index + 1}:`, error.message);
        }
    });

    // Verificar que las tablas se crearon correctamente
    const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all();

    console.log('\nTablas en la base de datos:');
    tables.forEach(table => {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        console.log(`   - ${table.name} (${count.count} registros)`);
    });

    console.log('\nBase de datos inicializada correctamente!');
    console.log('\nUsuario admin por defecto:');
    console.log('   Email: admin@buhoeats.com');
    console.log('   Password: Admin123!');
    console.log('   Rol: admin\n');

} catch (error) {
    console.error('Error al inicializar la base de datos:', error.message);
    process.exit(1);
}
