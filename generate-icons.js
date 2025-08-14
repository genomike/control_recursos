import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIcons() {
  const svgPath = path.join(__dirname, 'public', 'icon-192.svg');
  const publicDir = path.join(__dirname, 'public');
  
  // Verificar que el SVG existe
  if (!fs.existsSync(svgPath)) {
    console.error('SVG file not found:', svgPath);
    return;
  }

  const sizes = [
    { size: 144, filename: 'pwa-144x144.png' },
    { size: 192, filename: 'pwa-192x192.png' },
    { size: 512, filename: 'pwa-512x512.png' }
  ];

  console.log('Generating PNG icons from SVG...');

  for (const { size, filename } of sizes) {
    try {
      const outputPath = path.join(publicDir, filename);
      
      await sharp(svgPath)
        .resize(size, size)
        .png({
          quality: 90,
          compressionLevel: 6
        })
        .toFile(outputPath);
        
      console.log(`✓ Generated ${filename} (${size}x${size})`);
    } catch (error) {
      console.error(`✗ Error generating ${filename}:`, error.message);
    }
  }
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
