// The 10 levels. Battle levels hide a key card on one fighter per team;
// ghost levels make you outrun the souls of everyone who fell before.
export const LEVELS = [
  {
    id: 1, type: 'battle', theme: 'courtyard', name: 'Veedu Mutram', sub: 'Home Courtyard',
    story: 'The family feud explodes in the courtyard! One enemy secretly carries the KEY CARD - nobody knows who. It only appears when its carrier falls.',
    tip: 'Defeat enemies until the key card drops, grab it and run to the gate.',
    allies: 3, enemies: 4, acc: 0.3, enemyHp: 90, music: 'battle',
  },
  {
    id: 2, type: 'ghost', theme: 'forest', name: 'Aathma Paathai', sub: 'Path of Souls',
    story: 'Everyone who fell in the courtyard has returned as an aathma (soul)! They chase you down the dark forest path.',
    tip: 'Shoot the souls and follow the path to the glowing gate.',
    allies: 2, ghostSpeed: 3.6, ghostHp: 55, weather: 'fireflies', music: 'ghost',
  },
  {
    id: 3, type: 'battle', theme: 'night', name: 'Iravu Theru', sub: 'Night Street',
    story: 'Power cut on the street! Use your flashlight - enemies hide in the dark between the street lamps.',
    tip: 'Enemy armbands glow faintly. Watch for muzzle flashes.',
    allies: 3, enemies: 5, acc: 0.34, enemyHp: 100, flashlight: true, music: 'battle',
  },
  {
    id: 4, type: 'ghost', theme: 'bridge', name: 'Aavi Paalam', sub: 'Spirit Bridge',
    story: 'You are ALONE on broken rope bridges above a burning abyss. Flying souls swoop at you.',
    tip: 'JUMP over the broken gaps. Falling costs health and sends you back.',
    allies: 0, ghostSpeed: 3.8, ghostHp: 60, music: 'ghost',
  },
  {
    id: 5, type: 'battle', theme: 'rooftop', name: 'Mazhai Maadi', sub: 'Rainy Rooftop',
    story: 'Thunderstorm on the rooftop! This time EVERY fallen enemy drops a key card - but only ONE is real.',
    tip: 'Fake key cards explode! Choose wisely.',
    allies: 3, enemies: 5, acc: 0.36, enemyHp: 105, weather: 'rain', decoys: true, lightning: true, music: 'battle',
  },
  {
    id: 6, type: 'ghost', theme: 'graveyard', name: 'Kallarai Kaadu', sub: 'Blood Moon Graveyard',
    story: 'Under the blood moon the souls are restless. The gate closes in 120 seconds!',
    tip: 'Keep moving. Do not stop to fight every soul.',
    allies: 2, ghostSpeed: 4.0, ghostHp: 65, timer: 120, music: 'ghost',
  },
  {
    id: 7, type: 'battle', theme: 'desert', name: 'Manal Puyal', sub: 'Sandstorm Ruins',
    story: 'A sandstorm hides the ancient ruins. Enemy reinforcements keep arriving until you grab the key card.',
    tip: 'Visibility is low - fight close and fast.',
    allies: 3, enemies: 5, acc: 0.38, enemyHp: 110, weather: 'sand', reinforce: true, music: 'battle',
  },
  {
    id: 8, type: 'ghost', theme: 'ice', name: 'Pani Yeri', sub: 'Frozen Lake',
    story: 'A frozen lake - the ice is SLIPPERY! A soul\'s icy touch freezes you for a moment.',
    tip: 'Plan your slides. Shoot souls before they reach you.',
    allies: 2, ghostSpeed: 4.0, ghostHp: 70, weather: 'snow', ice: true, music: 'ghost',
  },
  {
    id: 9, type: 'battle', theme: 'volcano', name: 'Erimalai', sub: 'Volcano Valley',
    story: 'The volcano erupts! Meteors rain down and the lava river splits the valley.',
    tip: 'Red circles on the ground = meteor coming. Cross the lava only on bridges.',
    allies: 3, enemies: 6, acc: 0.4, enemyHp: 115, weather: 'ash', meteors: true, music: 'battle',
  },
  {
    id: 10, type: 'boss', theme: 'temple', name: 'Munnorgal Kovil', sub: "Ancestors' Temple",
    story: 'Your endless fighting has awakened the ANCESTOR SPIRIT! Parents and sons must UNITE to defeat it.',
    tip: 'Dodge the glowing orbs. Aim for the head!',
    allies: 4, ghostSpeed: 4.2, ghostHp: 60, bossHp: 4500, music: 'boss',
  },
];

export const NAMES = {
  parents: [['father', 'Appa'], ['mother', 'Amma'], ['father', 'Periyappa'], ['mother', 'Periyamma'], ['father', 'Chithappa'], ['mother', 'Chithi'], ['father', 'Mama'], ['mother', 'Athai']],
  sons: [['son', 'Arun'], ['son', 'Karthik'], ['son', 'Vijay'], ['son', 'Surya'], ['son', 'Ravi'], ['son', 'Ajith'], ['son', 'Dhanush'], ['son', 'Vikram']],
};
