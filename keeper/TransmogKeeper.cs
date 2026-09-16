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
        public string Version => "1.7.0";

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
        private readonly List<int> _soaks = new List<int>();                 // keeperSoaks: soaks applied on gourd drinks
        private readonly List<int> _keptBuffs = new List<int>();             // keeperBuffs: buff IDs re-added whenever missing
        private readonly List<int> _heavyBuffs = new List<int>();            // keeperBuffs "id@heavy": added when a 3+ point Focus spend is seen
        private readonly Dictionary<int, DateTime> _keptBuffNext = new Dictionary<int, DateTime>();
        private APawn _pawnRef;                                               // the player pawn seen by the last Tick
        private float _focusPrev = -1f;                                       // Focus gauge value at the last fast poll
        private readonly Dictionary<int, DateTime> _soakNext = new Dictionary<int, DateTime>();
        private const double SoakRetrySeconds = 5;                            // re-trigger an instant/expired soak effect this often
        private string _hotkeyText = "F7"; // default when keeperOutfitKey is missing
        private CSharpModBase.Input.HotKeyItem _hotkey;
        private DateTime _configStamp = DateTime.MinValue;
        private string _lastPawn = "";
        private string _lastTalentPawn = "";
        private string _lastSpeedPawn = "";
        private bool _speedWasSet;
        private DateTime _lastSpeedSet = DateTime.MinValue;
        private string _loggedSpeedPawn = "";
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
            const int fastMs = 100; // the Focus poll needs to catch a heavy attack's spend before its hit lands
            int elapsed = 0;
            while (!token.IsCancellationRequested)
            {
                if (elapsed >= TickMs)
                {
                    elapsed = 0;
                    try { Utils.TryRunOnGameThread(Tick); }
                    catch (Exception e) { Log("loop error: " + e.Message); }
                }
                else if (_heavyBuffs.Count > 0 && _pawnRef != null)
                {
                    try { Utils.TryRunOnGameThread(PollFocus); }
                    catch (Exception e) { LogOnce("poll error: " + e.Message); }
                }
                try { await Task.Delay(_heavyBuffs.Count > 0 ? fastMs : TickMs, token); } catch (TaskCanceledException) { }
                elapsed += _heavyBuffs.Count > 0 ? fastMs : TickMs;
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
                if (!name.Contains("Unit_Player_Wukong")) { _pawnRef = null; return; } // transformed / not the monkey
                _pawnRef = pawn;

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
                Stage("buffs", () => KeepBuffs(pawn, name));
                Stage("values", () => KeepValues(pawn, name));
                Stage("resume", () => ResumeTrueWukong(pawn));
                Stage("snapshot", () => WriteAttrSnapshot(pawn));
                Stage("owned", () => WriteOwnedSnapshot(pawn));
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
            // (no early return for an empty list: with no transmog every slot must show the real gear)
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
            var covered = new HashSet<EquipPosition>();
            foreach (int id in _ids)
            {
                var desc = GameDBRuntime.GetEquipDesc(id);
                if (desc == null) continue;
                covered.Add(desc.EquipPosition);
                int shown;
                if (!data.MapEquip.TryGetValue(desc.EquipPosition, out shown) || shown != id) missing.Add(id);
            }

            // Slots without a transmog must show the real gear again (a look removed from the tool used to
            // stay on until the next respawn). The real equipment comes from the player's role data.
            var restore = new List<int>();
            var roleCs = RoleDataOf(pawn);
            if (roleCs != null)
            {
                foreach (var pos in new[] { EquipPosition.Head, EquipPosition.Upwear, EquipPosition.Arm, EquipPosition.Foot, EquipPosition.Hulu, EquipPosition.Weapon })
                {
                    if (covered.Contains(pos)) continue;
                    int shown;
                    if (!data.MapEquip.TryGetValue(pos, out shown)) continue;
                    int real = 0;
                    try { var eq = RoleDataHelper.GetWearEquipByPosition(roleCs, pos); if (eq != null) real = eq.EquipId; } catch { continue; }
                    if (real > 0 && shown != real) restore.Add(real);
                }
            }

            _lastPawn = name;
            if (missing.Count == 0 && restore.Count == 0) return;

            foreach (int id in missing) BGUFunctionLibraryCS.ChangeEquip(pawn, id);
            foreach (int id in restore) BGUFunctionLibraryCS.ChangeEquip(pawn, id);
            _lastApply = DateTime.UtcNow;
            if (missing.Count > 0) Log($"Applied {string.Join(",", missing)} on {name}");
            if (restore.Count > 0) Log($"Restored real gear {string.Join(",", restore)} on {name}");
        }

        /** The player's saved role data (real equipment, bag, gourd); null outside of play. */
        private static CommB1.ReadOnlyRoleDataCS RoleDataOf(APawn pawn)
        {
            try
            {
                var controller = pawn.GetController();
                if (controller == null) return null;
                var role = BGU_DataUtil.GetReadOnlyData<IBPC_PlayerRoleData, BPC_PlayerRoleData>(controller);
                return role?.RoleData?.RoleCs;
            }
            catch { return null; }
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

            // A talent can stay registered while its buffs are gone (seen after transformations and some
            // blackouts: HasTalent true, none of AddBuffIDs on the player). True Wukong's menu hook refreshes
            // by deactivating and re-activating; do the same, at most every TalentRefreshSeconds per talent.
            if ((now - _lastTalentRefresh).TotalSeconds < 5) return;
            _lastTalentRefresh = now;
            foreach (int id in _talents)
            {
                if (!talentData.HasTalent(id)) continue;
                DateTime next;
                if (_talentRefresh.TryGetValue(id, out next) && now < next) continue;
                var buffs = TalentBuffs(id);
                if (buffs.Count == 0) continue;
                bool any = false;
                foreach (int b in buffs) if (BGUFunctionLibraryCS.BGUHasBuffByID(pawn, b)) { any = true; break; }
                if (any) continue;
                _talentRefresh[id] = now.AddSeconds(TalentRefreshSeconds);
                if (InvokeEvent(events, "Evt_DeactivateTalent", id) && InvokeEvent(events, "Evt_ActivateTalent", id, 1))
                    Log($"Talent {id}: its buffs were gone; re-applied on {name}");
            }
        }

        private const double TalentRefreshSeconds = 20;
        private DateTime _lastTalentRefresh = DateTime.MinValue;
        private readonly Dictionary<int, DateTime> _talentRefresh = new Dictionary<int, DateTime>();
        private readonly Dictionary<int, List<int>> _talentBuffCache = new Dictionary<int, List<int>>();

        /** Buff IDs a talent adds (TalentSDesc.AddBuffIDs), cached; empty for passive-skill-only talents. */
        private List<int> TalentBuffs(int id)
        {
            List<int> list;
            if (_talentBuffCache.TryGetValue(id, out list)) return list;
            list = new List<int>();
            try
            {
                var desc = GameDBRuntime.GetTalentSDesc(id);
                foreach (var s in (desc?.AddBuffIDs ?? "").Split(',', ';', '|')) { int b; if (int.TryParse(s.Trim(), out b)) list.Add(b); }
            }
            catch { }
            _talentBuffCache[id] = list;
            return list;
        }

        // ---------- soaks (gourd additives) ----------
        // A slotted soak works like this: when a gourd drink ends, the game adds the buffs of the soak's
        // ConsumeDesc (BUS_UnitItemComp.OnTriggrWinePartnerEffect: Evt_BuffAdd, source type 40, default
        // duration). The keeper subscribes to the player's Evt_PoleDrinkStateEnd (the C# event collection,
        // no hook needed) and adds the buffs of every soak in keeperSoaks at that moment, so a soak from the
        // tool behaves exactly like one slotted in the gourd: only on a drink, for the buff's own duration.
        // Soaks whose in-game trigger is conditional (resurrection, low health, ...) fire on every drink here.

        private string _drinkPawn = "";
        private Delegate _drinkHandler;
        private APawn _drinkPawnRef;

        private void KeepSoaks(APawn pawn, string name)
        {
            if (_soaks.Count == 0) { _drinkPawn = ""; return; }
            if (name != _drinkPawn || !DrinkStillSubscribed(pawn)) SubscribeDrink(pawn, name);
        }

        /**
         * The game raises Evt_TriggerWinePartner(triggerType) from anim notifies at fixed points of the
         * drink (type 0 = the sip itself, 1-4 = other moments, e.g. Deathstinger fires on 3, just before
         * the heal). Its own handler applies the slotted soaks whose ConsumeDesc.WinePartnerTrigger
         * matches. Ours is added to the same event and does the same for the soaks in keeperSoaks.
         */
        private void SubscribeDrink(APawn pawn, string name)
        {
            try
            {
                var coll = BUS_EventCollectionCS.Get(pawn);
                if (coll == null) return;
                var gs = coll.Evt_TriggerWinePartner;
                if (gs == null) { LogOnce("Evt_TriggerWinePartner is null on the event collection; soaks from the tool are unavailable in this game build"); _drinkPawn = name; return; }
                var handler = new b1.EventDelDefine.Del_Void_Int(OnWinePartnerTrigger);
                _drinkHandler = handler;
                _drinkPawnRef = pawn;
                coll.Evt_TriggerWinePartner = gs + handler;
                _drinkPawn = name;
                Log($"Listening for gourd drinks on {name} ({_soaks.Count} soak(s) from the tool)");
            }
            catch (Exception e) { LogOnce("drink subscribe error: " + e.Message); _drinkPawn = name; }
        }

        /** Runs on the game thread inside the drink, like the game's own soak handler. */
        private void OnWinePartnerTrigger(int triggerType)
        {
            try
            {
                var pawn = _drinkPawnRef;
                if (pawn == null || _soaks.Count == 0) return;
                var added = new List<string>();
                foreach (int soak in _soaks)
                {
                    var desc = GameDBRuntime.GetConsumeDesc(soak);
                    if (desc == null) { LogOnce($"keeperSoaks: {soak} is not a consumable the game knows"); continue; }
                    if (desc.WinePartnerTrigger != triggerType) continue;
                    foreach (var fx in desc.ConsumeEffect)
                    {
                        if (fx.EffectType != ResB1.ConsumeEffectType.Buff) continue;
                        BGUFunctionLibraryCS.BGUAddBuff(pawn, pawn, fx.EffectId, (EBuffSourceType)40, 0f);
                        added.Add($"{soak}:{fx.EffectId}");
                    }
                }
                if (added.Count > 0) Log($"Drink (trigger {triggerType}): soak buffs {string.Join(" ", added)} added");
            }
            catch (Exception e) { LogOnce("soak trigger error: " + e.Message); }
        }

        /**
         * The game rebuilds its events when the gourd changes (the component re-attaches), which drops our
         * handler. Check the wrapper's multicast list (private field _MultiCastDel) once a second.
         */
        private bool DrinkStillSubscribed(APawn pawn)
        {
            try
            {
                if (_drinkHandler == null) return false;
                var coll = BUS_EventCollectionCS.Get(pawn);
                var gs = coll?.Evt_TriggerWinePartner;
                if (gs == null) return false;
                var field = gs.GetType().GetField("_MultiCastDel", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
                if (field == null) return true; // cannot tell; assume fine rather than re-adding forever
                var del = field.GetValue(gs) as Delegate;
                return del != null && del.GetInvocationList().Any(d => d.Method == _drinkHandler.Method && ReferenceEquals(d.Target, _drinkHandler.Target));
            }
            catch { return true; }
        }

        // ---------- kept buffs ----------
        // keeperBuffs = buff IDs the keeper re-adds (source type 40, default duration) whenever they are
        // missing, at most every 5 s each. Used for "Deathstinger venom": buff 92313 only adds poison
        // build-up and ends at once, so re-adding it keeps the build-up topped up and the next hit you
        // take or deal turns it into the Poisoned state.

        private void KeepBuffs(APawn pawn, string name)
        {
            if (_keptBuffs.Count == 0) return;
            if (Get(pawn, Hp) <= 0f) return;
            var now = DateTime.UtcNow;
            foreach (int id in _keptBuffs)
            {
                DateTime next;
                if (_keptBuffNext.TryGetValue(id, out next) && now < next) continue;
                if (BGUFunctionLibraryCS.BGUHasBuffByID(pawn, id)) { _keptBuffNext[id] = now.AddSeconds(1); continue; }
                BGUFunctionLibraryCS.BGUAddBuff(pawn, pawn, id, (EBuffSourceType)40, 0f);
                _keptBuffNext[id] = now.AddSeconds(5);
                if (!_keptLogged.Contains(id)) { _keptLogged.Add(id); Log($"Kept buff {id} added on {name} (re-added whenever it is missing)"); }
            }
        }
        private readonly HashSet<int> _keptLogged = new HashSet<int>();

        /** "92313,92200@heavy" -> plain kept buffs and "@heavy" buffs (added on a 3+ point Focus spend). */
        private static void ParseBuffTokens(string value, List<int> kept, List<int> heavy)
        {
            foreach (string raw in (value ?? "").Split(','))
            {
                string part = raw.Trim();
                if (part.Length == 0) continue;
                string mode = "";
                int at = part.IndexOf('@');
                if (at >= 0) { mode = part.Substring(at + 1).Trim().ToLowerInvariant(); part = part.Substring(0, at).Trim(); }
                int id;
                if (!int.TryParse(part, out id) || id <= 0) continue;
                if (mode == "heavy") { if (!heavy.Contains(id)) heavy.Add(id); }
                else if (!kept.Contains(id)) kept.Add(id);
            }
        }

        // Every 100 ms while an "@heavy" buff is configured: a drop of 3+ Focus points in one step is a
        // charged heavy attack being unleashed (4 points, or 3 in Pillar stance); add the buffs right then,
        // so the hit that follows lands with them (e.g. Deathstinger's build-up -> Poisoned on that hit).
        private void PollFocus()
        {
            try
            {
                var pawn = _pawnRef;
                if (pawn == null || _heavyBuffs.Count == 0) return;
                float cur = Get(pawn, Focus);
                float prev = _focusPrev;
                _focusPrev = cur;
                if (prev < 0f) return;
                if (prev - cur < 290f) return; // less than 3 points spent (light attacks, decay, a 1- or 2-point heavy)
                foreach (int id in _heavyBuffs) BGUFunctionLibraryCS.BGUAddBuff(pawn, pawn, id, (EBuffSourceType)40, 0f);
                Log($"Heavy attack with {Math.Round(prev / 100f, 1)} Focus points: buff {string.Join(",", _heavyBuffs)} added");
            }
            catch (Exception e) { LogOnce("focus poll error: " + e.Message); }
        }

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

        // True Wukong stops its passive loops (regen, focus, gourd refill) on every screen blackout
        // (menu, cutscene, fast travel) and restarts them on the next non-movement input. When that
        // restart does not happen the values silently stop. If the flag stays off for a few seconds while
        // the player is alive, restart the loops the same way the mod does (reflection, full mode only).
        private DateTime _asyncOffSince = DateTime.MinValue;

        private void ResumeTrueWukong(APawn pawn)
        {
            if (!FullMode() || Get(pawn, Hp) <= 0f) { _asyncOffSince = DateTime.MinValue; return; }
            Type type = null;
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies()) { try { type = asm.GetType("CSharpModExample.TrueWukong", false); } catch { } if (type != null) break; }
            if (type == null) return;
            const System.Reflection.BindingFlags flags = System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic;
            var fAllow = type.GetField("allowAsync", flags);
            if (fAllow == null || fAllow.FieldType != typeof(bool)) return;
            if ((bool)fAllow.GetValue(null)) { _asyncOffSince = DateTime.MinValue; return; }
            var now = DateTime.UtcNow;
            if (_asyncOffSince == DateTime.MinValue) { _asyncOffSince = now; return; }
            if ((now - _asyncOffSince).TotalSeconds < 4) return;
            fAllow.SetValue(null, true);
            type.GetField("pause", flags)?.SetValue(null, false);
            (type.GetField("qPassiveEffects", flags)?.GetValue(null) as System.Collections.IList)?.Clear();
            type.GetMethod("PassiveEffects", flags)?.Invoke(null, null);
            type.GetMethod("PassiveFocus", flags)?.Invoke(null, null);
            _asyncOffSince = DateTime.MinValue;
            Log("True Wukong's passive loops were off for 4 s while playing; restarted them (regen, focus)");
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
            // re-asserted every 5 s too: the game resets the rate after some cutscenes and transformations
            bool speedDue = (DateTime.UtcNow - _lastSpeedSet).TotalSeconds >= 5 && speed > 0f && Math.Abs(speed - 1f) > 0.001f;
            if (name != _lastSpeedPawn || speedDue)
            {
                _lastSpeedPawn = name;
                _lastSpeedSet = DateTime.UtcNow;
                if (speed > 0f && Math.Abs(speed - 1f) > 0.001f)
                {
                    BGUFunctionLibraryCS.BGUAISetSpeedRate(pawn, speed);
                    if (name != _loggedSpeedPawn) { _loggedSpeedPawn = name; Log($"Speed rate {speed} on {name} (re-asserted every 5 s)"); }
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

        // ---------- owned equipment snapshot for the CLI ----------
        // Every equipment item in the save's bag (armor, weapons, gourds, vessels) plus the earlier IDs of
        // upgraded items (HistoryIdList), so the tool can offer "only looks I have unlocked".

        private static readonly string OwnedPath = Path.Combine(BaseDir, "TransmogKeeperOwned.txt");
        private const double OwnedSeconds = 10;
        private DateTime _lastOwned = DateTime.MinValue;
        private string _lastOwnedBody = "";

        private void WriteOwnedSnapshot(APawn pawn)
        {
            if ((DateTime.UtcNow - _lastOwned).TotalSeconds < OwnedSeconds) return;
            _lastOwned = DateTime.UtcNow;
            var roleCs = RoleDataOf(pawn);
            if (roleCs == null) return;
            var ids = new SortedSet<int>();
            var bag = roleCs.Bag;
            if (bag?.EquipList != null)
                foreach (var eq in bag.EquipList)
                {
                    if (eq == null) continue;
                    if (eq.EquipId > 0) ids.Add(eq.EquipId);
                    if (eq.HistoryIdList != null) foreach (int h in eq.HistoryIdList) if (h > 0) ids.Add(h);
                }
            var wear = roleCs.Actor?.Wear?.EquipList;
            if (wear != null) foreach (var w in wear) if (w != null && w.Id > 0) ids.Add(w.Id);
            string body = string.Join("\n", ids);
            if (body == _lastOwnedBody) return;
            _lastOwnedBody = body;
            try { File.WriteAllText(OwnedPath, "time=" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "\n" + body + "\n"); }
            catch (Exception e) { LogOnce("owned snapshot error: " + e.Message); }
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
            section("PASSIVES\tid\tfields (name=value ...)", () =>
            {
                // passive skills referenced by talents (PassiveSkillIDs); fields dumped by reflection
                var ids = new SortedSet<int>();
                foreach (var t in GameDBRuntime.GetTBTalentSDesc().List)
                    foreach (var s in (t.PassiveSkillIDs ?? "").Split(',', ';', '|')) { int id; if (int.TryParse(s.Trim(), out id)) ids.Add(id); }
                foreach (int id in ids)
                {
                    object v;
                    try { v = BGW_GameDB.GetPassiveSkillDescDic(id); } catch (Exception ex) { sb.AppendLine($"P\t{id}\terror {ex.Message}"); continue; }
                    var dic = v as System.Collections.IDictionary;
                    if (dic == null) { sb.AppendLine($"P\t{id}\t(null)"); continue; }
                    foreach (System.Collections.DictionaryEntry e in dic) sb.AppendLine($"P\t{id}\tlevel={e.Key}\t{Describe(e.Value, 1)}");
                }
            });
            section("BUFFS\tid\tfields (buffs referenced by talents and consumables)", () =>
            {
                var ids = new SortedSet<int>();
                foreach (var t in GameDBRuntime.GetTBTalentSDesc().List)
                    foreach (var s in (t.AddBuffIDs ?? "").Split(',', ';', '|')) { int id; if (int.TryParse(s.Trim(), out id)) ids.Add(id); }
                foreach (var c in GameDBRuntime.GetTBConsumeDesc().List)
                    foreach (var fx in c.ConsumeEffect) if (fx.EffectType == ResB1.ConsumeEffectType.Buff) ids.Add(fx.EffectId);
                foreach (int id in ids)
                {
                    object b;
                    try { b = GameDBRuntime.GetFUStBuffDesc(id); } catch (Exception ex) { sb.AppendLine($"B\t{id}\terror {ex.Message}"); continue; }
                    sb.AppendLine($"B\t{id}\t{(b == null ? "(null)" : Describe(b, 2))}");
                }
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

        /** "Name=value Name=value" for an object's public properties; lists and nested messages expanded to `depth`. */
        private static string Describe(object v, int depth)
        {
            if (v == null) return "null";
            var type = v.GetType();
            if (type.IsPrimitive || type.IsEnum || v is string || v is decimal) return v.ToString();
            if (depth <= 0) return type.Name;
            if (v is System.Collections.IEnumerable en && !(v is string))
                return "[" + string.Join(" | ", en.Cast<object>().Select(x => Describe(x, depth - 1))) + "]";
            var parts = new List<string>();
            foreach (var p in type.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
            {
                if (p.GetIndexParameters().Length > 0 || p.Name == "Parser" || p.Name == "Descriptor") continue;
                object val;
                try { val = p.GetValue(v); } catch { continue; }
                string s = Describe(val, depth - 1);
                if (string.IsNullOrEmpty(s) || s == "0" || s == "False" || s == "null" || s == "[]") continue;
                parts.Add($"{p.Name}={s.Replace("\n", " ").Replace("\t", " ")}");
            }
            return "{" + string.Join(" ", parts) + "}";
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
            _keptBuffs.Clear();
            _heavyBuffs.Clear();
            _keptBuffNext.Clear();
            _presets.Clear();
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
                    else if (key == "keeperPresets") ParsePresets(value);
                    else if (key == "keeperSoaks") ParseIds(value, _soaks);
                    else if (key == "keeperBuffs") ParseBuffTokens(value, _keptBuffs, _heavyBuffs);
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
            try { SyncPresetKeys(); }
            catch (Exception e) { Log("preset key error: " + e.Message); }
        }

        // ---------- named buffs (presets) and their in-game keys ----------
        // keeperPresets = Name{talents=ids;soaks=ids;values=key:on:off,...;key=F8};Name2{...}
        // A key press toggles the whole bundle: on = add its talents and soaks and set its values to "on";
        // off = remove them and set its values to "off". The config is rewritten, so the tool sees it too.

        private class Preset
        {
            public string Name;
            public readonly List<int> Talents = new List<int>();
            public readonly List<int> Soaks = new List<int>();
            public readonly List<string> Buffs = new List<string>();          // tokens "id" or "id@heavy", as in keeperBuffs
            public readonly List<(string key, string on, string off)> Values = new List<(string, string, string)>();
            public string Key = "None";
        }
        private readonly List<Preset> _presets = new List<Preset>();
        private readonly Dictionary<string, (CSharpModBase.Input.HotKeyItem item, string key)> _presetKeys = new Dictionary<string, (CSharpModBase.Input.HotKeyItem, string)>();

        private void ParsePresets(string value)
        {
            _presets.Clear();
            foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(value ?? "", @"([^{};]+)\{([^}]*)\}"))
            {
                var p = new Preset { Name = m.Groups[1].Value.Trim() };
                if (p.Name.Length == 0) continue;
                foreach (string part in m.Groups[2].Value.Split(';'))
                {
                    int eq = part.IndexOf('=');
                    if (eq < 0) continue;
                    string k = part.Substring(0, eq).Trim(), v = part.Substring(eq + 1).Trim();
                    if (k == "talents") ParseIds(v, p.Talents);
                    else if (k == "soaks") ParseIds(v, p.Soaks);
                    else if (k == "buffs") foreach (string tok in v.Split(',')) { string s = tok.Trim(); if (s.Length > 0 && !p.Buffs.Contains(s)) p.Buffs.Add(s); }
                    else if (k == "key") p.Key = v.Length == 0 ? "None" : v;
                    else if (k == "values")
                        foreach (string triple in v.Split(','))
                        {
                            string[] t = triple.Split(':');
                            if (t.Length >= 2 && t[0].Trim().Length > 0) p.Values.Add((t[0].Trim(), t[1].Trim(), t.Length > 2 ? t[2].Trim() : "0"));
                        }
                }
                _presets.Add(p);
            }
        }

        /** One loader key bind per preset with a key; re-bound when the key changes, disabled when removed. */
        private void SyncPresetKeys()
        {
            foreach (var p in _presets)
            {
                (CSharpModBase.Input.HotKeyItem item, string key) bound;
                bool have = _presetKeys.TryGetValue(p.Name, out bound);
                if (have && bound.key == p.Key) continue;
                CSharpModBase.Input.ModifierKeys mods; CSharpModBase.Input.Key key;
                if (!ParseHotkey(p.Key, out mods, out key)) { Log($"preset '{p.Name}': key '{p.Key}' unknown; disabled"); mods = CSharpModBase.Input.ModifierKeys.None; key = CSharpModBase.Input.Key.None; }
                if (!have)
                {
                    if (key == CSharpModBase.Input.Key.None) { _presetKeys[p.Name] = (null, p.Key); continue; }
                    string name = p.Name;
                    var item = Utils.RegisterKeyBind(mods, key, () => TogglePreset(name));
                    if (item != null) { item.Label = "TransmogKeeper: " + name; item.RunOnGameThread = true; }
                    _presetKeys[name] = (item, p.Key);
                }
                else
                {
                    if (bound.item == null && key != CSharpModBase.Input.Key.None)
                    {
                        string name = p.Name;
                        var item = Utils.RegisterKeyBind(mods, key, () => TogglePreset(name));
                        if (item != null) { item.Label = "TransmogKeeper: " + name; item.RunOnGameThread = true; }
                        _presetKeys[name] = (item, p.Key);
                    }
                    else { bound.item?.WithKey(mods, key); _presetKeys[p.Name] = (bound.item, p.Key); }
                }
                Log(key == CSharpModBase.Input.Key.None ? $"Preset '{p.Name}': no key" : $"Preset '{p.Name}' bound to {p.Key}");
            }
            // presets that disappeared from the config: unbind their key
            foreach (var gone in _presetKeys.Keys.Where(n => !_presets.Any(p => p.Name == n)).ToList())
            {
                _presetKeys[gone].item?.WithKey(CSharpModBase.Input.ModifierKeys.None, CSharpModBase.Input.Key.None);
                _presetKeys.Remove(gone);
            }
        }

        private void TogglePreset(string name)
        {
            try
            {
                var p = _presets.FirstOrDefault(x => x.Name == name);
                if (p == null) return;
                var lines = File.ReadAllLines(ConfigPath).ToList();
                Func<string, string> get = k => { var l = lines.FirstOrDefault(x => x.StartsWith(k + " =")); return l == null ? "" : l.Substring(l.IndexOf('=') + 1).Trim(); };
                Action<string, string> set = (k, v) => { int i = lines.FindIndex(x => x.StartsWith(k + " =")); if (i >= 0) lines[i] = $"{k} = {v}"; else lines.Add($"{k} = {v}"); };
                var talents = new List<int>(); ParseIds(get("addTalents"), talents);
                var soaks = new List<int>(); ParseIds(get("keeperSoaks"), soaks);
                var kept = get("keeperBuffs").Split(',').Select(s => s.Trim()).Where(s => s.Length > 0 && s != "0").ToList();
                Func<string, string> idOf = tok => tok.Split('@')[0].Trim();
                bool on = p.Talents.All(talents.Contains) && p.Soaks.All(soaks.Contains) && p.Buffs.All(b => kept.Any(k => idOf(k) == idOf(b)))
                    && p.Values.All(v => { float cur, want; return float.TryParse(get(v.key), NumberStyles.Float, CultureInfo.InvariantCulture, out cur) && float.TryParse(v.on, NumberStyles.Float, CultureInfo.InvariantCulture, out want) && Math.Abs(cur - want) < 1e-4f; });
                bool turnOn = !on;
                foreach (int id in p.Talents) { if (turnOn) { if (!talents.Contains(id)) talents.Add(id); } else talents.Remove(id); }
                foreach (int id in p.Soaks) { if (turnOn) { if (!soaks.Contains(id)) soaks.Add(id); } else soaks.Remove(id); }
                foreach (string b in p.Buffs) { kept.RemoveAll(k => idOf(k) == idOf(b)); if (turnOn) kept.Add(b); }
                foreach (var v in p.Values) set(v.key, turnOn ? v.on : v.off);
                if (p.Talents.Count > 0) set("addTalents", talents.Count == 0 ? "0" : string.Join(",", talents));
                if (p.Soaks.Count > 0) set("keeperSoaks", soaks.Count == 0 ? "0" : string.Join(",", soaks));
                if (p.Buffs.Count > 0) set("keeperBuffs", kept.Count == 0 ? "0" : string.Join(",", kept));
                File.WriteAllLines(ConfigPath, lines);
                Log($"Preset '{name}' switched {(turnOn ? "ON" : "OFF")} by key");
                LoadConfig();
                if (FullMode()) Stage("reload", ReloadTrueWukong);
                Utils.TryRunOnGameThread(Tick);
            }
            catch (Exception e) { Log("preset toggle error: " + e.Message); }
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
                // the cycle is: every saved look, then "real gear" (no transmog) unless a saved look already is that
                var cycle = new List<(string name, List<int> ids)>(_outfits);
                if (!cycle.Any(o => o.ids.Count == 0)) cycle.Add(("real gear", new List<int>()));
                int cur = cycle.FindIndex(o => o.ids.SequenceEqual(_ids));
                var next = cycle[(cur + 1) % cycle.Count];
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
