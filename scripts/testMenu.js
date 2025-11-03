// Test del endpoint de menú
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/menu?restaurantId=1',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n=== Respuesta del servidor ===');
        console.log('Status Code:', res.statusCode);
        console.log('Datos:', data);
        try {
            const json = JSON.parse(data);
            console.log('\nJSON parseado:');
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('No es JSON válido');
        }
        process.exit(0);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
    process.exit(1);
});

req.end();
