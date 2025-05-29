import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const backgroundsDir = path.join(process.cwd(), 'public/backgrounds');
    
    // Check if directory exists
    try {
      await fs.access(backgroundsDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(backgroundsDir, { recursive: true });
      return NextResponse.json({ images: [] });
    }
    
    const files = await fs.readdir(backgroundsDir);
    
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|webp|svg)$/i.test(file) && 
      !file.startsWith('.') &&
      !file.toLowerCase().includes('readme')
    );
    
    console.log(`Found ${imageFiles.length} background images:`, imageFiles);
    
    return NextResponse.json({ 
      images: imageFiles,
      total: imageFiles.length 
    });
  } catch (error) {
    console.error('Error reading backgrounds directory:', error);
    return NextResponse.json({ 
      images: [],
      error: 'Failed to read backgrounds directory'
    });
  }
}