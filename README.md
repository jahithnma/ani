# Family War 3D — Parents vs Sons

**A 3D attack game created by Jahith.**

The family feud has turned into a war! Pick a side — **Parents** (Appa, Amma, Periyappa, Chithi…) or **Sons** (Arun, Karthik, Vijay, Surya…) — and fight through 10 fully 3D levels.

## The concept

- **Hidden key card:** one fighter on *each* team secretly carries a key card. Nobody knows who. The card only appears when its carrier falls. Grab the enemy's card and reach the glowing gate to escape to the next level.
- **Don't lose yours:** if your team's carrier falls, the enemy will try to grab *your* card and run for the gate. Stop them, or you lose the level.
- **Souls return:** on the next level, the *aathmas* (souls) of everyone who fell come back to chase you. Shoot them and run along the path to the gate. The more people fell before, the more souls come back.
- **Final level:** your fighting wakes the Ancestor Spirit. Parents and sons must **unite** to defeat it.

## The 10 levels

| # | Level | Type | Twist |
|---|-------|------|-------|
| 1 | Veedu Mutram — Home Courtyard | Battle | Find the hidden key carrier |
| 2 | Aathma Paathai — Path of Souls | Soul escape | Souls of the fallen chase you through a dusk forest |
| 3 | Iravu Theru — Night Street | Battle | Power cut: fight with a flashlight |
| 4 | Aavi Paalam — Spirit Bridge | Soul escape | Alone on broken bridges over an abyss: jump the gaps |
| 5 | Mazhai Maadi — Rainy Rooftop | Battle | Every enemy drops a card, only one is real. Fake cards explode |
| 6 | Kallarai Kaadu — Blood Moon Graveyard | Soul escape | The gate closes in 120 seconds |
| 7 | Manal Puyal — Sandstorm Ruins | Battle | Low visibility and endless enemy reinforcements |
| 8 | Pani Yeri — Frozen Lake | Soul escape | Slippery ice; a soul's touch freezes you |
| 9 | Erimalai — Volcano Valley | Battle | Meteor strikes and a lava river |
| 10 | Munnorgal Kovil — Ancestors' Temple | Boss | Parents and sons unite against the Ancestor Spirit |

## Download the APK

Every push builds an Android APK with GitHub Actions (`.github/workflows/build-apk.yml`):

1. Open the repository's **Releases** page (or the **Actions** tab → latest *Build APK* run → *Artifacts*).
2. Download `FamilyWar3D-by-Jahith.apk` on your Android phone.
3. Open it and allow *Install unknown apps* when Android asks.

The APK is signed with a debug key, which is fine for installing on your own phones. Publishing on the Play Store needs a release keystore.

## Controls

- **Phone:** left side of the screen = move joystick, right side = drag to aim. FIRE (hold, and drag on it to aim), JUMP, RELOAD, RUN.
- **PC browser:** WASD to move, mouse to aim, click to fire, Space to jump, Shift to run, R to reload, Esc to pause.

## Build it yourself

```bash
npm install
npm run dev            # play in the browser at http://localhost:5173
npm run android:apk    # needs the Android SDK + Java 21; APK at android/app/build/outputs/apk/debug/
```

## Tech

- [three.js](https://threejs.org) for the 3D rendering: real-time shadows, ACES tone mapping, bloom glow, fog, rain/snow/sand/ember particles and procedural textures. There are no image or model files: every character, building and texture is generated in code.
- WebAudio-synthesized sound effects and music.
- [Capacitor](https://capacitorjs.com) wraps the game as an Android app (landscape, fullscreen).
- Graphics quality (Low / Medium / High), aim sensitivity and sound are in **Settings**.

© Jahith
