#!/usr/bin/env node
// Generate PWA icons for DKFlow
// Uses pure Node.js to create simple PNG icons

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function createPNG(size) {
  // Create a minimal valid PNG with a blue "D" on dark background
  // Using a simple approach: create SVG then note that we need sharp/canvas
  // For now, create a simple colored square PNG using raw bytes
  
  const { createCanvas } = (() => {
    try { return require('canvas'); } catch { return { createCanvas: null }; }
  })();

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Dark background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    
    // Blue gradient circle
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size*0.4);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size*0.38, 0, Math.PI * 2);
    ctx.fill();
    
    // White "D" letter
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.5)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('D', size/2, size/2 + size*0.02);
    
    return canvas.toBuffer('image/png');
  }
  
  // Fallback: create a minimal 1x1 blue PNG and scale concept
  // Actually, let's use sharp if available
  const sharp = (() => { try { return require('sharp'); } catch { return null; } })();
  
  if (sharp) {
    return null; // Will handle async
  }
  
  // Ultimate fallback: create SVG and convert
  return null;
}

async function generateWithSharp(size) {
  try {
    const sharp = require('sharp');
    const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#0f172a"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size*0.38}" fill="#3b82f6"/>
      <text x="${size/2}" y="${size/2}" font-family="Arial,sans-serif" font-weight="bold" 
            font-size="${Math.floor(size*0.5)}" fill="white" text-anchor="middle" dominant-baseline="central">D</text>
    </svg>`;
    
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `icon-${size}x${size}.png`));
    console.log(`✓ Generated ${size}x${size}`);
    return true;
  } catch(e) {
    return false;
  }
}

async function generateWithSvgFallback(size) {
  // Save as SVG, then use rsvg-convert or similar
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#0f172a"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size*0.38}" fill="#3b82f6"/>
    <text x="${size/2}" y="${size/2}" font-family="Arial,sans-serif" font-weight="bold" 
          font-size="${Math.floor(size*0.5)}" fill="white" text-anchor="middle" dominant-baseline="central">D</text>
  </svg>`;
  
  const svgPath = path.join(outDir, `icon-${size}x${size}.svg`);
  const pngPath = path.join(outDir, `icon-${size}x${size}.png`);
  
  fs.writeFileSync(svgPath, svg);
  
  // Try converting with available tools
  const { execSync } = require('child_process');
  
  try {
    execSync(`convert ${svgPath} ${pngPath} 2>/dev/null`);
    fs.unlinkSync(svgPath);
    console.log(`✓ Generated ${size}x${size} (ImageMagick)`);
    return true;
  } catch {}
  
  try {
    execSync(`rsvg-convert -w ${size} -h ${size} ${svgPath} -o ${pngPath} 2>/dev/null`);
    fs.unlinkSync(svgPath);
    console.log(`✓ Generated ${size}x${size} (rsvg)`);
    return true;
  } catch {}
  
  // Keep SVG as fallback
  console.log(`⚠ Saved ${size}x${size} as SVG (no PNG converter found)`);
  return false;
}

async function main() {
  console.log('Generating DKFlow PWA icons...\n');
  
  for (const size of sizes) {
    const buf = createPNG(size);
    if (buf) {
      fs.writeFileSync(path.join(outDir, `icon-${size}x${size}.png`), buf);
      console.log(`✓ Generated ${size}x${size} (canvas)`);
      continue;
    }
    
    const sharpOk = await generateWithSharp(size);
    if (sharpOk) continue;
    
    await generateWithSvgFallback(size);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
