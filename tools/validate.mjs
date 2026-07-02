import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const allowedUnits = new Set([
  'kg',
  'g',
  'l',
  'ml',
  'pcs',
  'dozen',
  'bundle',
  'pack',
  'box',
  'bottle',
  'jar',
  'can',
  'roll',
  'bag',
  'pair',
]);
const errors = [];

async function loadJson(name) {
  const text = await readFile(resolve(dataDir, name), 'utf8');
  return { value: JSON.parse(text), text };
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) seen.has(value) ? duplicate.add(value) : seen.add(value);
  return [...duplicate];
}

function normalize(value) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('en')
    .replace(/[\p{P}\p{S}\s]+/gu, ' ')
    .trim();
}

const versionFile = await loadJson('version.json');
const categoryFile = await loadJson('categories.json');
const itemFile = await loadJson('items.json');
const version = versionFile.value;
const categories = categoryFile.value.categories;
const items = itemFile.value.items;

check(version.schemaVersion === 1, 'version.schemaVersion must be 1');
check(categoryFile.value.schemaVersion === 1, 'categories.schemaVersion must be 1');
check(itemFile.value.schemaVersion === 1, 'items.schemaVersion must be 1');
check(
  version.datasetVersion === categoryFile.value.datasetVersion,
  'category dataset version mismatch',
);
check(version.datasetVersion === itemFile.value.datasetVersion, 'item dataset version mismatch');
check(isoPattern.test(version.releasedAt), 'version.releasedAt must be an ISO timestamp');

for (const duplicate of duplicateValues(categories.map((category) => category.id)))
  errors.push(`duplicate category id: ${duplicate}`);
for (const duplicate of duplicateValues(categories.map((category) => category.slug)))
  errors.push(`duplicate category slug: ${duplicate}`);
for (const duplicate of duplicateValues(items.map((item) => item.id)))
  errors.push(`duplicate item id: ${duplicate}`);
for (const duplicate of duplicateValues(items.map((item) => item.slug)))
  errors.push(`duplicate item slug: ${duplicate}`);

const categoryIds = new Set(categories.map((category) => category.id));
const categorySlugs = new Set(categories.map((category) => category.slug));
const categoryNames = new Set();
for (const category of categories) {
  check(uuidPattern.test(category.id), `invalid category UUID: ${category.id}`);
  check(slugPattern.test(category.slug), `invalid category slug: ${category.slug}`);
  check(
    Boolean(category.name?.en && category.name?.bn),
    `missing bilingual category name: ${category.slug}`,
  );
  check(/^#[0-9A-F]{6}$/.test(category.color), `invalid category color: ${category.slug}`);
  check(
    /^#[0-9A-F]{6}$/.test(category.backgroundColor),
    `invalid category background: ${category.slug}`,
  );
  check(
    Number.isInteger(category.sortOrder) && category.sortOrder > 0,
    `invalid category order: ${category.slug}`,
  );
}

for (const item of items) {
  const label = `${item.categorySlug}/${item.slug}`;
  check(uuidPattern.test(item.id), `invalid item UUID: ${label}`);
  check(slugPattern.test(item.slug), `invalid item slug: ${label}`);
  check(Boolean(item.name?.en && item.name?.bn), `missing bilingual item name: ${label}`);
  check(
    /[\u0980-\u09FF]/.test(item.name?.bn ?? ''),
    `Bangla name has no Bangla character: ${label}`,
  );
  check(
    Array.isArray(item.aliases?.banglish) && item.aliases.banglish.length > 0,
    `missing Banglish alias: ${label}`,
  );
  check(categoryIds.has(item.categoryId), `unknown category id: ${label}`);
  check(categorySlugs.has(item.categorySlug), `unknown category slug: ${label}`);
  check(
    categoryById(categories, item.categoryId)?.slug === item.categorySlug,
    `category id/slug mismatch: ${label}`,
  );
  check(allowedUnits.has(item.defaultUnit), `invalid default unit: ${label}`);
  check(
    Array.isArray(item.supportedUnits) && item.supportedUnits.includes(item.defaultUnit),
    `supported units exclude default: ${label}`,
  );
  check(
    item.supportedUnits.every((unit) => allowedUnits.has(unit)),
    `invalid supported unit: ${label}`,
  );
  check(
    typeof item.defaultQuantity === 'number' && item.defaultQuantity > 0,
    `invalid default quantity: ${label}`,
  );
  check(
    item.averagePrice === null || typeof item.averagePrice === 'number',
    `invalid average price: ${label}`,
  );
  check(item.image === null || typeof item.image === 'object', `invalid image: ${label}`);
  check(item.brand === null || typeof item.brand === 'string', `invalid brand: ${label}`);
  check(item.barcode === null || typeof item.barcode === 'string', `invalid barcode: ${label}`);
  check(
    isoPattern.test(item.createdAt) && isoPattern.test(item.updatedAt),
    `invalid item timestamp: ${label}`,
  );
  if (item.seasonal) {
    check(
      Array.isArray(item.seasonality?.months) && item.seasonality.months.length > 0,
      `seasonal item missing months: ${label}`,
    );
    check(
      item.seasonality.months.every(
        (month) => Number.isInteger(month) && month >= 1 && month <= 12,
      ),
      `invalid seasonal month: ${label}`,
    );
  } else {
    check(item.seasonality === null, `non-seasonal item has seasonality: ${label}`);
  }

  const nameKey = `${item.categorySlug}:${normalize(item.name.en)}`;
  check(!categoryNames.has(nameKey), `duplicate normalized English name in category: ${label}`);
  categoryNames.add(nameKey);
}

for (const [key, metadata] of Object.entries(version.files)) {
  const file = key === 'categories' ? categoryFile : itemFile;
  const sha256 = createHash('sha256').update(file.text).digest('hex');
  check(metadata.sha256 === sha256, `${key} checksum mismatch`);
  check(metadata.bytes === Buffer.byteLength(file.text), `${key} byte count mismatch`);
  const records = key === 'categories' ? categories.length : items.length;
  check(metadata.records === records, `${key} record count mismatch`);
}

const actualCounts = Object.fromEntries(categories.map((category) => [category.slug, 0]));
for (const item of items) actualCounts[item.categorySlug] += 1;
check(
  JSON.stringify(version.categoryCounts) === JSON.stringify(actualCounts),
  'categoryCounts mismatch',
);

if (errors.length) {
  console.error(`Dataset validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Dataset valid: ${categories.length} categories, ${items.length} bilingual items, checksums verified.`,
  );
}

function categoryById(list, id) {
  return list.find((category) => category.id === id);
}
