// TransmogKeeper - companion mod for True Wukong (Black Myth: Wukong, CSharpLoader).
//
// Keeps the transmog look applied without any Harmony hooks, so it works with
// EnableJit=0 ("lite" mode, trainer-friendly). Once a second, on the game thread,
// it compares the player's currently shown equipment with the staffTransmog list
// in TrueWukongConfig.txt and re-applies only the slots that differ. That covers
// game start, fast travel, death, cutscenes and config edits (the file is watched).
//
// It also honours, without hooks:
//   addTalents            talents kept active on the player (set bonuses, weapon effects, ...)
//   healthRegen, manaRegen, spiritRegen, vesselRegen, regenInterval, focusRegen,
//   allowPassiveFocusOvercharge   the mod's regeneration settings (same semantics)
//   wukongSpeed           move speed multiplier
//   keeperAttr            keeper-only: "Name:value,Name:value" attribute overrides
//                         (names from EBGUAttrFloat, e.g. MpMax:500, StaminaRecover:2),
//                         re-applied whenever the game changes them back
//   keeperSoaks           keeper-only: soak item IDs (2301-2329) whose gourd effect is kept active by
//                         raising Evt_TriggerWinePartner whenever one of the soak's buffs is missing
//   keeperOutfits         keeper-only: saved looks "Name=id,id;Name=id,id"
//   keeperOutfitKey       keeper-only: key ("F7", "Ctrl+F7", "None") that puts on the next saved
//                         look in game; the chosen look is written back into staffTransmog /
//                         spearTransmog so the tool and the game agree
//
// Diagnostics: every change of the game's shown-equipment state is logged. If a file
// named TransmogKeeperDebug.txt exists next to the log, buff-list changes are logged too.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CSharpModBase;
using UnrealEngine.Engine;
using UnrealEngine.Runtime;
using b1;
using BtlB1;
using BtlShare;

namespace TransmogKeeper
{
    public class TransmogKeeper : ICSharpMod
    {
        public string Name => "TransmogKeeper";
        public string Version => "1.6.0";

        private static readonly string BaseDir = AppDomain.CurrentDomain.BaseDirectory; // b1/Binaries/Win64
        private static readonly string ConfigPath = Path.Combine(BaseDir, "CSharpLoader", "Mods", "TrueWukong", "TrueWukongConfig.txt");
        private static readonly string LogPath = Path.Combine(BaseDir, "TransmogKeeperLog.txt");
        private static readonly string DebugMarker = Path.Combine(BaseDir, "TransmogKeeperDebug.txt");

        private const int TickMs = 1000;
        private const double CooldownSeconds = 3;      // after applying a look, wait before re-checking the same pawn
        private const double TalentRetrySeconds = 10;  // a talent the game did not accept is retried this often
        private const int TalentMaxAttempts = 3;       // ... this many times per pawn, then given up (logged)
        private const double BuffLogSeconds = 5;       // debug: at most one buff-list line per this interval

        // Attribute IDs (EBGUAttrFloat): current value / maximum
        private const EBGUAttrFloat Hp = (EBGUAttrFloat)151, HpMax = (EBGUAttrFloat)1;
        private const EBGUAttrFloat Mp = (EBGUAttrFloat)152, MpMax = (EBGUAttrFloat)2;
        private const EBGUAttrFloat Vigor = (EBGUAttrFloat)202, VigorMax = (EBGUAttrFloat)17;   // spirit (Vigor)
        private const EBGUAttrFloat Vessel = (EBGUAttrFloat)201, VesselMax = (EBGUAttrFloat)16; // vessel energy
        private const EBGUAttrFloat Focus = (EBGUAttrFloat)191;                                 // focus (Pevalue)

        private CancellationTokenSource _cts;
        private readonly List<int> _ids = new List<int>();
        private readonly List<int> _talents = new List<int>();
        private readonly List<int> _talentsToDeactivate = new List<int>();
        private readonly Dictionary<int, (DateTime next, int attempts)> _talentTries = new Dictionary<int, (DateTime, int)>();
        private readonly Dictionary<string, float> _num = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, bool> _bool = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        private readonly List<(EBGUAttrFloat attr, float value)> _attrs = new List<(EBGUAttrFloat, float)>();
        private readonly List<(string name, List<int> ids)> _outfits = new List<(string, List<int>)>();
        private readonly List<int> _soaks = new List<int>();                 // keeperSoaks: soak item IDs kept "drunk"
        private readonly Dictionary<int, DateTime> _soakNext = new Dictionary<int, DateTime>();
        private const double SoakRetrySeconds = 5;                            // re-trigger an instant/expired soak effect this often
        private string _hotkeyText = "F7"; // default when keeperOutfitKey is missing
        private CSharpModBase.Input.HotKeyItem _hotkey;
        private DateTime _configStamp = DateTime.MinValue;
        private string _lastPawn = "";
        private string _lastTalentPawn = "";
        private string _lastSpeedPawn = "";
        private bool _speedWasSet;
        private DateTime _lastApply = DateTime.MinValue;
        private DateTime _lastRegen = DateTime.MinValue;
        private string _lastLogged = "";
        private string _lastEquipSnapshot = "";
        private string _lastBuffSnapshot = "";
        private DateTime _lastBuffLog = DateTime.MinValue;

        public void Init()
        {
            try { File.WriteAllText(LogPath, ""); } catch { }
            LoadConfig();
            _cts = new CancellationTokenSource();
            var token = _cts.Token;
            Task.Run(() => Loop(token));
            Log($"Started. Config: {ConfigPath}. Buff logging: {(File.Exists(DebugMarker) ? "on" : "off (create " + DebugMarker + " to enable)")}");
        }

        public void DeInit()
        {
            _cts?.Cancel();
            Log("Stopped.");
        }

        private async Task Loop(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try { Utils.TryRunOnGameThread(Tick); }
                catch (Exception e) { Log("loop error: " + e.Message); }
                try { await Task.Delay(TickMs, token); } catch (TaskCanceledException) { }
            }
        }

        private void Tick()
        {
            try
            {
                if (ConfigChanged())
                {
                    LoadConfig();
                    // Full mode: True Wukong reads its config only at start and on Ctrl+Enter. Call its
                    // LoadConfig so regen, cooldowns and the values for the next respawn follow a save from the tool.
                    if (FullMode()) Stage("reload", ReloadTrueWukong);
                }

                APawn pawn = GetControlledPawn();
                if (pawn == null) return;
                string name = pawn.GetName();
                if (!name.Contains("Unit_Player_Wukong")) return; // transformed / not the monkey

                IBUC_EquipData data = BGU_DataUtil.GetReadOnlyData<IBUC_EquipData, BUC_EquipData>(pawn);
                if (data == null || data.MapEquip == null) return;

                LogEquipState(name, data);
                if (File.Exists(DebugMarker)) LogBuffState(pawn);
                if (!_dumped && File.Exists(DumpMarker)) Stage("dump", DumpTables);

                // Each stage is isolated: a failure in one (e.g. a game update renaming a type used
                // by the talent code) must not stop the others, and the look comes first.
                Stage("look", () => KeepLook(pawn, name, data));
                Stage("talents", () => KeepTalents(pawn, name));
                Stage("soaks", () => KeepSoaks(pawn, name));
                Stage("values", () => KeepValues(pawn, name));
                Stage("snapshot", () => WriteAttrSnapshot(pawn));
            }
            catch (Exception e)
            {
                LogOnce("tick error: " + e);
            }
        }

        private readonly Dictionary<string, string> _stageErrors = new Dictionary<string, string>();

        private void Stage(string stage, Action action)
        {
            try { action(); }
            catch (Exception e)
            {
                string msg = e.GetType().Name + ": " + e.Message;
                string prev;
                if (_stageErrors.TryGetValue(stage, out prev) && prev == msg) return;
                _stageErrors[stage] = msg;
                Log($"{stage} error: {e}");
            }
        }

        // The game's event collection is reached through reflection so that a renamed delegate type
        // in a newer game build cannot break loading of this whole class (it happened with
        // GSDel_Void_Int_ICB once: the whole Tick failed to JIT and no transmog was applied).
        private static bool InvokeEvent(object events, string eventName, params object[] args)
        {
            if (events == null) return false;
            var prop = events.GetType().GetProperty(eventName);
            object ev = prop != null ? prop.GetValue(events) : events.GetType().GetField(eventName)?.GetValue(events);
            if (ev == null) return false;
            var types = args.Select(a => a.GetType()).ToArray();
            var invoke = ev.GetType().GetMethod("Invoke", types);
            if (invoke == null) return false;
            invoke.Invoke(ev, args);
            return true;
        }

        // ---------- transmog ----------

        private void KeepLook(APawn pawn, string name, IBUC_EquipData data)
        {
            if (_ids.Count == 0) return;
            if (name == _lastPawn && (DateTime.UtcNow - _lastApply).TotalSeconds < CooldownSeconds) return;

            // While the game has an "illusion" override active (a buff temporarily replacing a
            // slot's look, e.g. an electrified weapon), BUS_EquipComp.OnChangeEquipReal updates
            // MapEquip but skips the visual change. Applying now would make the keeper believe
            // the look is on when it is not, so wait until the illusion is gone.
            if (data.EquipIllusionList != null && data.EquipIllusionList.Count > 0)
            {
                LogOnce($"Illusion active on {string.Join(",", data.EquipIllusionList.Keys)}; not applying until it ends");
                return;
            }

            var missing = new List<int>();
            foreach (int id in _ids)
            {
                var desc = GameDBRuntime.GetEquipDesc(id);
                if (desc == null) continue;
                int shown;
                if (!data.MapEquip.TryGetValue(desc.EquipPosition, out shown) || shown != id) missing.Add(id);
            }

            _lastPawn = name;
            if (missing.Count == 0) return;

            foreach (int id in missing) BGUFunctionLibraryCS.ChangeEquip(pawn, id);
            _lastApply = DateTime.UtcNow;
            Log($"Applied {string.Join(",", missing)} on {name}");
        }

        // ---------- extra talents ----------

        private void KeepTalents(APawn pawn, string name)
        {
            if (_talents.Count == 0 && _talentsToDeactivate.Count == 0) return;

            IBUC_TalentData talentData = BGU_DataUtil.GetUnPersistentReadOnlyData<IBUC_TalentData, BUC_TalentData>(pawn);
            if (talentData == null) return;
            object events = BUS_EventCollectionCS.Get(pawn);
            if (events == null) return;

            if (name != _lastTalentPawn)
            {
                _lastTalentPawn = name;
                _talentTries.Clear(); // new pawn: everything may be retried
            }

            if (_talentsToDeactivate.Count > 0)
            {
                foreach (int id in _talentsToDeactivate)
                {
                    if (talentData.HasTalent(id) && !InvokeEvent(events, "Evt_DeactivateTalent", id))
                        LogOnce("Evt_DeactivateTalent not found on the event collection; cannot deactivate talents");
                }
                Log($"Deactivated talents {string.Join(",", _talentsToDeactivate)} on {name}");
                _talentsToDeactivate.Clear();
            }

            var now = DateTime.UtcNow;
            var applied = new List<int>();
            foreach (int id in _talents)
            {
                if (talentData.HasTalent(id)) { _talentTries.Remove(id); continue; }
                (DateTime next, int attempts) t;
                if (_talentTries.TryGetValue(id, out t))
                {
                    if (t.attempts >= TalentMaxAttempts)
                    {
                        LogOnce($"Talent {id} was not accepted by the game on {name} after {TalentMaxAttempts} attempts; giving up until the next respawn");
                        continue;
                    }
                    if (now < t.next) continue;
                }
                else t = (now, 0);
                if (!InvokeEvent(events, "Evt_ActivateTalent", id, 1))
                {
                    LogOnce("Evt_ActivateTalent not found on the event collection; extra talents are unavailable in this game build");
                    return;
                }
                _talentTries[id] = (now.AddSeconds(TalentRetrySeconds), t.attempts + 1);
                applied.Add(id);
            }
            if (applied.Count > 0) Log($"Activated talents {string.Join(",", applied)} on {name}");
        }

        // ---------- soaks (gourd additives) ----------
        // Drinking from the gourd raises Evt_TriggerWinePartner(soakId); the game then adds the buffs of
        // that soak's ConsumeDesc (BUS_UnitItemComp.OnTriggrWinePartnerEffect). The keeper raises the same
        // event whenever one of the soak's buffs is missing, so the effect behaves as if you had just drunk.
        // Instant effects (a buff that ends at once) are repeated every SoakRetrySeconds.

        private void KeepSoaks(APawn pawn, string name)
        {
            if (_soaks.Count == 0) return;
            if (Get(pawn, Hp) <= 0f) return;
            object events = BUS_EventCollectionCS.Get(pawn);
            if (events == null) return;
            var now = DateTime.UtcNow;
            foreach (int soak in _soaks)
            {
                DateTime next;
                if (_soakNext.TryGetValue(soak, out next) && now < next) continue;
                var desc = GameDBRuntime.GetConsumeDesc(soak);
                if (desc == null) { LogOnce($"keeperSoaks: {soak} is not a consumable the game knows"); _soakNext[soak] = now.AddSeconds(60); continue; }
                // Evt_TriggerWinePartner takes a trigger *type* and only fires for soaks slotted in the gourd,
                // so add the soak's buffs directly, exactly as BUS_UnitItemComp.OnTriggrWinePartnerEffect does
                // (source type 40, default duration).
                var added = new List<int>();
                foreach (var fx in desc.ConsumeEffect)
                {
                    if (fx.EffectType != ResB1.ConsumeEffectType.Buff) continue;
                    if (BGUFunctionLibraryCS.BGUHasBuffByID(pawn, fx.EffectId)) continue;
                    BGUFunctionLibraryCS.BGUAddBuff(pawn, pawn, fx.EffectId, (EBuffSourceType)40, 0f);
                    added.Add(fx.EffectId);
                }
                if (added.Count == 0) { _soakNext[soak] = now.AddSeconds(1); continue; }
                _soakNext[soak] = now.AddSeconds(SoakRetrySeconds);
                if (!_soakLogged.Contains(soak)) { _soakLogged.Add(soak); Log($"Soak {soak}: buff {string.Join(",", added)} added on {name}"); }
            }
        }
        private readonly HashSet<int> _soakLogged = new HashSet<int>();

        // ---------- numeric values: regen, speed, attribute overrides ----------

        private float Num(string key, float fallback = 0f)
        {
            float v;
            return _num.TryGetValue(key, out v) ? v : fallback;
        }

        private static float Get(APawn pawn, EBGUAttrFloat a) => BGUFunctionLibraryCS.GetAttrValue(pawn, a);
        private static void Set(APawn pawn, EBGUAttrFloat a, float v) => BGUFunctionLibraryCS.BGUSetAttrValue(pawn, a, v);

        private static readonly string IniPath = Path.Combine(BaseDir, "CSharpLoader", "b1cs.ini");
        private DateTime _iniStamp = DateTime.MinValue;
        private bool _fullMode;

        // In full mode (EnableJit=1) True Wukong's own hooks apply regen, speed and multipliers;
        // running them here too would double them. keeperAttr is keeper-only and always applies.
        private bool FullMode()
        {
            try
            {
                if (!File.Exists(IniPath)) return false;
                var stamp = File.GetLastWriteTimeUtc(IniPath);
                if (stamp != _iniStamp)
                {
                    _iniStamp = stamp;
                    _fullMode = File.ReadAllLines(IniPath).Any(l => l.Replace(" ", "").StartsWith("EnableJit=1"));
                    Log($"Mode: {(_fullMode ? "full (regen/speed left to True Wukong)" : "lite (regen/speed handled here)")}");
                }
            }
            catch { }
            return _fullMode;
        }

        // Same as Ctrl+Enter in True Wukong: its static LoadConfig() re-reads TrueWukongConfig.txt. Found by
        // reflection so that the keeper does not depend on the mod's assembly (and survives its absence).
        private void ReloadTrueWukong()
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                Type type;
                try { type = asm.GetType("CSharpModExample.TrueWukong", false); } catch { continue; }
                if (type == null) continue;
                var method = type.GetMethod("LoadConfig", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
                if (method == null || method.GetParameters().Length != 0) { LogOnce("True Wukong has no LoadConfig(); values need Ctrl+Enter"); return; }
                method.Invoke(null, null);
                Log("True Wukong config reloaded (values apply; attack/defense multipliers at the next respawn)");
                return;
            }
            LogOnce("True Wukong not loaded; nothing to reload");
        }

        private void KeepValues(APawn pawn, string name)
        {
            bool full = FullMode();

            // Attribute overrides: re-apply whenever the game recomputed them.
            if (Get(pawn, Hp) > 0f)
            {
                foreach (var (attr, value) in _attrs)
                {
                    if (Math.Abs(Get(pawn, attr) - value) > 0.01f) Set(pawn, attr, value);
                }
            }
            // Move speed: once per pawn (and after a config reload, which clears _lastSpeedPawn). Setting a
            // rate is idempotent, so this is safe in full mode too, where True Wukong sets the same rate at
            // the next respawn; here it takes effect right after a save.
            float speed = Num("wukongSpeed", 1f);
            if (name != _lastSpeedPawn)
            {
                _lastSpeedPawn = name;
                if (speed > 0f && Math.Abs(speed - 1f) > 0.001f)
                {
                    BGUFunctionLibraryCS.BGUAISetSpeedRate(pawn, speed);
                    Log($"Speed rate {speed} on {name}");
                }
                else if (full == false || _speedWasSet) { BGUFunctionLibraryCS.BGUAISetSpeedRate(pawn, 1f); }
                _speedWasSet = speed > 0f && Math.Abs(speed - 1f) > 0.001f;
            }
            if (full) return;

            if (Get(pawn, Hp) <= 0f) return; // dead: no regen

            // Focus: focusRegen is "per second"; the mod adds regen/20 every 50 ms up to 3 (or 4) points.
            float focusRegen = Num("focusRegen");
            if (focusRegen > 0f)
            {
                bool over;
                float limit = _bool.TryGetValue("allowPassiveFocusOvercharge", out over) && over ? 465f : 330f;
                float cur = Get(pawn, Focus);
                if (cur < limit) Set(pawn, Focus, Math.Min(limit, cur + focusRegen));
            }

            // Health / mana / spirit / vessel: +value every regenInterval seconds, capped at the maximum.
            float interval = Math.Max(0.5f, Num("regenInterval", 2f));
            if ((DateTime.UtcNow - _lastRegen).TotalSeconds < interval) return;
            _lastRegen = DateTime.UtcNow;
            Regen(pawn, "healthRegen", Hp, HpMax);
            Regen(pawn, "manaRegen", Mp, MpMax);
            Regen(pawn, "spiritRegen", Vigor, VigorMax);
            Regen(pawn, "vesselRegen", Vessel, VesselMax);
        }

        private void Regen(APawn pawn, string key, EBGUAttrFloat cur, EBGUAttrFloat max)
        {
            float amount = Num(key);
            if (amount <= 0f) return;
            float c = Get(pawn, cur), m = Get(pawn, max);
            if (c < 0f || c >= m) return;
            Set(pawn, cur, Math.Min(m, c + amount));
        }

        // ---------- live attribute snapshot for the CLI ----------

        private static readonly string AttrsPath = Path.Combine(BaseDir, "TransmogKeeperAttrs.txt");
        private const double SnapshotSeconds = 3;
        private DateTime _lastSnapshot = DateTime.MinValue;
        private string _lastSnapshotBody = "";

        // Writes every named EBGUAttrFloat of the player as "Name=value" so wukong-transmog can show
        // what the game currently uses (e.g. before choosing a lock value).
        private void WriteAttrSnapshot(APawn pawn)
        {
            if ((DateTime.UtcNow - _lastSnapshot).TotalSeconds < SnapshotSeconds) return;
            _lastSnapshot = DateTime.UtcNow;
            var sb = new System.Text.StringBuilder();
            foreach (EBGUAttrFloat a in Enum.GetValues(typeof(EBGUAttrFloat)))
            {
                string n = a.ToString();
                if (n == "None" || n == "AttrFloatMax" || n == "EnumMax") continue;
                float v;
                try { v = Get(pawn, a); } catch { continue; }
                sb.Append(n).Append('=').Append(v.ToString("0.####", CultureInfo.InvariantCulture)).Append('\n');
            }
            string body = sb.ToString();
            if (body == _lastSnapshotBody) return; // unchanged: keep the old timestamp
            _lastSnapshotBody = body;
            try
            {
                File.WriteAllText(AttrsPath, "time=" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "\n" + body);
            }
            catch (Exception e) { LogOnce("snapshot error: " + e.Message); }
        }

        // ---------- diagnostics ----------

        // Developer dump: create TransmogKeeperDump.txt next to the log and the keeper writes the game's
        // talent, wine and item tables (soaks, drinks, gourds, consumables) to TransmogKeeperTables.txt once.
        private static readonly string DumpMarker = Path.Combine(BaseDir, "TransmogKeeperDump.txt");
        private static readonly string DumpPath = Path.Combine(BaseDir, "TransmogKeeperTables.txt");
        private bool _dumped;

        private void DumpTables()
        {
            _dumped = true;
            var sb = new System.Text.StringBuilder();
            var section = new Action<string, Action>((title, body) =>
            {
                sb.AppendLine(title);
                try { body(); } catch (Exception e) { sb.AppendLine("  error: " + e.Message); }
                sb.AppendLine();
            });
            section("TALENTS\tid\tname\ttype\trank\tgroup\taddBuffIDs\tpassiveSkillIDs\tmaxLevel\thide", () =>
            {
                foreach (var t in GameDBRuntime.GetTBTalentSDesc().List)
                    sb.AppendLine($"T\t{t.Id}\t{t.Name}\t{t.Type}\t{t.Rank}\t{t.TalentGroupId}\t{t.AddBuffIDs}\t{t.PassiveSkillIDs}\t{t.MaxLevel}\t{t.IsHide}");
            });
            section("WINES\tid\tseries\tlevel\tnext\titemListCount", () =>
            {
                foreach (var w in GameDBRuntime.GetTBWineDesc().List)
                    sb.AppendLine($"W\t{w.Id}\t{w.Series}\t{w.Level}\t{w.NextId}\t{w.ItemListCount}");
            });
            section("HULUS\tid\tseries\tlevel\tnext\tbuffList", () =>
            {
                foreach (var h in GameDBRuntime.GetTBHuluDesc().List)
                    sb.AppendLine($"H\t{h.Id}\t{h.Series}\t{h.Level}\t{h.NextId}\t{string.Join(",", h.BuffList)}");
            });
            section("CONSUMES\tid\ttype\tskillId\twinePartnerTrigger\teffects(type:id)", () =>
            {
                foreach (var c in GameDBRuntime.GetTBConsumeDesc().List)
                    sb.AppendLine($"C\t{c.Id}\t{c.Type}\t{c.SkillId}\t{c.WinePartnerTrigger}\t{string.Join(",", c.ConsumeEffect.Select(e => $"{e.EffectType}:{e.EffectId}"))}");
            });
            section("ITEMS\tid\tname\ttypeName\titemType\tpackage\tparam1\tparam2\tbrief\tdesc\teffectDesc\thudEffectDesc", () =>
            {
                var wanted = new HashSet<ResB1.ItemPackageType> { ResB1.ItemPackageType.WinePartner, ResB1.ItemPackageType.Wine, ResB1.ItemPackageType.WineUpgrade, ResB1.ItemPackageType.Recover, ResB1.ItemPackageType.SpecialEffect, ResB1.ItemPackageType.SpecialElixir, ResB1.ItemPackageType.AtkStrengthen, ResB1.ItemPackageType.DefStrengthen, ResB1.ItemPackageType.Resistance };
                int found = 0;
                for (int id = 1; id < 300000; id++)
                {
                    ResB1.ItemDesc d;
                    try { d = GameDBRuntime.GetItemDesc(id); } catch { continue; }
                    if (d == null) continue;
                    found++;
                    if (!wanted.Contains(d.PackageType) && d.ItemType != ResB1.ItemType.WineUpgrade && d.ItemType != ResB1.ItemType.HuluUpgrade) continue;
                    string clean(string s) => (s ?? "").Replace("\r", " ").Replace("\n", " ").Replace("\t", " ");
                    sb.AppendLine($"I\t{d.Id}\t{clean(d.Name)}\t{clean(d.TypeName)}\t{d.ItemType}\t{d.PackageType}\t{d.Param1}\t{d.Param2}\t{clean(d.BriefDesc)}\t{clean(d.Desc)}\t{clean(d.EffectDesc)}\t{clean(d.HudEffectDesc)}");
                }
                sb.AppendLine($"# items scanned: {found}");
            });
            File.WriteAllText(DumpPath, sb.ToString());
            Log("Tables dumped to " + DumpPath);
        }

        private void LogEquipState(string pawnName, IBUC_EquipData data)
        {
            string snap = $"{pawnName} MapEquip[{Fmt(data.MapEquip)}] SelfEquipMap[{Fmt(data.SelfEquipMap)}] Illusion[{Fmt(data.EquipIllusionList)}]";
            if (snap == _lastEquipSnapshot) return;
            _lastEquipSnapshot = snap;
            Log("Equip state: " + snap);
        }

        private void LogBuffState(APawn pawn)
        {
            if ((DateTime.UtcNow - _lastBuffLog).TotalSeconds < BuffLogSeconds) return;
            IBUC_BuffData buffs = BGU_DataUtil.GetReadOnlyData<IBUC_BuffData, BUC_BuffData>(pawn);
            var all = buffs?.GetAllBuffInstData();
            if (all == null) return;
            string snap = string.Join(",", all.Select(b => b.BuffID).OrderBy(x => x));
            if (snap == _lastBuffSnapshot) return;
            _lastBuffSnapshot = snap;
            _lastBuffLog = DateTime.UtcNow;
            Log("Buffs: " + snap);
        }

        private static string Fmt<T>(Dictionary<EquipPosition, T> map)
        {
            if (map == null) return "null";
            return string.Join(" ", map.Select(kv => $"{kv.Key}={kv.Value}"));
        }

        // ---------- plumbing ----------

        private static APawn GetControlledPawn()
        {
            UObject obj = GCHelper.FindRef(FGlobals.GWorld)?.Managed;
            var world = obj as UWorld;
            if (world == null) return null;
            var pc = UGSE_EngineFuncLib.GetFirstLocalPlayerController(world) as AController;
            return pc?.GetControlledPawn();
        }

        private bool ConfigChanged()
        {
            try
            {
                if (!File.Exists(ConfigPath)) return false;
                var stamp = File.GetLastWriteTimeUtc(ConfigPath);
                return stamp != _configStamp;
            }
            catch { return false; }
        }

        private void LoadConfig()
        {
            var oldTalents = new List<int>(_talents);
            _ids.Clear();
            _talents.Clear();
            _num.Clear();
            _bool.Clear();
            _attrs.Clear();
            _soaks.Clear();
            _soakNext.Clear();
            _lastPawn = "";       // force a re-check of the look
            _hotkeyText = "F7";   // default; overridden by keeperOutfitKey (None = off)
            _lastSpeedPawn = "";  // re-apply speed
            _talentTries.Clear();
            try
            {
                if (!File.Exists(ConfigPath)) { LogOnce("Config not found: " + ConfigPath); return; }
                _configStamp = File.GetLastWriteTimeUtc(ConfigPath);
                foreach (string raw in File.ReadAllLines(ConfigPath))
                {
                    string line = raw.Trim();
                    if (line.Length == 0 || line.StartsWith("#")) continue;
                    int eq = line.IndexOf('=');
                    if (eq < 0) continue;
                    string key = line.Substring(0, eq).Trim();
                    string value = line.Substring(eq + 1).Trim();

                    if (key == "staffTransmog") ParseIds(value, _ids);
                    else if (key == "addTalents") ParseIds(value, _talents);
                    else if (key == "keeperAttr") ParseAttrs(value);
                    else if (key == "keeperOutfits") ParseOutfits(value);
                    else if (key == "keeperSoaks") ParseIds(value, _soaks);
                    else if (key == "keeperOutfitKey") _hotkeyText = value;
                    else
                    {
                        float f; bool b;
                        if (float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out f)) _num[key] = f;
                        else if (bool.TryParse(value, out b)) _bool[key] = b;
                    }
                }
                foreach (int id in oldTalents)
                {
                    if (!_talents.Contains(id) && !_talentsToDeactivate.Contains(id)) _talentsToDeactivate.Add(id);
                }
                var values = new[] { "healthRegen", "manaRegen", "spiritRegen", "vesselRegen", "focusRegen", "wukongSpeed" }
                    .Where(k => _num.ContainsKey(k) && _num[k] != 0f && !(k == "wukongSpeed" && Math.Abs(_num[k] - 1f) < 0.001f))
                    .Select(k => $"{k}={_num[k]}").ToList();
                if (_attrs.Count > 0) values.Add("keeperAttr=" + string.Join(",", _attrs.Select(a => $"{a.attr}:{a.value}")));
                Log($"Config loaded: staffTransmog = {(_ids.Count == 0 ? "none" : string.Join(",", _ids))}; addTalents = {(_talents.Count == 0 ? "none" : string.Join(",", _talents))}; values = {(values.Count == 0 ? "none" : string.Join(" ", values))}; outfits = {_outfits.Count} (key {_hotkeyText})");
            }
            catch (Exception e)
            {
                Log("config error: " + e.Message);
            }
            try { SyncHotkey(); }
            catch (Exception e) { Log("hotkey error: " + e.Message); }
        }

        // ---------- saved looks and the in-game key ----------

        private void ParseOutfits(string value)
        {
            _outfits.Clear();
            foreach (string part in value.Split(';'))
            {
                int eq = part.IndexOf('=');
                if (eq < 0) continue;
                string name = part.Substring(0, eq).Trim();
                if (name.Length == 0) continue;
                var ids = new List<int>();
                ParseIds(part.Substring(eq + 1), ids);
                _outfits.Add((name, ids));
            }
        }

        private static bool ParseHotkey(string text, out CSharpModBase.Input.ModifierKeys mods, out CSharpModBase.Input.Key key)
        {
            mods = CSharpModBase.Input.ModifierKeys.None;
            key = CSharpModBase.Input.Key.None;
            string[] parts = (text ?? "").Split('+').Select(p => p.Trim()).Where(p => p.Length > 0).ToArray();
            if (parts.Length == 0 || parts[parts.Length - 1].Equals("None", StringComparison.OrdinalIgnoreCase)) return true;
            for (int i = 0; i < parts.Length - 1; i++)
            {
                switch (parts[i].ToLowerInvariant())
                {
                    case "ctrl": case "control": mods |= CSharpModBase.Input.ModifierKeys.Control; break;
                    case "alt": mods |= CSharpModBase.Input.ModifierKeys.Alt; break;
                    case "shift": mods |= CSharpModBase.Input.ModifierKeys.Shift; break;
                    case "win": case "windows": mods |= CSharpModBase.Input.ModifierKeys.Windows; break;
                    default: return false;
                }
            }
            return Enum.TryParse(parts[parts.Length - 1], true, out key);
        }

        private string _boundHotkey = "";

        /** Registers, re-binds or disables the in-game key so that it matches the config. */
        private void SyncHotkey()
        {
            if (_hotkeyText == _boundHotkey) return;
            CSharpModBase.Input.ModifierKeys mods;
            CSharpModBase.Input.Key key;
            if (!ParseHotkey(_hotkeyText, out mods, out key))
            {
                Log($"keeperOutfitKey '{_hotkeyText}' is not a key the loader knows (see TrueWukong-KeybindList.txt); key disabled");
                mods = CSharpModBase.Input.ModifierKeys.None;
                key = CSharpModBase.Input.Key.None;
            }
            if (_hotkey == null)
            {
                if (key == CSharpModBase.Input.Key.None) { _boundHotkey = _hotkeyText; return; }
                _hotkey = Utils.RegisterKeyBind(mods, key, NextOutfit);
                if (_hotkey != null) { _hotkey.Label = "TransmogKeeper: next saved look"; _hotkey.RunOnGameThread = true; }
            }
            else _hotkey.WithKey(mods, key);
            _boundHotkey = _hotkeyText;
            Log(key == CSharpModBase.Input.Key.None ? "Outfit key disabled" : $"Outfit key bound: {_hotkeyText}");
        }

        /** Puts on the saved look after the one currently worn (wraps around) and records it in the config. */
        private void NextOutfit()
        {
            try
            {
                if (_outfits.Count == 0) { Log("Outfit key pressed but no saved looks (keeperOutfits is empty)"); return; }
                int cur = _outfits.FindIndex(o => o.ids.SequenceEqual(_ids));
                var next = _outfits[(cur + 1) % _outfits.Count];
                string line = next.ids.Count == 0 ? "0" : string.Join(",", next.ids);
                var lines = File.ReadAllLines(ConfigPath).ToList();
                foreach (string k in new[] { "staffTransmog", "spearTransmog" })
                {
                    int idx = lines.FindIndex(l => l.StartsWith(k + " ="));
                    if (idx >= 0) lines[idx] = $"{k} = {line}";
                    else lines.Add($"{k} = {line}");
                }
                File.WriteAllLines(ConfigPath, lines);
                Log($"Outfit key: switching to \"{next.name}\" ({line})");
                LoadConfig();               // picks up the new list, forces a re-check of the look
                _lastApply = DateTime.MinValue;
                Utils.TryRunOnGameThread(Tick);
            }
            catch (Exception e)
            {
                Log("outfit switch error: " + e.Message);
            }
        }

        private static void ParseIds(string value, List<int> target)
        {
            foreach (string part in value.Split(','))
            {
                int id;
                if (int.TryParse(part.Trim(), out id) && id > 0 && !target.Contains(id)) target.Add(id);
            }
        }

        private void ParseAttrs(string value)
        {
            foreach (string part in value.Split(','))
            {
                string[] kv = part.Split(':');
                if (kv.Length != 2) continue;
                string n = kv[0].Trim();
                float v;
                if (!float.TryParse(kv[1].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out v)) continue;
                EBGUAttrFloat attr;
                int id;
                if (int.TryParse(n, out id)) attr = (EBGUAttrFloat)id;
                else if (!Enum.TryParse(n, true, out attr)) { Log($"keeperAttr: unknown attribute '{n}'"); continue; }
                _attrs.Add((attr, v));
            }
        }

        private void LogOnce(string msg)
        {
            if (msg == _lastLogged) return;
            _lastLogged = msg;
            Log(msg);
        }

        private static void Log(string msg)
        {
            try { File.AppendAllText(LogPath, $"[{DateTime.Now:HH:mm:ss.fff}][TransmogKeeper]: {msg}\n"); } catch { }
        }
    }
}
