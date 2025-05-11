import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configura Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadImage = async (
  file: Express.Multer.File,
  folder: 'marketplace-products' | 'user-profiles'
): Promise<string> => {
  try {
    // Verificar que el archivo existe
    if (!file) {
      throw new Error('No se proporcionó archivo');
    }

    // Crear un stream de lectura desde el buffer
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null); // Indica el final del stream

    // Crear transform stream con Sharp
    const transformStream = sharp()
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 });

    // Subir a Cloudinary usando streams
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error('Error al subir la imagen a Cloudinary'));
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error('No se recibió respuesta de Cloudinary'));
          }
        }
      );

      // Pipe the streams
      bufferStream
        .pipe(transformStream)
        .pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error en uploadImage:', error);
    throw new Error(`Error al procesar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};