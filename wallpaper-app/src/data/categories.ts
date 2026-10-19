export type Category = {
  id: string;
  name: string;
  emoji: string;
  // Keywords used for photo search (Pexels) and for matching exclusives.
  query: string;
  // Prompt fragments for the AI feed; each becomes a unique wallpaper.
  prompts: string[];
};

export const QUALITY_SUFFIX =
  'ultra detailed, 8k wallpaper, phone wallpaper, vertical composition, cinematic lighting, sharp focus, masterpiece';

export const CATEGORIES: Category[] = [
  {
    id: 'nature', name: 'Nature', emoji: '🌿', query: 'nature landscape',
    prompts: ['misty pine forest at sunrise', 'waterfall in a lush green valley', 'lavender field under golden sky', 'northern lights over a frozen lake', 'cherry blossom path in spring', 'autumn forest with sunbeams'],
  },
  {
    id: 'space', name: 'Space', emoji: '🪐', query: 'galaxy stars space',
    prompts: ['colorful nebula with bright stars', 'ringed planet rising over alien moon', 'spiral galaxy deep space', 'astronaut floating above earth', 'black hole with glowing accretion disk', 'milky way over desert canyon'],
  },
  {
    id: 'abstract', name: 'Abstract', emoji: '🌀', query: 'abstract colorful',
    prompts: ['liquid marble swirls gold and teal', 'iridescent 3d glass shapes', 'flowing silk waves pastel gradient', 'fluid ink in water vibrant colors', 'holographic chrome blobs', 'paper cut layers gradient'],
  },
  {
    id: 'anime', name: 'Anime', emoji: '🌸', query: 'anime illustration',
    prompts: ['anime girl under cherry blossoms, studio ghibli style', 'anime city street at night with rain', 'anime sky with giant clouds and train', 'anime samurai at sunset', 'cozy anime room with window view', 'anime fantasy castle in the clouds'],
  },
  {
    id: 'cars', name: 'Cars', emoji: '🏎️', query: 'sports car',
    prompts: ['supercar on wet neon street at night', 'classic muscle car in desert sunset', 'formula race car motion blur', 'jdm car in tokyo garage', 'luxury car on mountain road', 'futuristic concept car studio lighting'],
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', emoji: '🌆', query: 'neon city night',
    prompts: ['cyberpunk megacity with neon signs and rain', 'neon samurai in futuristic alley', 'synthwave sunset with grid road', 'futuristic skyline flying cars', 'hacker room glowing screens', 'neon koi fish in dark water'],
  },
  {
    id: 'amoled', name: 'AMOLED', emoji: '🖤', query: 'dark black minimal',
    prompts: ['minimal glowing neon line on pure black', 'single glowing moon on pure black background', 'dark smoke on pure black', 'neon outline of a wolf on black', 'glowing jellyfish on pure black', 'golden geometric lines on black'],
  },
  {
    id: 'minimal', name: 'Minimal', emoji: '◻️', query: 'minimal aesthetic',
    prompts: ['minimal mountains pastel gradient', 'single tree on hill minimal', 'minimalist sun and sea flat art', 'soft gradient dunes minimal', 'minimal moon phases', 'minimal paper boat on calm water'],
  },
  {
    id: 'animals', name: 'Animals', emoji: '🐯', query: 'wildlife animal',
    prompts: ['majestic lion portrait golden hour', 'snow leopard in blizzard', 'colorful parrot macro', 'wolf howling at full moon', 'tiger in jungle mist', 'cute red panda in tree'],
  },
  {
    id: 'ocean', name: 'Ocean', emoji: '🌊', query: 'ocean sea waves',
    prompts: ['crystal clear turquoise wave', 'underwater coral reef with sun rays', 'tropical beach aerial view', 'stormy sea lighthouse', 'whale swimming in deep blue', 'bioluminescent beach at night'],
  },
  {
    id: 'mountains', name: 'Mountains', emoji: '🏔️', query: 'mountains',
    prompts: ['snowy peaks above clouds at sunrise', 'alpine lake reflection mountains', 'himalaya at golden hour', 'mountain road with fog', 'volcano under starry sky', 'patagonia peaks dramatic sky'],
  },
  {
    id: 'flowers', name: 'Flowers', emoji: '🌺', query: 'flowers',
    prompts: ['macro rose with dew drops', 'field of tulips at sunset', 'lotus flower on dark water', 'sunflowers against blue sky', 'bouquet of peonies soft light', 'glowing fantasy flowers at night'],
  },
  {
    id: 'gaming', name: 'Gaming', emoji: '🎮', query: 'gaming setup',
    prompts: ['epic fantasy warrior armor glowing', 'futuristic mech robot city', 'rgb gaming setup aesthetic', 'pixel art landscape sunset', 'dragon battle epic scene', 'sci-fi soldier helmet neon'],
  },
  {
    id: 'fantasy', name: 'Fantasy', emoji: '🐉', query: 'fantasy magic',
    prompts: ['floating islands with waterfalls', 'magical forest with glowing mushrooms', 'dragon flying over castle', 'crystal cave with light', 'wizard tower under aurora', 'phoenix rising from fire'],
  },
  {
    id: 'architecture', name: 'Architecture', emoji: '🏛️', query: 'architecture building',
    prompts: ['futuristic white architecture curves', 'old european street at night', 'skyscrapers looking up', 'japanese temple in autumn', 'mosque at blue hour', 'modern glass house in forest'],
  },
  {
    id: 'fractal', name: 'Fractal', emoji: '❄️', query: 'fractal pattern',
    prompts: ['colorful mandelbrot fractal zoom', 'sacred geometry glowing', 'kaleidoscope mandala vibrant', 'infinite spiral fractal gold', 'crystal fractal ice', 'neon fractal tunnel'],
  },
  {
    id: 'geometric', name: 'Geometric', emoji: '🔷', query: 'geometric pattern',
    prompts: ['low poly mountains', 'isometric 3d city colorful', 'hexagon pattern glowing', 'bauhaus shapes poster', 'polygon crystal shards', 'gradient triangles abstract'],
  },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);
