# GLITCH RIG pre DaVinci Resolve

Natívne Fusion nástroje (Fuses s GPU kernelmi v DCTL) a šablóny pre stránku **Edit**.
Efekty pretiahneš z Effects Library priamo na klip alebo na strih. Bežia v reálnom čase
na časovej osi a všetky ovládače sa dajú keyframovať v Inspectore.

Funguje vo **free aj Studio** verzii Resolve: Fuses ani šablóny nepotrebujú UI Manager,
ktorý je od verzie 19.1 vo free verzii vypnutý.

## Čo obsahuje

| Kde v Resolve | Počet | Karty |
|---|---|---|
| Effects (Fusion Effects) | 42 | 21 dot-matrix a znakových lookov (HOLOGRAM, CODE RAIN, KANA RAIN, ASCII, ORBS…), 15 farebných lookov (NIGHT VISION s REC HUD, THERMAL, VHS TAPE, CRT TV, BITCRUSH…), 4 tripy, CLONE TRAIL, CHROMA ECHO |
| Transitions (Fusion Transitions) | 18 | 4 datamoshe (MELT, BLOOM, NEON, ACID) a 14 glitch prechodov |
| Titles (Fusion Titles) | 10 | FUZZ, LIQUID METAL, NEON SIGN, INTERLACE, BRIAR, SMOKE, ICE, GOTHIC, CANDY, TAPE GLOW |

Ovládače majú rovnaké názvy aj rozsahy ako na displeji panelu pre After Effects a Premiere
Pro. Kód efektov je prepis tých istých shaderov.

V Resolve verzii zatiaľ nie sú **BLOB TRACK** ani **HAND FRAME**. Potrebujú sledovanie
objektov a kreslenie textu na CPU a Fusion na to nemá jednoduchú cestu.

## Inštalácia

1. Stiahni repozitár (Code → Download ZIP) a rozbaľ ho.
2. Spusti inštalátor pre svoj systém:
   - **Mac:** `bash glitch-rig/resolve/install/install-resolve-mac.sh`
   - **Windows:** dvojklik na `glitch-rig\resolve\install\install-resolve-win.bat`
   - **Linux:** `bash glitch-rig/resolve/install/install-resolve-linux.sh`
3. Reštartuj DaVinci Resolve.

Inštalátor kopíruje len do tvojho používateľského priečinka Fusion:

| Systém | Priečinok |
|---|---|
| Mac | `~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/` |
| Windows | `%APPDATA%\Blackmagic Design\DaVinci Resolve\Support\Fusion\` |
| Linux | `~/.local/share/DaVinciResolve/Fusion/` |

V ňom vytvorí `Fuses/GlitchRig` a `Templates/Edit/{Effects,Transitions,Titles}/Glitch Rig`.

## Použitie

- **Look:** Effects Library → Effects → nájdi „HOLOGRAM“ (alebo hľadaj „Glitch Rig“) a
  pretiahni ho na klip. Ovládače sú v Inspectore pod záložkou Effects.
- **Prechod:** Effects Library → Transitions → pretiahni napr. „DATAMOSH NEON“ na strih.
  Dĺžku prechodu nastavíš na časovej osi. Klipy potrebujú na strihu presah (handles),
  ako pri každom prechode.
- **Titulok:** Effects Library → Titles → pretiahni štýl na stopu nad video. V Inspectore
  zmeníš TYPE (text), FONT, SIZE a vzhľad.
- **Fusion stránka:** pridaj nástroj cez Add Tool → Fuses → Glitch Rig
  (GR_DotMatrix, GR_Grade, GR_Trip, GR_Echo, GR_Transition, GR_Datamosh, GR_Title).
  Pri prechodoch na Fusion stránke vypni AUTO PROGRESS a animuj PROGRESS.

Prvé použitie každého nástroja chvíľu trvá, lebo Resolve prekladá GPU kernel. Potom už
beží plynulo.

## Stav a testovanie

Resolve som pri vývoji nemal k dispozícii, takže všetko je overené mimo neho:

- Všetky kernely sa preložia a spustia na CPU (`test/dctl_cpu.h`, `test/harness.js`) na
  skutočných záberoch. Výsledok sa takmer na pixel zhoduje s WebGL verziou panelu.
- Každý Fuse prešiel testom proti makete Fusion API (`test/fusion_mock_test.py`, stovky
  volaní `Process()` naprieč voľbami). Test overuje parametre kernelov, mená textúr a
  šablóny.
- Úplne prvé spustenie v skutočnom Resolve je stále prvý ostrý test. Ak niečo zlyhá,
  otvor **Workspace → Console**. Chyby kernelov sa tam vypisujú ako
  `[Glitch Rig] kernel … failed` s logom prekladača. Ten log mi pošli.

## Pre vývoj

Fuses a šablóny sa generujú z katalógu panelu (`../js/catalog.js`) a zo zdrojov v `src/`.
Ručne ich neupravuj:

```bash
node glitch-rig/resolve/build.js                     # Fuses/ a Templates/
python3 glitch-rig/resolve/test/fusion_mock_test.py  # test proti makete Fusion API (pip install lupa)
```
