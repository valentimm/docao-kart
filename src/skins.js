/** Skins do Docão. Só dados: a forma do porco não muda, só roupa e acessório. */

export const SKIN_STORAGE = 'docao-kart-skin';
export const DEFAULT_SKIN = 'classico';

export const SKINS = [
  {
    id: 'classico',
    name: 'Clássico',
    shirt: { color: '#d8261c', trim: '#1d1410', logo: { text: 'C!', color: '#f5e6d0' } },
    pants: '#1d1410',
  },
  {
    id: 'clube',
    name: 'Clube Cheers',
    shirt: { color: '#7DF9FF', trim: '#12233a', logo: { text: 'C!', color: '#12233a', sub: 'clube' } },
    pants: '#12233a',
    parts: [{ type: 'socks', color: '#7DF9FF' }],
  },
  {
    id: 'bone',
    name: 'Boné da Firma',
    shirt: { color: '#d8261c', trim: '#1d1410', logo: { text: 'C!', color: '#f5e6d0' } },
    pants: '#2a3550',
    parts: [{ type: 'cap', color: '#7DF9FF', brim: '#12233a', logo: true }, { type: 'glasses', color: '#2a1408' }],
  },
  {
    id: 'choquinho',
    name: 'Choquinho',
    shirt: {
      color: '#ffd23a',
      trim: '#e0a800',
      sleeves: 'long',
      details: [{ type: 'backStripes', color: '#7a4a1c' }],
      logo: { text: 'C!', color: '#7a4a1c', size: 0.16 },
    },
    pants: '#ffd23a',
    parts: [
      { type: 'hood', color: '#ffd23a', tip: '#1a1a1a', cheeks: '#e8322a' },
      { type: 'boltTail', color: '#ffd23a', base: '#7a4a1c' },
    ],
  },
  {
    id: 'docao-matheus',
    name: 'Docão Matheus',
    shirt: {
      color: '#1a1a1d',
      trim: '#0e0e10',
      sleeves: 'long',
      sleeveColor: '#1a1a1d',
      details: [{ type: 'hoodie', color: '#0e0e10', zip: '#a8acb2' }],
    },
    pants: '#121214',
    eyes: { iris: '#1f6b35', ring: '#0f3d1c' },
    parts: [
      { type: 'quiffHair', color: '#2e1c12', side: '#2a1b12' },
      { type: 'beard', color: '#43291a' },
      { type: 'hoodDown', color: '#1a1a1d', inner: '#0b0b0d' },
      { type: 'hoodStrings', color: '#f4f4f4' },
      { type: 'lanyard', color: '#d81e2a', logo: '#d81e2a' },
      { type: 'longPants', color: '#121214' },
      { type: 'shoes', color: '#f4f4f4', sole: '#d4d4d4', strap: '#e2e2e2' },
    ],
  },
  {
    id: 'faixa-presidencial',
    name: 'Faixa Presidencial',
    shirt: { color: '#2c333c', trim: '#f4f1ea', sleeves: 'long', sleeveColor: '#2c333c' },
    pants: '#1c1f26',
    parts: [
      { type: 'faixa', color: '#009c3b', colors: ['#009c3b', '#ffdf00', '#002776'] },
      { type: 'longPants', color: '#1c1f26' },
      { type: 'shoes', color: '#141416', sole: '#2a2a2e' },
    ],
  },
  {
    id: 'barriguinha',
    name: 'Docão Barriguinha',
    shirt: { color: '#b73c28', trim: '#8e2c1e' },
    pants: '#2c5f92',
    parts: [{ type: 'bellyOut', roll: '#c44b36', rollDark: '#8e2c1e' }],
  },
];

const BOT_PREF = [
  ['milho', 'choquinho'],
  ['hortela', 'clube'],
  ['jabuticaba', 'docao-matheus'],
];

export function getSkin(id) {
  return SKINS.find((skin) => skin.id === id) || SKINS[0];
}

/** Player keeps the chosen skin. Bots take other official skins so the grid stays distinct. */
export function assignSkins(playerId) {
  const player = getSkin(playerId).id;
  const used = new Set([player]);
  const out = { docao: player };
  for (const [id, pref] of BOT_PREF) {
    let pick = pref;
    if (used.has(pick)) pick = SKINS.find((skin) => !used.has(skin.id)).id;
    used.add(pick);
    out[id] = pick;
  }
  return out;
}
