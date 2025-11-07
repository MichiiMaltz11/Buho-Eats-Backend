/**
 * Controller para manejo de uploads de imágenes
 * Sistema Base64 sin Multer
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Tipos de imagen permitidos
 */
const ALLOWED_TYPES = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
};

/**
 * Tamaño máximo de imagen (5MB en bytes)
 */
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validar formato de imagen Base64
 */
function validateBase64Image(base64String) {
    // Verificar formato: data:image/tipo;base64,datos
    const regex = /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/;
    const matches = base64String.match(regex);
    
    if (!matches) {
        return {
            valid: false,
            error: 'Formato de imagen inválido. Use: data:image/tipo;base64,datos'
        };
    }
    
    const imageType = matches[1];
    const base64Data = matches[2];
    
    // Verificar tipo permitido
    const mimeType = `image/${imageType}`;
    if (!ALLOWED_TYPES[mimeType]) {
        return {
            valid: false,
            error: `Tipo de imagen no permitido. Permitidos: ${Object.keys(ALLOWED_TYPES).join(', ')}`
        };
    }
    
    // Verificar tamaño aproximado (Base64 es ~33% más grande que el original)
    const estimatedSize = (base64Data.length * 3) / 4;
    if (estimatedSize > MAX_SIZE) {
        return {
            valid: false,
            error: `Imagen demasiado grande. Máximo: ${MAX_SIZE / (1024 * 1024)}MB`
        };
    }
    
    return {
        valid: true,
        mimeType,
        extension: ALLOWED_TYPES[mimeType],
        base64Data
    };
}

/**
 * Generar nombre único para archivo
 */
function generateUniqueFilename(userId, extension) {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    return `user_${userId}_${timestamp}_${randomHash}.${extension}`;
}

/**
 * Guardar imagen desde Base64
 * POST /api/upload/image
 */
async function uploadImage(req, body) {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.id) {
            return {
                success: false,
                statusCode: 401,
                error: 'Usuario no autenticado'
            };
        }
        
        // Verificar que se envió la imagen
        if (!body.image) {
            return {
                success: false,
                statusCode: 400,
                error: 'Campo "image" requerido (Base64)'
            };
        }
        
        // Validar formato Base64
        const validation = validateBase64Image(body.image);
        if (!validation.valid) {
            return {
                success: false,
                statusCode: 400,
                error: validation.error
            };
        }
        
        // Generar nombre único
        const filename = generateUniqueFilename(req.user.id, validation.extension);
        
        // Crear directorio si no existe
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Ruta completa del archivo
        const filepath = path.join(uploadDir, filename);
        
        // Convertir Base64 a Buffer y guardar
        const imageBuffer = Buffer.from(validation.base64Data, 'base64');
        fs.writeFileSync(filepath, imageBuffer);
        
        // Retornar URL relativa
        const imageUrl = `/uploads/${filename}`;
        
        return {
            success: true,
            statusCode: 200,
            data: {
                url: imageUrl,
                filename: filename,
                size: imageBuffer.length,
                mimeType: validation.mimeType
            }
        };
        
    } catch (error) {
        console.error('Error al subir imagen:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error al procesar la imagen'
        };
    }
}

/**
 * Eliminar imagen
 * DELETE /api/upload/image/:filename
 */
async function deleteImage(req, filename) {
    try {
        // Verificar autenticación
        if (!req.user || !req.user.id) {
            return {
                success: false,
                statusCode: 401,
                error: 'Usuario no autenticado'
            };
        }
        
        // Verificar que el filename sea seguro (no permita ../../../etc)
        if (!filename || filename.includes('..') || filename.includes('/')) {
            return {
                success: false,
                statusCode: 400,
                error: 'Nombre de archivo inválido'
            };
        }
        
        // Ruta completa del archivo
        const filepath = path.join(__dirname, '..', 'public', 'uploads', filename);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(filepath)) {
            return {
                success: false,
                statusCode: 404,
                error: 'Imagen no encontrada'
            };
        }
        
        // Solo permitir borrar si el archivo pertenece al usuario
        // El formato es: user_{userId}_{timestamp}_{hash}.ext
        const fileUserId = filename.split('_')[1];
        if (fileUserId !== req.user.id.toString() && req.user.role !== 'admin') {
            return {
                success: false,
                statusCode: 403,
                error: 'No tienes permisos para eliminar esta imagen'
            };
        }
        
        // Eliminar archivo
        fs.unlinkSync(filepath);
        
        return {
            success: true,
            statusCode: 200,
            message: 'Imagen eliminada correctamente'
        };
        
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error al eliminar la imagen'
        };
    }
}

module.exports = {
    uploadImage,
    deleteImage
};
