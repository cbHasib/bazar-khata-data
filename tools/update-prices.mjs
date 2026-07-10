import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..');
const appDir = process.env.BAZAR_APP_DIR ?? resolve(here, '../../bazar-khata');
const bundleDataDir = resolve(appDir, 'src/assets/data');

const unitCategories = {
  'kg': 'weight', 'g': 'weight',
  'l': 'volume', 'ml': 'volume',
  'pcs': 'count', 'dozen': 'count', 'pair': 'count',
  'pack': 'pack', 'box': 'pack', 'bottle': 'pack', 'jar': 'pack', 'can': 'pack', 'roll': 'pack', 'bag': 'pack', 'bundle': 'pack'
};

function getUnitCategory(unit) {
  return unitCategories[unit] || 'other';
}

function parseChaldalUnit(subText) {
  if (!subText) return null;
  const match = subText.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z\s\.\u09E6-\u09EF]+)$/);
  if (!match) return null;
  
  const qty = parseFloat(match[1]);
  let unitRaw = match[2].trim().toLowerCase();
  
  // map unit
  let unit = null;
  if (['kg', 'k.g.', 'k.g', 'keji'].includes(unitRaw)) unit = 'kg';
  else if (['g', 'gm', 'gram', 'grams', 'gm.'].includes(unitRaw)) unit = 'g';
  else if (['l', 'ltr', 'litre', 'litres', 'liter', 'liters', 'ltr.'].includes(unitRaw)) unit = 'l';
  else if (['ml', 'm.l.', 'ml.'].includes(unitRaw)) unit = 'ml';
  else if (['pcs', 'pc', 'piece', 'pieces', 'pcs.'].includes(unitRaw)) unit = 'pcs';
  else if (['dozen', 'hali'].includes(unitRaw)) unit = 'dozen';
  else if (['pack', 'packet', 'packets', 'pkg', 'sachet'].includes(unitRaw)) unit = 'pack';
  else if (['box', 'boxes'].includes(unitRaw)) unit = 'box';
  else if (['bottle', 'bottles'].includes(unitRaw)) unit = 'bottle';
  else if (['jar', 'jars'].includes(unitRaw)) unit = 'jar';
  else if (['can', 'cans'].includes(unitRaw)) unit = 'can';
  else if (['roll', 'rolls'].includes(unitRaw)) unit = 'roll';
  else if (['bag', 'bags'].includes(unitRaw)) unit = 'bag';
  else if (['pair', 'pairs'].includes(unitRaw)) unit = 'pair';
  else if (['bundle', 'bundles'].includes(unitRaw)) unit = 'bundle';

  if (!unit) return null;
  return { quantity: qty, unit };
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0980-\u09FF]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function calculateOverlap(queryTokens, candidateTokens) {
  if (queryTokens.length === 0) return 0;
  let matches = 0;
  for (const q of queryTokens) {
    if (candidateTokens.includes(q)) {
      matches++;
    }
  }
  return matches / queryTokens.length;
}

function findProductArray(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 'ProductVariantId' in obj[0] && 'Name' in obj[0]) {
      return obj;
    }
    for (const item of obj) {
      const found = findProductArray(item);
      if (found) return found;
    }
  } else {
    for (const val of Object.values(obj)) {
      const found = findProductArray(val);
      if (found) return found;
    }
  }
  return null;
}

async function searchChaldal(query, itemUnit) {
  const url = `https://chaldal.com/search/${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!res.ok) return [];
    
    const html = await res.text();
    const marker = 'window.__reactAsyncStatePacket';
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) return [];

    const jsonStart = html.indexOf('{', markerIndex);
    if (jsonStart === -1) return [];

    let openBraces = 0;
    let inString = false;
    let escape = false;
    let jsonEnd = -1;

    for (let i = jsonStart; i < html.length; i++) {
      const char = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          openBraces++;
        } else if (char === '}') {
          openBraces--;
          if (openBraces === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
    }

    if (jsonEnd === -1) return [];
    const state = JSON.parse(html.slice(jsonStart, jsonEnd));
    const rawProducts = findProductArray(state);
    if (!rawProducts) return [];

    const queryTokens = tokenize(query);
    const itemUnitCat = getUnitCategory(itemUnit);

    const scored = rawProducts.map(p => {
      const chaldalUnit = parseChaldalUnit(p.SubText);
      const nameTokens = tokenize(p.Name + ' ' + (p.NameBn || ''));
      const textScore = calculateOverlap(queryTokens, nameTokens);
      
      let unitScore = 0.5; // default if cannot match unit
      let isCompatible = false;
      if (chaldalUnit) {
        const chaldalUnitCat = getUnitCategory(chaldalUnit.unit);
        isCompatible = chaldalUnitCat === itemUnitCat;
        if (isCompatible) {
          unitScore = chaldalUnit.unit === itemUnit ? 1.0 : 0.8;
        } else {
          unitScore = 0.0;
        }
      }

      const overallScore = isCompatible ? (textScore * 0.7 + unitScore * 0.3) : 0;

      return {
        id: p.ProductVariantId,
        nameEn: p.Name,
        nameBn: p.NameBn,
        subText: p.SubText,
        slug: p.Slug,
        price: (p.DiscountedPrice && p.DiscountedPrice.Lo > 0) ? p.DiscountedPrice.Lo : p.Price.Lo,
        parsedUnit: chaldalUnit,
        score: overallScore
      };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

    return scored;
  } catch (error) {
    console.error(`Error searching Chaldal for "${query}":`, error.message);
    return [];
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim().toLowerCase());
  }));
}

async function writeJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, text, 'utf8');
  return {
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  let mode = 'interactive'; // interactive or auto
  let scope = 'missing'; // missing, all, slug, category
  let filterSlug = null;
  let filterCategory = null;
  let limit = Infinity;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--auto') mode = 'auto';
    else if (args[i] === '--interactive') mode = 'interactive';
    else if (args[i] === '--all') scope = 'all';
    else if (args[i] === '--missing') scope = 'missing';
    else if (args[i] === '--slug') {
      scope = 'slug';
      filterSlug = args[++i];
    } else if (args[i] === '--category') {
      scope = 'category';
      filterCategory = args[++i];
    } else if (args[i] === '--limit') {
      limit = parseInt(args[++i], 10);
    }
  }

  console.log(`Starting Price Update Script...`);
  console.log(`Mode: ${mode}, Scope: ${scope}, Limit: ${limit === Infinity ? 'None' : limit}`);

  // Load items.json
  const itemsPath = resolve(dataDir, 'items.json');
  const itemsDoc = JSON.parse(await readFile(itemsPath, 'utf8'));
  const items = itemsDoc.items;

  let candidates = items;
  if (scope === 'slug') {
    candidates = items.filter(item => item.slug === filterSlug);
  } else if (scope === 'category') {
    candidates = items.filter(item => item.categorySlug === filterCategory);
  } else if (scope === 'missing') {
    candidates = items.filter(item => item.priceEstimate === null);
  }

  console.log(`Found ${candidates.length} items matching scope.`);
  
  let updatedCount = 0;
  const observedAt = new Date().toISOString().split('T')[0];

  for (let idx = 0; idx < candidates.length && updatedCount < limit; idx++) {
    const item = candidates[idx];
    const label = `${item.categorySlug}/${item.slug}`;
    console.log(`\n[${idx + 1}/${candidates.length}] Processing: ${label} (${item.name.en})`);

    if (idx > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const query = item.name.en;
    const results = await searchChaldal(query, item.defaultUnit);

    if (results.length === 0) {
      console.log(`  No compatible results found on Chaldal.`);
      continue;
    }

    const match = results[0];
    console.log(`  Best Match on Chaldal:`);
    console.log(`    Name:  ${match.nameEn} (${match.nameBn || 'N/A'})`);
    console.log(`    Unit:  ${match.subText}`);
    console.log(`    Price: BDT ${match.price}`);
    console.log(`    Score: ${match.score.toFixed(3)}`);

    let accept = false;
    if (mode === 'auto') {
      if (match.score >= 0.85) {
        console.log(`  Auto-accepted match (score >= 0.85).`);
        accept = true;
      } else {
        console.log(`  Skipped (score too low for auto-accept: ${match.score.toFixed(3)} < 0.85).`);
      }
    } else {
      const ans = await askQuestion(`  Accept this price estimate? (y/n/skip): `);
      accept = ans === 'y';
    }

    if (accept) {
      const parsedUnit = match.parsedUnit || { quantity: item.defaultQuantity, unit: item.defaultUnit };
      item.priceEstimate = {
        amount: match.price,
        currency: 'BDT',
        quantity: parsedUnit.quantity,
        unit: parsedUnit.unit,
        geography: 'Dhaka',
        observedAt: observedAt,
        marketLevel: 'retail',
        sourceUrl: `https://chaldal.com/${match.slug}`,
        method: 'scraped'
      };
      item.updatedAt = new Date().toISOString();
      updatedCount++;
      console.log(`  Updated priceEstimate for ${item.slug}.`);
    } else {
      console.log(`  Skipped.`);
    }
  }

  if (updatedCount > 0) {
    console.log(`\nWriting updates for ${updatedCount} items...`);
    
    // Save items.json to data folder and bundle folder
    itemsDoc.generatedAt = new Date().toISOString();
    const localItemsFile = await writeJson(resolve(dataDir, 'items.json'), itemsDoc);
    const bundleItemsFile = await writeJson(resolve(bundleDataDir, 'items.json'), itemsDoc);

    // Update version.json
    const versionPath = resolve(dataDir, 'version.json');
    const versionDoc = JSON.parse(await readFile(versionPath, 'utf8'));
    versionDoc.releasedAt = itemsDoc.generatedAt;
    
    versionDoc.files.items.sha256 = localItemsFile.sha256;
    versionDoc.files.items.bytes = localItemsFile.bytes;
    versionDoc.files.items.records = items.length;

    await writeJson(resolve(dataDir, 'version.json'), versionDoc);
    await writeJson(resolve(bundleDataDir, 'version.json'), versionDoc);

    console.log(`Updated items.json and version.json in both locations.`);
    console.log(`Please run 'node data/tools/validate.mjs' to verify database schema checksums.`);
  } else {
    console.log(`\nNo prices updated.`);
  }
}

main();
