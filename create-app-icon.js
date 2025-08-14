import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createWindowsIcon() {
  const sourceImage = path.join(__dirname, 'public', 'cuy_icon.png');
  const iconPath = path.join(__dirname, 'public', 'app-icon.ico');
  
  try {
    // Crear un ICO de múltiples tamaños
    const sizes = [16, 32, 48, 64, 128, 256];
    const buffers = [];
    
    for (const size of sizes) {
      const buffer = await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      buffers.push(buffer);
    }
    
    console.log('✅ Iconos ICO creados para Windows');
    
    // También crear una versión de 256x256 PNG optimizada para Electron
    await sharp(sourceImage)
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png({
        quality: 90,
        compressionLevel: 6
      })
      .toFile(path.join(__dirname, 'public', 'app-icon-256.png'));
    
    console.log('✅ Icono de aplicación 256x256 creado');
    
  } catch (error) {
    console.error('❌ Error creando iconos:', error);
  }
}

createWindowsIcon();
