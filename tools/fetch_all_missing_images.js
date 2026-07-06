import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = resolve(here, '../images');
const itemImagesPath = resolve(here, 'item-images.json');
const itemsJsonPath = resolve(here, '../items.json');

const foodCats = [
  'rice-grains',
  'flour-noodles',
  'pulses-legumes',
  'vegetables',
  'leafy-greens',
  'fruits',
  'fish-seafood',
  'meat-poultry',
  'dairy-eggs',
  'oils-fats',
  'spices-condiments',
  'snacks-bakery',
  'beverages',
  'frozen-packaged'
];

function getPrompt(item) {
  const isFood = foodCats.includes(item.categorySlug);
  const name = item.name.en.toLowerCase();
  
  if (isFood) {
    return `A clean, high-quality, professional food studio photograph of fresh raw ${name}, centered on a clean light gray background, 1:1 aspect ratio, square photo, minimalist food catalog shot`;
  } else {
    return `A clean, high-quality, professional product studio photograph of ${name}, centered on a clean light gray background, 1:1 aspect ratio, square photo, minimalist product catalog shot`;
  }
}

async function downloadWithRetry(item, index, total, imageMetadata, retries = 5) {
  const destPath = resolve(imagesDir, `${item.slug}.jpg`);
  const prompt = getPrompt(item);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&private=true&enhance=false`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[${index}/${total}] Generating image for ${item.slug} (attempt ${attempt})...`);
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      
      if (buffer.length < 5000) {
        throw new Error(`File too small (${buffer.length} bytes)`);
      }
      
      writeFileSync(destPath, buffer);
      
      imageMetadata[item.slug] = {
        url: `https://raw.githubusercontent.com/cbHasib/bazar-khata-data/main/images/${item.slug}.jpg`,
        license: 'CC0',
        attribution: 'Bazar Khata'
      };
      
      console.log(`[${index}/${total}] Successfully saved and mapped ${item.slug}.jpg (${Math.round(buffer.length / 1024)} KB)`);
      return true;
    } catch (err) {
      console.error(`[${index}/${total}] Attempt ${attempt} failed for ${item.slug}:`, err.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
      }
    }
  }
  console.error(`[${index}/${total}] FAILED to generate image for ${item.slug}`);
  return false;
}

async function run() {
  // Load current metadata mappings
  let imageMetadata = {};
  if (existsSync(itemImagesPath)) {
    try {
      imageMetadata = JSON.parse(readFileSync(itemImagesPath, 'utf8'));
    } catch (e) {
      imageMetadata = {};
    }
  }
  
  // Load list of all items from items.json
  let itemsData;
  try {
    itemsData = JSON.parse(readFileSync(itemsJsonPath, 'utf8'));
  } catch (e) {
    console.error('Failed to read items.json:', e.message);
    process.exit(1);
  }
  
  const allItems = itemsData.items || [];
  
  // Filter for items that don't have a mapped image yet
  const missingItems = allItems.filter(item => {
    const hasMap = imageMetadata[item.slug];
    const imageFileExists = existsSync(resolve(imagesDir, `${item.slug}.jpg`));
    return !hasMap || !imageFileExists;
  });
  
  console.log(`Found ${allItems.length} total items. Mapped/existing images: ${allItems.length - missingItems.length}. Missing: ${missingItems.length}.`);
  
  if (missingItems.length === 0) {
    console.log('All items already have images mapped! Nothing to download.');
    return;
  }
  
  console.log(`Starting to download ${missingItems.length} missing images sequentially...`);
  
  for (let i = 0; i < missingItems.length; i++) {
    const item = missingItems[i];
    const success = await downloadWithRetry(item, i + 1, missingItems.length, imageMetadata);
    
    if (success) {
      // Save metadata incrementally
      writeFileSync(itemImagesPath, JSON.stringify(imageMetadata, null, 2) + '\n', 'utf8');
    }
    
    // Cooldown delay between requests
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  
  console.log('All missing image downloads completed!');
}

run().catch(err => {
  console.error('Fatal error in fetch missing images script:', err);
});
