/**
 * Script para agregar elementos de menú de ejemplo
 */

const { query } = require('../config/database');

try {
    console.log('Agregando elementos de menú de ejemplo...\n');

    // Obtener los primeros 3 restaurantes
    const restaurants = query('SELECT id, name FROM restaurants WHERE is_active = 1 LIMIT 3');

    if (restaurants.length === 0) {
        console.log('No hay restaurantes en la base de datos');
        process.exit(1);
    }

    const menuData = [
        // Menú para restaurante italiano
        {
            restaurantId: restaurants[0].id,
            items: [
                { name: 'Bruschetta al Pomodoro', description: 'Pan tostado con tomate fresco, albahaca y aceite de oliva', price: 45.00, category: 'Entrada', imageUrl: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400' },
                { name: 'Ensalada Caprese', description: 'Tomate, mozzarella fresca, albahaca y vinagre balsámico', price: 65.00, category: 'Entrada', imageUrl: 'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=400' },
                { name: 'Pizza Margherita', description: 'Salsa de tomate, mozzarella fresca y albahaca', price: 120.00, category: 'Plato Principal', imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400' },
                { name: 'Pasta Carbonara', description: 'Pasta con huevo, queso pecorino, guanciale y pimienta negra', price: 135.00, category: 'Plato Principal', imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400' },
                { name: 'Lasagna Bolognesa', description: 'Capas de pasta con ragú de carne y salsa bechamel', price: 145.00, category: 'Plato Principal', imageUrl: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400' },
                { name: 'Tiramisú', description: 'Postre italiano con café, mascarpone y cacao', price: 75.00, category: 'Postre', imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400' },
                { name: 'Panna Cotta', description: 'Crema cocida con coulis de frutos rojos', price: 70.00, category: 'Postre', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400' },
                { name: 'Vino Tinto Chianti', description: 'Copa de vino tinto italiano', price: 85.00, category: 'Bebida', imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400' }
            ]
        }
    ];

    let totalAdded = 0;

    for (const menu of menuData) {
        console.log(`\nAgregando menú para: ${restaurants.find(r => r.id === menu.restaurantId)?.name}`);
        
        for (const item of menu.items) {
            try {
                query(`
                    INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [menu.restaurantId, item.name, item.description, item.price, item.category, item.imageUrl]);
                
                console.log(`  ✅ ${item.name} - $${item.price}`);
                totalAdded++;
            } catch (error) {
                console.log(`  ⚠️  ${item.name} - Ya existe o error`);
            }
        }
    }

    console.log(`\n✅ Total de elementos agregados: ${totalAdded}`);
    console.log('\nMenús de ejemplo agregados exitosamente!');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
