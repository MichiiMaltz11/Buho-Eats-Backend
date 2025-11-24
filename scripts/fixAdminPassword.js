const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

async function fixPassword() {
    const db = new Database('./database/buho-eats.db');
    
    // Generar nuevo hash para Admin123!
    const newHash = await bcrypt.hash('Admin123!', 10);
    console.log('Nuevo hash generado:', newHash);
    
    // Actualizar en la base de datos
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(newHash, 'admin@buhoeats.com');
    
    // Verificar
    const user = db.prepare('SELECT email, password_hash FROM users WHERE email = ?').get('admin@buhoeats.com');
    console.log('\nUsuario:', user.email);
    console.log('Hash guardado:', user.password_hash);
    
    // Probar
    const match = await bcrypt.compare('Admin123!', user.password_hash);
    console.log('\nVerificación Admin123!:', match ? '✓ CORRECTO' : '✗ INCORRECTO');
    
    db.close();
}

fixPassword().catch(console.error);
