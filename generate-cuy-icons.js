import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateCuyIcons() {
  const sourceImage = path.join(__dirname, 'public', 'cuy_icon.png');
  const publicDir = path.join(__dirname, 'public');
  
  // Verificar que el archivo fuente existe
  if (!fs.existsSync(sourceImage)) {
    console.error('❌ Archivo cuy_icon.png no encontrado en:', sourceImage);
    return;
  }

  const iconSizes = [
    { size: 144, filename: 'pwa-144x144.png', name: '144x144' },
    { size: 192, filename: 'pwa-192x192.png', name: '192x192' },
    { size: 512, filename: 'pwa-512x512.png', name: '512x512' },
    { size: 192, filename: 'icon-192.png', name: '192x192 (backup)' }
  ];

  console.log('🖼️  Generando iconos PWA desde cuy_icon.png...');

  for (const { size, filename, name } of iconSizes) {
    try {
      const outputPath = path.join(publicDir, filename);
      
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // Fondo transparente
        })
        .png({
          quality: 90,
          compressionLevel: 6
        })
        .toFile(outputPath);
        
      console.log(`✅ ${filename} (${name}) generado exitosamente`);
    } catch (error) {
      console.error(`❌ Error generando ${filename}:`, error.message);
    }
  }

  // También crear un favicon.ico alternativo (PNG)
  try {
    const faviconPath = path.join(publicDir, 'favicon.png');
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);
    
    console.log('✅ favicon.png (32x32) generado exitosamente');
  } catch (error) {
    console.error('❌ Error generando favicon.png:', error.message);
  }
  
  console.log('🎉 ¡Todos los iconos Cuy generados exitosamente!');
}

generateCuyIcons().catch(console.error);
