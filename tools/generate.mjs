import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..');
// The app repository lives beside this data repository inside bazar-khata-services/.
const appDir = process.env.BAZAR_APP_DIR ?? resolve(here, '../../bazar-khata');
const bundleDataDir = resolve(appDir, 'src/assets/data');
const researchPath = resolve(appDir, 'research/DATA_RESEARCH.md');

const RELEASED_AT = '2026-07-02T00:00:00.000Z';
const DATASET_VERSION = '1.0.2';
const SCHEMA_VERSION = 1;
const CATEGORY_NAMESPACE = '6b59f8bc-f205-5a89-bf64-588f42e4644f';
const ITEM_NAMESPACE = 'a68d5cf4-fcc5-56b1-98d2-21d6b03d31eb';

const categories = [
  ['rice-grains', 'Rice & Grains', 'চাল ও শস্য', 'Wheat', '#D97706', '#FEF3C7'],
  ['flour-noodles', 'Flour, Noodles & Pasta', 'আটা, ময়দা ও নুডলস', 'Soup', '#B45309', '#FFEDD5'],
  ['pulses-legumes', 'Pulses & Legumes', 'ডাল ও শুঁটি', 'Bean', '#EA580C', '#FFF7ED'],
  ['vegetables', 'Vegetables', 'শাকসবজি', 'Carrot', '#16A34A', '#DCFCE7'],
  ['leafy-greens', 'Leafy Greens & Herbs', 'শাক ও পাতা', 'LeafyGreen', '#059669', '#D1FAE5'],
  ['fruits', 'Fruits', 'ফলমূল', 'Apple', '#F43F5E', '#FFE4E6'],
  ['fish-seafood', 'Fish & Seafood', 'মাছ ও সামুদ্রিক খাবার', 'Fish', '#0284C7', '#E0F2FE'],
  ['meat-poultry', 'Meat & Poultry', 'মাংস ও পোলট্রি', 'Drumstick', '#DC2626', '#FEE2E2'],
  ['dairy-eggs', 'Dairy & Eggs', 'দুধ ও ডিম', 'Milk', '#2563EB', '#DBEAFE'],
  ['oils-fats', 'Oils & Fats', 'তেল ও চর্বি', 'Droplets', '#EAB308', '#FEF9C3'],
  ['spices-condiments', 'Spices & Condiments', 'মসলা ও স্বাদবর্ধক', 'Flame', '#EA580C', '#FFEDD5'],
  ['snacks-bakery', 'Snacks & Bakery', 'নাশতা ও বেকারি', 'Cookie', '#A16207', '#FEF3C7'],
  ['beverages', 'Beverages', 'পানীয়', 'CupSoda', '#0891B2', '#CFFAFE'],
  [
    'frozen-packaged',
    'Frozen & Packaged Food',
    'হিমায়িত ও প্যাকেটজাত খাবার',
    'Snowflake',
    '#4F46E5',
    '#E0E7FF',
  ],
  ['cleaning', 'Cleaning', 'পরিষ্কার-পরিচ্ছন্নতা', 'Sparkles', '#0D9488', '#CCFBF1'],
  ['personal-care', 'Personal Care', 'ব্যক্তিগত যত্ন', 'Heart', '#DB2777', '#FCE7F3'],
  [
    'health-wellness',
    'Health & Wellness',
    'স্বাস্থ্য ও সুরক্ষা',
    'HeartPulse',
    '#E11D48',
    '#FFE4E6',
  ],
  ['baby-care', 'Baby Care', 'শিশুর যত্ন', 'Baby', '#7C3AED', '#EDE9FE'],
  ['pet-care', 'Pet Care', 'পোষা প্রাণীর যত্ন', 'PawPrint', '#9333EA', '#F3E8FF'],
  [
    'household-kitchen',
    'Household & Kitchen',
    'গৃহস্থালি ও রান্নাঘর',
    'House',
    '#475569',
    '#F1F5F9',
  ],
  ['stationery', 'Stationery', 'স্টেশনারি', 'Pencil', '#4F46E5', '#EEF2FF'],
  [
    'religious-festival',
    'Festival Essentials',
    'উৎসবের প্রয়োজনীয়',
    'MoonStar',
    '#C026D3',
    '#FAE8FF',
  ],
  ['other', 'Other', 'অন্যান্য', 'Shapes', '#64748B', '#F1F5F9'],
].map(([slug, en, bn, icon, color, backgroundColor], index) => ({
  id: uuidV5(CATEGORY_NAMESPACE, slug),
  slug,
  name: { en, bn },
  icon,
  color,
  backgroundColor,
  sortOrder: index + 1,
  isActive: true,
  createdAt: RELEASED_AT,
  updatedAt: RELEASED_AT,
}));

const sectionToCategory = new Map([
  ['Rice & grains', 'rice-grains'],
  ['Flour, noodles & pasta', 'flour-noodles'],
  ['Pulses & legumes', 'pulses-legumes'],
  ['Vegetables', 'vegetables'],
  ['Leafy greens & herbs', 'leafy-greens'],
  ['Fruits', 'fruits'],
  ['Fish & seafood', 'fish-seafood'],
  ['Meat & poultry', 'meat-poultry'],
  ['Dairy & eggs', 'dairy-eggs'],
  ['Oils & fats', 'oils-fats'],
  ['Spices & condiments', 'spices-condiments'],
  ['Snacks & bakery', 'snacks-bakery'],
  ['Beverages', 'beverages'],
  ['Frozen & packaged food', 'frozen-packaged'],
  ['Cleaning', 'cleaning'],
  ['Personal care', 'personal-care'],
  ['Health & wellness', 'health-wellness'],
  ['Baby care', 'baby-care'],
  ['Pet care', 'pet-care'],
  ['Household & kitchen', 'household-kitchen'],
  ['Stationery', 'stationery'],
]);

const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

const aliasOverrides = {
  Rice: ['chal', 'chawal'],
  'Flattened rice': ['chira', 'chire'],
  'Puffed rice': ['muri', 'murhi'],
  'Popped rice': ['khoi'],
  'Whole-wheat flour': ['atta', 'aata'],
  'Refined flour': ['maida', 'moyda'],
  Semolina: ['suji', 'shooji'],
  Vermicelli: ['semai', 'shemai'],
  'Red lentil': ['mosur dal', 'masoor dal'],
  'Split mung dal': ['mug dal', 'moong dal'],
  Chickpea: ['chola', 'boot'],
  'Split chickpea': ['cholar dal', 'boot dal'],
  'Black gram': ['mashkalai dal', 'mash kolai'],
  Potato: ['alu', 'aloo'],
  Onion: ['peyaj', 'piyaj'],
  Garlic: ['roshun', 'rosun'],
  Ginger: ['ada'],
  'Green chilli': ['kacha morich', 'kancha morich'],
  Brinjal: ['begun', 'eggplant', 'aubergine'],
  Okra: ['dherosh', 'ladies finger', "lady's finger"],
  'Bottle gourd': ['lau', 'lao'],
  'Sweet pumpkin': ['misti kumra', 'kumra'],
  Cucumber: ['shosha', 'sosa'],
  'Bitter gourd': ['korola', 'uchche'],
  'Pointed gourd': ['potol'],
  'Ridge gourd': ['jhinga', 'jhinge'],
  'Snake gourd': ['chichinga'],
  'Hyacinth bean': ['shim', 'seem'],
  'Yardlong bean': ['borboti'],
  Cauliflower: ['fulkopi', 'phulkopi'],
  Cabbage: ['badhakopi', 'bandhakopi'],
  'Green papaya': ['kacha pepe', 'kancha pepe'],
  'Raw banana': ['kacha kola', 'kancha kola'],
  'Red amaranth': ['lal shak', 'lal shaak'],
  Spinach: ['palong shak', 'palong'],
  'Malabar spinach': ['pui shak', 'puishak'],
  'Coriander leaves': ['dhonia pata', 'dhone pata', 'cilantro'],
  'Mint leaves': ['pudina pata'],
  Banana: ['kola'],
  Mango: ['aam', 'am'],
  Jackfruit: ['kathal'],
  Guava: ['peyara'],
  Watermelon: ['tormuj', 'taromuj'],
  Coconut: ['narikel', 'narkel'],
  'Green coconut': ['dab'],
  Jujube: ['boroi', 'kul'],
  Lychee: ['lichu'],
  Lemon: ['lebu'],
  'Indian gooseberry': ['amloki', 'amla'],
  Hilsa: ['ilish', 'hilsha'],
  Rohu: ['rui', 'ruhi'],
  Catla: ['katla', 'katal'],
  Tilapia: ['telapia'],
  Pangas: ['pangash', 'pangas'],
  'Golda prawn': ['golda chingri'],
  'Bagda prawn': ['bagda chingri'],
  'Small shrimp': ['choto chingri', 'small prawn'],
  Beef: ['gorur mangsho', 'goru mangsho'],
  'Goat meat': ['khashir mangsho', 'khasi'],
  'Broiler chicken': ['broiler murgi'],
  'Native chicken': ['deshi murgi'],
  Duck: ['hash', 'hasher mangsho'],
  'Liquid milk': ['dudh', 'milk'],
  'Sour curd': ['tok doi', 'yogurt'],
  'Sweet curd': ['misti doi'],
  Paneer: ['ponir'],
  'Chicken egg': ['murgir dim', 'dim'],
  'Duck egg': ['hasher dim'],
  'Soybean oil': ['soyabin tel'],
  'Mustard oil': ['sorishar tel', 'shorishar tel'],
  Ghee: ['ghi'],
  'Iodized salt': ['lobon', 'nun'],
  Sugar: ['chini'],
  'Date-palm jaggery': ['khejurer gur', 'gur'],
  'Turmeric powder': ['holud gura', 'holuder gura'],
  'Red chilli powder': ['morich gura'],
  'Cumin seed': ['jira'],
  'Coriander seed': ['dhonia', 'dhone'],
  'Black cumin': ['kalo jira', 'kalojira'],
  Cinnamon: ['daruchini', 'darchini'],
  'Green cardamom': ['elach', 'choto elach'],
  Clove: ['lobongo'],
  'Bay leaf': ['tejpata', 'tej pata'],
  'Panch phoron': ['pach foron', 'panchforon'],
  Chanachur: ['chanachur'],
  'White bread': ['pauruti', 'paw ruti'],
  'Toast biscuit': ['toast biskut'],
  'Black tea': ['cha pata', 'tea'],
  'Drinking water': ['khabar pani', 'pani'],
  'Soft drink': ['komol paniyo'],
  'Oral rehydration salts': ['ors', 'oral saline', 'khabar saline'],
  Matches: ['diyashlai', 'matchbox'],
  Candle: ['mombati'],
  Notebook: ['khata'],
};

const seasonalMonths = {
  Mango: [5, 6, 7],
  'Himsagar mango': [5, 6],
  'Langra mango': [6, 7],
  'Fazli mango': [7, 8],
  'Amrapali mango': [6, 7, 8],
  'Gopalbhog mango': [5, 6],
  Jackfruit: [5, 6, 7, 8],
  Lychee: [5, 6],
  Watermelon: [3, 4, 5],
  Muskmelon: [3, 4, 5],
  Jujube: [1, 2, 3],
  'Java plum': [5, 6, 7],
  'Rose apple': [4, 5, 6],
  'Sugarcane juice': [11, 12, 1, 2, 3],
};

const emojiByCategory = {
  'rice-grains': '🌾',
  'flour-noodles': '🍜',
  'pulses-legumes': '🫘',
  vegetables: '🥕',
  'leafy-greens': '🥬',
  fruits: '🍎',
  'fish-seafood': '🐟',
  'meat-poultry': '🍗',
  'dairy-eggs': '🥛',
  'oils-fats': '🫗',
  'spices-condiments': '🧂',
  'snacks-bakery': '🍪',
  beverages: '🥤',
  'frozen-packaged': '❄️',
  cleaning: '🧼',
  'personal-care': '🪥',
  'health-wellness': '🩹',
  'baby-care': '👶',
  'pet-care': '🐾',
  'household-kitchen': '🏠',
  stationery: '✏️',
};

const itemEmoji = {
  Rice: '🍚',
  Potato: '🥔',
  Onion: '🧅',
  Garlic: '🧄',
  Ginger: '🫚',
  Tomato: '🍅',
  Brinjal: '🍆',
  Cucumber: '🥒',
  'Green chilli': '🌶️',
  Cauliflower: '🥦',
  Carrot: '🥕',
  Mushroom: '🍄',
  Corn: '🌽',
  Banana: '🍌',
  Mango: '🥭',
  Jackfruit: '🍈',
  Pineapple: '🍍',
  Papaya: '🍈',
  Guava: '🍐',
  Watermelon: '🍉',
  Coconut: '🥥',
  Lemon: '🍋',
  Apple: '🍎',
  Pear: '🍐',
  Grapes: '🍇',
  Strawberry: '🍓',
  Avocado: '🥑',
  Kiwi: '🥝',
  Dates: '🌴',
  Hilsa: '🐟',
  Crab: '🦀',
  Squid: '🦑',
  Beef: '🥩',
  'Goat meat': '🥩',
  'Broiler chicken': '🍗',
  'Chicken egg': '🥚',
  Butter: '🧈',
  Cheese: '🧀',
  'Liquid milk': '🥛',
  'Sour curd': '🥣',
  Honey: '🍯',
  Salt: '🧂',
  Sugar: '🍬',
  Chocolate: '🍫',
  Cake: '🍰',
  Popcorn: '🍿',
  Coffee: '☕',
  'Instant coffee': '☕',
  'Black tea': '🍵',
  'Drinking water': '💧',
  'Soft drink': '🥤',
  'Fruit juice': '🧃',
  'Toilet tissue': '🧻',
  'Bathing soap': '🧼',
  Toothbrush: '🪥',
  'Sanitary pad': '🩷',
  'Face mask': '😷',
  Thermometer: '🌡️',
  'Baby diaper': '👶',
  'Dry cat food': '🐈',
  'Dry dog food': '🐕',
  Matches: '🔥',
  Candle: '🕯️',
  'LED bulb': '💡',
  Battery: '🔋',
  'Ballpoint pen': '🖊️',
  Pencil: '✏️',
  Notebook: '📓',
  Scissors: '✂️',
};

function uuidV5(namespace, name) {
  const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  const digest = createHash('sha1')
    .update(namespaceBytes)
    .update(Buffer.from(name, 'utf8'))
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const banglaMap = new Map(
  Object.entries({
    অ: 'o',
    আ: 'a',
    ই: 'i',
    ঈ: 'i',
    উ: 'u',
    ঊ: 'u',
    ঋ: 'ri',
    এ: 'e',
    ঐ: 'oi',
    ও: 'o',
    ঔ: 'ou',
    ক: 'k',
    খ: 'kh',
    গ: 'g',
    ঘ: 'gh',
    ঙ: 'ng',
    চ: 'ch',
    ছ: 'chh',
    জ: 'j',
    ঝ: 'jh',
    ঞ: 'n',
    ট: 't',
    ঠ: 'th',
    ড: 'd',
    ঢ: 'dh',
    ণ: 'n',
    ত: 't',
    থ: 'th',
    দ: 'd',
    ধ: 'dh',
    ন: 'n',
    প: 'p',
    ফ: 'f',
    ব: 'b',
    ভ: 'bh',
    ম: 'm',
    য: 'j',
    র: 'r',
    ল: 'l',
    শ: 'sh',
    ষ: 'sh',
    স: 's',
    হ: 'h',
    ড়: 'r',
    ঢ়: 'rh',
    য়: 'y',
    ড়: 'r',
    ঢ়: 'rh',
    য়: 'y',
    ৎ: 't',
    'া': 'a',
    'ি': 'i',
    'ী': 'i',
    'ু': 'u',
    'ূ': 'u',
    'ৃ': 'ri',
    'ে': 'e',
    'ৈ': 'oi',
    'ো': 'o',
    'ৌ': 'ou',
    'ঁ': '',
    'ং': 'ng',
    'ঃ': 'h',
    '্': '',
    '়': '',
    '‍': '',
  }),
);

function romanizeBangla(value) {
  const normalized = value.normalize('NFC');
  let output = '';
  for (const char of normalized) output += banglaMap.get(char) ?? char;
  return output
    .toLowerCase()
    .replace(/[^a-z0-9/ -]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitVariants(value) {
  return unique(value.split('/').map((part) => part.trim()));
}

function inferUnits(categorySlug, englishName) {
  const lower = englishName.toLowerCase();
  const packageUnits = ['pack', 'box'];

  if (
    categorySlug === 'rice-grains' ||
    categorySlug === 'flour-noodles' ||
    categorySlug === 'pulses-legumes'
  ) {
    return { defaultUnit: 'kg', supportedUnits: ['kg', 'g', 'pack', 'bag'], defaultQuantity: 1 };
  }
  if (
    categorySlug === 'vegetables' ||
    categorySlug === 'fruits' ||
    categorySlug === 'fish-seafood' ||
    categorySlug === 'meat-poultry'
  ) {
    const countable =
      /coconut|gourd|papaya|jackfruit|pineapple|watermelon|muskmelon|pomelo|banana flower|banana stem|corn on/.test(
        lower,
      );
    return countable
      ? { defaultUnit: 'pcs', supportedUnits: ['pcs', 'kg'], defaultQuantity: 1 }
      : { defaultUnit: 'kg', supportedUnits: ['kg', 'g', 'pcs'], defaultQuantity: 1 };
  }
  if (categorySlug === 'leafy-greens') {
    return { defaultUnit: 'bundle', supportedUnits: ['bundle', 'g', 'kg'], defaultQuantity: 1 };
  }
  if (categorySlug === 'dairy-eggs') {
    if (/egg/.test(lower))
      return { defaultUnit: 'dozen', supportedUnits: ['dozen', 'pcs', 'pack'], defaultQuantity: 1 };
    if (/milk|buttermilk|cream/.test(lower) && !/powder/.test(lower))
      return {
        defaultUnit: 'l',
        supportedUnits: ['l', 'ml', 'bottle', 'pack'],
        defaultQuantity: 1,
      };
    return { defaultUnit: 'g', supportedUnits: ['g', 'kg', 'pack', 'box'], defaultQuantity: 500 };
  }
  if (categorySlug === 'oils-fats') {
    if (/ghee|shortening|margarine/.test(lower))
      return { defaultUnit: 'g', supportedUnits: ['g', 'kg', 'jar', 'pack'], defaultQuantity: 500 };
    return { defaultUnit: 'l', supportedUnits: ['l', 'ml', 'bottle'], defaultQuantity: 1 };
  }
  if (categorySlug === 'spices-condiments') {
    if (/sauce|vinegar|water|essence/.test(lower))
      return { defaultUnit: 'bottle', supportedUnits: ['bottle', 'ml', 'l'], defaultQuantity: 1 };
    if (/paste|mayonnaise|pickle|honey/.test(lower))
      return { defaultUnit: 'jar', supportedUnits: ['jar', 'g', 'bottle'], defaultQuantity: 1 };
    return { defaultUnit: 'g', supportedUnits: ['g', 'kg', 'pack', 'jar'], defaultQuantity: 100 };
  }
  if (
    categorySlug === 'snacks-bakery' ||
    categorySlug === 'frozen-packaged' ||
    categorySlug === 'pet-care'
  ) {
    return {
      defaultUnit: 'pack',
      supportedUnits: ['pack', 'g', 'kg', 'box', 'pcs'],
      defaultQuantity: 1,
    };
  }
  if (categorySlug === 'beverages') {
    if (/tea|coffee|powder/.test(lower))
      return { defaultUnit: 'g', supportedUnits: ['g', 'kg', 'pack', 'box'], defaultQuantity: 200 };
    return {
      defaultUnit: 'bottle',
      supportedUnits: ['bottle', 'ml', 'l', 'pack'],
      defaultQuantity: 1,
    };
  }
  if (categorySlug === 'cleaning') {
    if (/broom|mop|brush|sponge|pad|wool|cloth/.test(lower))
      return { defaultUnit: 'pcs', supportedUnits: ['pcs', 'pack'], defaultQuantity: 1 };
    if (/tissue|towel|napkin|bag/.test(lower))
      return {
        defaultUnit: 'pack',
        supportedUnits: ['pack', 'roll', 'box', 'pcs'],
        defaultQuantity: 1,
      };
    return {
      defaultUnit: 'bottle',
      supportedUnits: ['bottle', 'ml', 'l', 'pack', 'g', 'kg'],
      defaultQuantity: 1,
    };
  }
  if (categorySlug === 'personal-care') {
    if (/brush|razor|comb|cutter|cup/.test(lower))
      return { defaultUnit: 'pcs', supportedUnits: ['pcs', 'pack'], defaultQuantity: 1 };
    return {
      defaultUnit: 'pack',
      supportedUnits: ['pack', 'bottle', 'ml', 'g', 'box', 'pcs'],
      defaultQuantity: 1,
    };
  }
  if (categorySlug === 'health-wellness' || categorySlug === 'baby-care') {
    if (/monitor|meter|bag|thermometer|bottle|brush|pacifier|bib|box/.test(lower))
      return { defaultUnit: 'pcs', supportedUnits: ['pcs', 'pack'], defaultQuantity: 1 };
    return {
      defaultUnit: 'pack',
      supportedUnits: ['pack', 'box', 'bottle', 'pcs', 'g', 'ml'],
      defaultQuantity: 1,
    };
  }
  if (categorySlug === 'household-kitchen' || categorySlug === 'stationery') {
    return {
      defaultUnit: 'pcs',
      supportedUnits: unique(['pcs', ...packageUnits, 'roll', 'pair']),
      defaultQuantity: 1,
    };
  }
  return { defaultUnit: 'pcs', supportedUnits: ['pcs', 'pack'], defaultQuantity: 1 };
}

function parseCatalogue(markdown, itemImages = {}, existingItemsMap = new Map()) {
  const items = [];
  const sectionPattern = /^### (.+)\n\n([\s\S]*?)(?=\n### |\n## |$)/gm;
  for (const match of markdown.matchAll(sectionPattern)) {
    const sectionName = match[1].trim();
    const categorySlug = sectionToCategory.get(sectionName);
    if (!categorySlug) continue;

    const firstParagraph = match[2].trim().split(/\n\n/)[0].replaceAll('\n', ' ');
    const entries = firstParagraph
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const entry of entries) {
      const separatorIndex = entry.indexOf('—');
      if (separatorIndex < 1)
        throw new Error(`Malformed catalogue entry in ${sectionName}: ${entry}`);
      const englishRaw = entry.slice(0, separatorIndex).trim();
      const banglaRaw = entry
        .slice(separatorIndex + 1)
        .replace(/\.$/, '')
        .trim();
      const englishVariants = splitVariants(englishRaw);
      const banglaVariants = splitVariants(banglaRaw);
      const englishName = englishVariants[0];
      const banglaName = banglaVariants[0];
      const slug = slugify(`${categorySlug}-${englishName}`);
      const { defaultUnit, supportedUnits, defaultQuantity } = inferUnits(
        categorySlug,
        englishName,
      );
      const months = seasonalMonths[englishName] ?? null;
      const banglish = unique([
        romanizeBangla(banglaName),
        ...banglaVariants.slice(1).map(romanizeBangla),
        ...(aliasOverrides[englishName] ?? []),
      ]);

      const existing = existingItemsMap.get(slug);

      items.push({
        id: uuidV5(ITEM_NAMESPACE, slug),
        slug,
        name: { en: englishName, bn: banglaName },
        aliases: {
          en: unique(englishVariants.slice(1)),
          bn: unique(banglaVariants.slice(1)),
          banglish,
        },
        categoryId: categoryBySlug.get(categorySlug).id,
        categorySlug,
        defaultUnit,
        supportedUnits,
        defaultQuantity,
        averagePrice: existing ? existing.averagePrice : null,
        priceEstimate: existing ? existing.priceEstimate : null,
        image: itemImages[slug] ?? null,
        emoji: itemEmoji[englishName] ?? emojiByCategory[categorySlug],
        seasonal: Boolean(months),
        seasonality: months ? { type: 'seasonal', months, note: null } : null,
        brand: null,
        barcode: null,
        scientificName: null,
        tags: [],
        sourceRefs: ['curated-research-2026-07-02'],
        createdAt: RELEASED_AT,
        updatedAt: RELEASED_AT,
      });
    }
  }
  return items.sort((a, b) => {
    const categoryDelta =
      categoryBySlug.get(a.categorySlug).sortOrder - categoryBySlug.get(b.categorySlug).sortOrder;
    return categoryDelta || a.name.en.localeCompare(b.name.en, 'en');
  });
}

async function writeJson(path, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, text, 'utf8');
  return {
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

const markdown = await readFile(researchPath, 'utf8');
const itemImagesPath = resolve(here, 'item-images.json');
let itemImages = {};
try {
  itemImages = JSON.parse(await readFile(itemImagesPath, 'utf8'));
} catch (err) {
  // If no mapping file exists, default to empty object
}

let existingItemsMap = new Map();
try {
  const existingItemsData = JSON.parse(await readFile(resolve(dataDir, 'items.json'), 'utf8'));
  for (const item of existingItemsData.items) {
    existingItemsMap.set(item.slug, {
      averagePrice: item.averagePrice,
      priceEstimate: item.priceEstimate
    });
  }
} catch (err) {
  // If no items.json exists yet, ignore
}

const items = parseCatalogue(markdown, itemImages, existingItemsMap);
await mkdir(dataDir, { recursive: true });
await mkdir(bundleDataDir, { recursive: true });

const categoriesDocument = {
  schemaVersion: SCHEMA_VERSION,
  datasetVersion: DATASET_VERSION,
  generatedAt: RELEASED_AT,
  categories,
};
const itemsDocument = {
  schemaVersion: SCHEMA_VERSION,
  datasetVersion: DATASET_VERSION,
  generatedAt: RELEASED_AT,
  items,
};

const categoryFile = await writeJson(resolve(dataDir, 'categories.json'), categoriesDocument);
const itemFile = await writeJson(resolve(dataDir, 'items.json'), itemsDocument);
await writeJson(resolve(bundleDataDir, 'categories.json'), categoriesDocument);
await writeJson(resolve(bundleDataDir, 'items.json'), itemsDocument);
const categoryCounts = Object.fromEntries(categories.map((category) => [category.slug, 0]));
for (const item of items) categoryCounts[item.categorySlug] += 1;

const versionDocument = {
  schemaVersion: SCHEMA_VERSION,
  datasetVersion: DATASET_VERSION,
  releasedAt: RELEASED_AT,
  minimumAppVersion: '1.0.0',
  breaking: false,
  locale: 'bn-BD',
  currency: 'BDT',
  files: {
    categories: {
      path: 'categories.json',
      sha256: categoryFile.sha256,
      bytes: categoryFile.bytes,
      records: categories.length,
    },
    items: {
      path: 'items.json',
      sha256: itemFile.sha256,
      bytes: itemFile.bytes,
      records: items.length,
    },
  },
  categoryCounts,
  notes: [
    'Initial research-backed bilingual generic catalogue.',
    'Static price estimates intentionally omitted.',
  ],
};
await writeJson(resolve(dataDir, 'version.json'), versionDocument);
await writeJson(resolve(bundleDataDir, 'version.json'), versionDocument);

console.log(
  `Generated ${categories.length} categories and ${items.length} items for dataset ${DATASET_VERSION}.`,
);
