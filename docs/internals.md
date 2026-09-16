# wukong-transmog internals (technical notes; the user-facing README is at the repo root)

Interactive picker for the **True Wukong** mod's transmog feature (Black Myth: Wukong).
Choose looks by their real English item names instead of raw IDs. Only the two
`staffTransmog` / `spearTransmog` lines of `TrueWukongConfig.txt` are touched, and a
timestamped backup of the config is written next to it on every save.

Stats always come from the gear you really wear. Transmog only changes the look.

## Requirements

- Node.js 18+
- Black Myth: Wukong with CSharpLoader (with hook) and True Wukong v10+ installed.
  The config is auto-detected in every Steam library; override with `--config <path>`
  or the `WUKONG_TRANSMOG_CONFIG` environment variable.

## Usage

```
npm install            # once
npm link               # optional: makes the `wukong-transmog` command global

wukong-transmog                        # interactive: arrow-key menu, saves after every pick
wukong-transmog show                   # decode what is currently configured
wukong-transmog list loong             # search the catalog
wukong-transmog list head --all-tiers  # include same-look quality tiers
wukong-transmog set --grip both --weapon "Stormflash" --set "Heaven's Equal"
wukong-transmog set --grip staff --head "Bull King" --arms none
wukong-transmog set --clear
```

Without `npm link`, run `node src/cli.js ...` from this folder.

After saving, press **Ctrl+Enter** in game to reload the mod config (or restart the game).

## Notes on the catalog

- Armor IDs are `1 SS T P`: set family, quality tier, slot (1 head, 2 body, 3 arms, 4 legs).
  Most tiers share a mesh; tiers with a different mesh are listed as "alt look".
- The **Golden Set** is the one whose set bonus is called *Gilded Radiance*.
- Two Great Sage looks exist: **Heaven's Equal Set** (12001-12004, Wukong's True Armor)
  and **Old Monkey King's Armor** (10501-10504, the prologue/fake armor).
- Gourd transmog IDs are listed by the mod but only partly named; treat them as experimental.
- The Centipede (114xx) / Insect (119xx) assignment follows the mod's internal asset names and
  a Chinese-language item table; one English community table swaps them.

## Saved looks and the in-game key (keeperOutfits, keeperOutfitKey)

`keeperOutfits = Name=ids;Name=ids` keeps named ID lists in the config; `keeperOutfitKey = F7`
(the default when the line is missing; or `Ctrl+F7`, `Shift+Alt+O`, `None` = off; key names as in
TrueWukong-KeybindList.txt) is the key
TransmogKeeper v1.5+ registers through the loader's `Utils.RegisterKeyBind`. Pressing it picks the
saved look after the one whose IDs equal the current `staffTransmog` (wrapping around), writes it
into `staffTransmog` / `spearTransmog` itself and applies it at once, so the CLI and the game
always agree. The key is re-bound when the config changes. The keeper only applies IDs that are
listed, so a slot the new look leaves empty keeps the old look until the game re-spawns the pawn.

```
wukong-transmog outfits                 # list, with [wearing]
wukong-transmog outfits save "Boss fits"
wukong-transmog outfits wear boss
wukong-transmog outfits delete boss
wukong-transmog outfits key Ctrl+F7     # none = off
```

## Doctor, update and uninstall

`wukong-transmog doctor` (src/doctor.js) checks loader, mode, patched DLL (see below), keeper,
config sanity, a changed game exe, and reads both logs for "Main mod loaded", "Applied", errors
and refused talents; the menu shows the last log lines under Options > Status.

The release payload carries `CSharpLoader/Mods/TransmogKeeper/payload.version` (tool version and
build date, written by `npm run dist`). It is installed with the keeper; when the bundled stamp
differs from the installed one the menu offers to reinstall the in-game part (config kept).
`settings.json` also records size and date of `b1-Win64-Shipping.exe` so the tool can say
"the game was updated" once.

`wukong-transmog uninstall --yes` (Options > Uninstall in the menu) removes the keeper, True
Wukong and the loader; files the installer replaced (`<name>.bak`) are put back, and the loader
stays when another CSharpLoader mod is present.

## Extra effects (set bonuses and weapon effects without the gear)

The mod's `addTalents` line lists talents the game activates on the player regardless of what is
worn: any armor set bonus (e.g. the Golden Set's 4-piece *Gilded Radiance*, which restores Qi on
critical hits), the special effect of any staff, and single-piece equipment effects. Pick them by
name; the IDs come from the mod's `TrueWukong-TalentList.txt`.

```
wukong-transmog talents                         # what is active, with descriptions
wukong-transmog talents list ebongold           # search; grouped by category and armor set
wukong-transmog talents list armor              # categories: Armor (one block per set: base set
wukong-transmog talents info kang               #   bonuses, piece effect, Mythical-tier bonus and
wukong-transmog talents add "gilded radiance 4-piece"   #   piece), Weapons, Curios, Other
wukong-transmog talents remove 901012
wukong-transmog talents clear
```

The interactive picker asks for the category first, then the armor set, then the effect, and shows
the description of the highlighted entry. Descriptions are curated from the English wiki
(`src/effects.js`): every base set bonus, every set's piece effect, the Mythical-tier extra bonuses
(except Loongscale, whose text was not found), the stand-alone pieces and all staffs from the base
game. Curios and the Gauntlet-of-Legends staffs have texts too (Fextralife, Game8, Fandom); a few curios
the mod lists (106005, 106025, 106035) and head 907003 could not be matched and show no text. Skill-tree nodes are talents too and can be
added by raw ID (Foundation 1001xx-1003xx, stances 1005xx-1008xx, spells 1009xx-1012xx and 2xxxxx,
transformations 3xxxxx), but their names are not in any file the game ships outside its paks.

## Custom values (trainer-like numbers)

```
wukong-transmog values                          # all numeric settings with descriptions
wukong-transmog values set manaRegen 5          # +5 mana every regenInterval seconds
wukong-transmog values set wukongSpeed 1.2
wukong-transmog values attr                     # attributes the keeper can lock
wukong-transmog values attr set MpMax 600       # keeperAttr = MpMax:600
wukong-transmog values attr remove MpMax
```

The numeric settings are True Wukong's own config keys. Each one is marked with where it works:
`[full]` = the mod's hooks (full mode), `[lite]` = TransmogKeeper v1.3+ (health/mana/spirit/vessel
regeneration, passive focus gain, move speed). In full mode the keeper leaves those to the mod so
nothing is applied twice. Attack/defense multipliers, cooldowns and timing windows need full mode.

`keeperAttr` is keeper-only and works in both modes: the listed attributes (max health, max mana,
max Qi, stamina recovery, crit chance, elemental attack, drop bonuses, ...) are re-applied every
second whenever the game recomputes them, like a trainer lock ("not locked" = the game controls the
value). Names are the game's `EBGUAttrFloat` entries; numeric IDs work too. Spell cooldown speed is
not an attribute; use a talent for that instead (Galeguard 4-piece or Heaven's Equal 5-piece).

**Live values.** While a save is loaded, TransmogKeeper v1.4+ writes the player's current attributes
to `b1\Binaries\Win64\TransmogKeeperAttrs.txt` every few seconds. `wukong-transmog values` shows
them (health, mana, Qi, Might, vessel, focus, stamina recovery, crit chance, ...) and every lock row
shows "game now: X", so you can see e.g. your real stamina recovery before locking it a bit higher.
The values are what the game uses at that moment, including buffs and set bonuses.

Resource names as the game uses them: **Mana** powers spells; **Qi** is the separate bar Spirit
Skills use (the mod's `spiritRegen` and the Gilded Radiance set bonus refer to Qi); **Might**
is the transformation gauge; **Focus** is the staff charge; **Vessel** is the vessel's energy.

The interactive picker has the same thing under "Extra effects". In full mode True Wukong applies
the line itself (Ctrl+Enter, then enter and leave a transformation); in lite mode TransmogKeeper
v1.2+ activates the talents within a second and keeps them across respawns and fast travel.
Talents removed from the line are deactivated. A talent the game refuses is logged and given up
after three attempts.

After a buff is added or removed while a save is loaded, the CLI waits for the keeper's next attribute
snapshot and prints the attributes that changed (volatile bars such as current health are ignored).

Weapon talents stack with the worn weapon's own effect. Set-bonus talents do not need the
matching pieces; the game only checks the talent itself.

## Mod patcher (optional but recommended)

`patcher/` contains a small .NET 8 program that edits `TrueWukong.dll` in place
(the original is kept as `TrueWukong.dll.orig`):

1. Ctrl+Enter in game now re-applies the transmog immediately, so no restart is needed.
   Without the patch, press Tab twice (grip switch there and back) after Ctrl+Enter.
2. The mod's hard-coded "hold jump to jump higher" buff is removed.
3. The mod's "stride jump always allowed" override is disabled.
4. The mod's hard-coded debug hotkeys (F4-F9, F12) are unbound, so they cannot collide with trainer hotkeys.
5. The mod no longer aborts when Harmony hooks cannot be installed, which makes "lite" mode possible.
6. A string constant `TrueWukong.TransmogToolPatch = "TransmogTool-patched"` is added. The tool
   looks for it (UTF-16 in the DLL) to know the DLL is patched; the release ships no `.orig`.

Run it with `npm run patch-mod` (needs the .NET 8 SDK). If the game is running the DLL is
locked and the result lands in `TrueWukong.dll.pending`; close the game and run it again.
Re-run after updating the mod, deleting `TrueWukong.dll.orig` first if the mod version changed.

## Trainers (FLiNG, WeMod, ...) and mod modes

CSharpLoader runs the game's Mono runtime in JIT mode (`EnableJit=1`) so that Harmony hooks work.
That JIT switch is what breaks trainers. Switch modes with the game closed:

```
wukong-transmog mod status   # what is active now
wukong-transmog mod full     # hooks on: the whole mod, trainers usually broken
wukong-transmog mod lite     # EnableJit=0: no hooks, transmog only, trainers work
wukong-transmog mod off      # loader disabled (version.dll renamed): pure vanilla
```

Lite mode needs the patched DLL. In lite mode nothing applies automatically: after loading a save
(and after every respawn) press Ctrl+Enter once to put the look on. Tab still switches grips.

## TransmogKeeper (auto re-apply, no hotkey)

`keeper/` is a tiny companion mod for CSharpLoader. Once a second it compares the player's shown
equipment with the `staffTransmog` line and re-applies only slots that differ. It needs no hooks,
so it works in lite mode and covers game start, fast travel, death, cutscenes and config edits
(the config file is watched, so a CLI save shows up in game within a second).

```
npm run fetch-refs       # once: download the game's managed reference DLLs into keeper/lib
npm run install-keeper   # build with the .NET 8 SDK and copy into CSharpLoader/Mods/TransmogKeeper
```

Log: `b1\Binaries\Win64\TransmogKeeperLog.txt`. It follows `staffTransmog` only, so keep both grips
identical (the CLI always writes both).

The log also records every change of the game's shown-equipment state (`MapEquip`, `SelfEquipMap`
and `EquipIllusionList`). Create an empty `b1\Binaries\Win64\TransmogKeeperDebug.txt` to additionally
log the player's buff list whenever it changes (throttled to one line per 5 s); delete the file to stop.
While the game has an equip "illusion" active (a buff temporarily overriding a slot's look), the keeper
waits instead of applying, because the game would record the change without showing it.
