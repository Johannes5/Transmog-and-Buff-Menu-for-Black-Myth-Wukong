# Transmog & Buff Tool (Cli)

Wear any look, use any effect. A menu-driven tool for Black Myth: Wukong that lets you:

- **Transmog**: put any armor set, staff or gourd look on top of your real gear. Stats stay as they are.
- **Saved looks**: keep several looks by name and cycle through them in game with one key (F7 by default).
- **Buffs**: activate any set bonus, armor piece effect, staff effect, curio or gourd soak without owning it, on any outfit. Every buff shows its in-game description.
- **Custom buffs**: regeneration, move speed, attack and defense multipliers and more. Every value shows its default and can be reset with one keystroke; reset values stay under "recently active" so you can put them back.

Pick everything by name with the arrow keys. In a look list, Enter (or the right arrow) puts the highlighted look on and keeps the list open, so you can try several in a row with the game running; Esc goes back. Every change is backed up and can be undone from the menu.

Built on a fork of True Wukong by k0v3rt, bundled with his permission; the in-game part of this tool is that mod. Credits at the bottom.

## Installation

1. Close the game.
2. Unpack the zip anywhere and run `Transmog & Buff Tool.bat`.
3. On first start it finds the game folder and asks to install the in-game part there. Confirm. (This copies the mod loader and the mod into `b1\Binaries\Win64`; nothing else on your PC is touched.)
4. Pick a look under Transmog. The tool says "Saved".
5. Start the game and load a save. The look appears when the character spawns.

Done. The mod applies your choices every time you play. Open the tool only when you want to change something, with the game running or not.

Already have True Wukong or CSharpLoader installed? The installer replaces them with the bundled versions and keeps a `.bak` of each replaced file and your existing config. Uninstall puts them back.

(Developers: from a source checkout the `.bat` uses your installed Node.js and an existing game install; `npm run dist` builds the release zip with the bundled runtime and in-game files. `npm test` runs the unit tests.)

## Menu

```
Transmog   change how my gear looks (armor set, single slots, saved looks, in-game key)
Buffs      one list of everything active: set bonuses, piece and weapon effects, curios, soaks,
           and custom buffs (value changes such as regen, speed, attack, defense; attribute locks)
Undo       restore an earlier change
Doctor     check the install and the logs when something does not work
Options    trainer compatibility, game folder, status, uninstall
```

Command line equivalents: `wukong-transmog show | list | set | outfits | buffs | values | undo | doctor | mod | uninstall`. Run `wukong-transmog help`.

## Named buffs

A named buff bundles any number of buffs, soaks and value changes under one name, so "Self Stinger" or "Defence +40%" is one entry you switch on or off. The Buffs screen lists them first. "+ save the active buffs as a named buff" turns whatever is active right now into one; each named buff can get an **in-game key** that toggles it while you play (for example F8), and can be renamed, updated or deleted. A few come with the tool: Movement Speed 2x, Defence +40%, Defence +20%, Mana Regen, Self Stinger (heavy attacks poison the enemy and you) and Heavy Sting (a modified Spider Celestial Staff effect: heavy attacks that spend 3+ Focus points poison the enemy, whether or not you are poisoned).

## Only looks you have unlocked

The Transmog screen has a "Show" switch: every look the game has, or only the ones you have unlocked in your save. The keeper reads your bag while a save is loaded (armor counts by piece in any quality tier, weapons and gourds exactly), so load a save once after installing before the filter has anything to show. The setting is remembered.

## Saved looks and the in-game key

Under Transmog > Saved looks you can save the current look under a name, put a saved look on, and change the **in-game key** (`F7` by default; for example `Ctrl+F7` or `none`). Pressing that key while playing puts on the next saved look, in the order shown in the menu, then your real gear (no transmog), then the first look again. The tool shows which one you are wearing. A slot that one look changes and the next one leaves alone keeps the previous look until the next respawn.

## Notes

**Changing values.** Transmog, buffs and value changes apply within a second while the keeper is installed (it is, by default): the keeper also makes the mod re-read its config, so you never need Ctrl+Enter. Attack and defense multipliers take effect at the next respawn (shrine rest, transformation or reload). When you add or remove a buff while a save is loaded, the tool watches the game for a few seconds and shows which attributes moved.

**Soaks.** A soak from the Soaks category behaves like one slotted in your gourd: the keeper joins the game's own soak trigger, so the effect fires at the same moment of the drink as a slotted soak would, for its normal duration, nothing more. You can have every soak "slotted" this way regardless of how many slots your gourd has. Soaks need the keeper.

**Using a trainer?** If WeMod, FLiNG or Cheat Engine stop attaching after installing the mod loader, close the game, open Options and turn on Trainer compatibility. Looks and buffs then apply within a second on their own. Attack and defense multipliers and the two cooldown timers are unavailable in this mode; the tool marks them.

**What is written where.** One file: `CSharpLoader\Mods\TrueWukong\TrueWukongConfig.txt`, with a dated backup before every save (the last 30 are kept); Undo restores any of them. Save games, Steam files and your real gear and stats are never touched. Buffs are activated on the character while the mod runs and are gone once it is removed.

**No surprise transformations.** The bundled mod has its own gameplay features (turning into the Great Sage or Erlang, parries, spell shortcuts). The ones that fire by accident are switched off in the bundled build; the rest only trigger on key chords the tool's config leaves unbound.

**Antivirus.** `version.dll` in the game folder is the open-source CSharpLoader mod loader. If your antivirus quarantines it, restore it and add an exception.

**Uninstall.** Options > Uninstall (with the game closed) removes the mod loader, the mod and the keeper and puts back any file the installer replaced. Then delete the tool folder. Buffs disappear at the next start. By hand: delete `b1\Binaries\Win64\version.dll` and the `CSharpLoader` folder (or only `CSharpLoader\Mods\TrueWukong` and `CSharpLoader\Mods\TransmogKeeper` if you use other loader mods).

**Update.** Unpack the new version over the old one and start it. Your config and saved looks are kept. If the new version brings a newer in-game part, the tool offers to install it (close the game first).

**Game updates.** When Steam updates the game, the tool tells you on the next start. If looks or buffs stop applying afterwards, run Doctor and check the mod page for a new version.

## Troubleshooting

Run **Doctor** from the menu (or `wukong-transmog doctor`). It checks the loader, the mode, the mod, the keeper and both log files and tells you what to do. The usual answers:

- Nothing applies: Doctor says whether the loader loaded ("Main mod loaded" in `TrueWukongLog.txt`) and whether the keeper put a look on ("Applied" in `TransmogKeeperLog.txt`).
- Game folder not found: pick it in Options > Game folder, or run the `.bat` with `--config "<path>\TrueWukongConfig.txt"`, or set the `WUKONG_TRANSMOG_CONFIG` environment variable.
- Crash on start: a second copy of the mod loader from another mod. Keep one.
- A look shows nothing: entries marked "(unconfirmed)" or "(alt look)" have no mesh. Pick the base tier.
- A buff shows "no description": the text is not in the tool yet; the buff still works.

## Credits and permissions

- The in-game part is a fork of True Wukong by k0v3rt (Nexus Mods), bundled and modified with k0v3rt's permission.
- CSharpLoader by czastack: the mod loader, bundled.
- Node.js runtime, bundled (MIT licence, see `node\LICENSE`).
- Buff descriptions from the Black Myth: Wukong community wikis (Fextralife, Game8, Fandom).
- The tool itself is MIT licensed (see `LICENSE`). Source: https://github.com/Johannes5/Transmog-and-Buff-Menu-for-Black-Myth-Wukong

Technical details (ID schemes, the keeper, the patcher, mod modes, config keys) are in `docs/internals.md`.
