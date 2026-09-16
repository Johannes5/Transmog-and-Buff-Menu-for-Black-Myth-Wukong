// Patches TrueWukong.dll (True Wukong mod for Black Myth: Wukong) so that:
//   1. Ctrl+Enter (reload config) also re-applies the transmog immediately.
//   2. The hard-coded "hold jump for a higher jump" buff (buff 907) is removed.
//   3. The hard-coded "stride jump always allowed" patch is disabled.
//
// Usage: dotnet run -- <path to TrueWukong.dll>
// The untouched DLL is kept as TrueWukong.dll.orig and always used as the input,
// so running the patcher again is safe.

using Mono.Cecil;
using Mono.Cecil.Cil;

if (args.Length < 1)
{
    Console.Error.WriteLine("usage: TrueWukongPatcher <TrueWukong.dll>");
    return 2;
}

// Developer helper: `--api <dll> <type regex>` lists matching types with their members (Mono.Cecil, no loading).
if (args[0] == "--api")
{
    var apiRx = new System.Text.RegularExpressions.Regex(args.Length > 2 ? args[2] : ".", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    var apiAsm = AssemblyDefinition.ReadAssembly(Path.GetFullPath(args[1]), new ReaderParameters { InMemory = true });
    foreach (var t in apiAsm.MainModule.GetTypes())
    {
        if (!apiRx.IsMatch(t.FullName)) continue;
        Console.WriteLine($"{(t.IsEnum ? "enum " : t.IsInterface ? "interface " : "class ")}{t.FullName}");
        foreach (var f in t.Fields) if (f.IsPublic || t.IsEnum) Console.WriteLine($"  field  {f.FieldType.Name} {f.Name}{(f.HasConstant ? " = " + f.Constant : "")}");
        foreach (var p in t.Properties) Console.WriteLine($"  prop   {p.PropertyType.Name} {p.Name}");
        foreach (var m in t.Methods) if (m.IsPublic && !m.IsGetter && !m.IsSetter) Console.WriteLine($"  method {(m.IsStatic ? "static " : "")}{m.ReturnType.Name} {m.Name}({string.Join(", ", m.Parameters.Select(p => p.ParameterType.Name + " " + p.Name))})");
    }
    return 0;
}

// Developer helper: `--find <dll> <regex>` lists members (methods, fields, properties) whose name matches;
// `--il <dll> <Type::Method>` prints a method's IL (calls, constants, strings).
if (args[0] == "--find" || args[0] == "--il")
{
    var asm2 = AssemblyDefinition.ReadAssembly(Path.GetFullPath(args[1]), new ReaderParameters { InMemory = true });
    if (args[0] == "--find")
    {
        var rx = new System.Text.RegularExpressions.Regex(args[2], System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        foreach (var t in asm2.MainModule.GetTypes())
        {
            foreach (var m in t.Methods) if (rx.IsMatch(m.Name)) Console.WriteLine($"method {t.FullName}::{m.Name}({string.Join(", ", m.Parameters.Select(p => p.ParameterType.Name))}) : {m.ReturnType.Name}");
            foreach (var f in t.Fields) if (rx.IsMatch(f.Name)) Console.WriteLine($"field  {t.FullName}::{f.Name} : {f.FieldType.FullName}");
            foreach (var p in t.Properties) if (rx.IsMatch(p.Name)) Console.WriteLine($"prop   {t.FullName}::{p.Name} : {p.PropertyType.FullName}");
        }
    }
    else
    {
        var parts = args[2].Split("::");
        var t = asm2.MainModule.GetTypes().First(x => x.FullName == parts[0] || x.Name == parts[0]);
        foreach (var m in t.Methods.Where(x => x.Name == parts[1] && x.HasBody))
        {
            Console.WriteLine($"--- {t.FullName}::{m.Name}({string.Join(", ", m.Parameters.Select(p => p.ParameterType.Name + " " + p.Name))})");
            foreach (var ins in m.Body.Instructions)
            {
                string op = ins.Operand switch
                {
                    null => "",
                    MethodReference mr => $"{mr.DeclaringType.Name}::{mr.Name}",
                    FieldReference fr => $"{fr.DeclaringType.Name}::{fr.Name}",
                    Instruction target => $"IL_{target.Offset:x4}",
                    Instruction[] targets => string.Join(",", targets.Select(x => $"IL_{x.Offset:x4}")),
                    string s => $"\"{s}\"",
                    _ => ins.Operand.ToString() ?? "",
                };
                Console.WriteLine($"  IL_{ins.Offset:x4} {ins.OpCode.Name,-12} {op}");
            }
        }
    }
    return 0;
}

string dll = Path.GetFullPath(args[0]);
string orig = dll + ".orig";
if (!File.Exists(orig))
{
    File.Copy(dll, orig);
    Console.WriteLine($"Backed up original to {orig}");
}

var resolver = new DefaultAssemblyResolver();
resolver.AddSearchDirectory(Path.GetDirectoryName(dll));
resolver.AddSearchDirectory(Path.GetFullPath(Path.Combine(Path.GetDirectoryName(dll)!, "..", "..")));

byte[] bytes = File.ReadAllBytes(orig);
using var stream = new MemoryStream(bytes);
var asm = AssemblyDefinition.ReadAssembly(stream, new ReaderParameters { AssemblyResolver = resolver, InMemory = true });
var mod = asm.MainModule;

TypeDefinition main = mod.Types.First(t => t.Name == "TrueWukong");
MethodDefinition transmog = main.Methods.First(m => m.Name == "Transmog");
MethodDefinition loadConfig = main.Methods.First(m => m.Name == "LoadConfig");
FieldDefinition spear = main.Fields.First(f => f.Name == "spear");

int applied = 0;

// ---- 1. Ctrl+Enter re-applies transmog -------------------------------------
{
    var hit = AllMethods(main)
        .Where(m => m.HasBody)
        .Select(m => (m, ins: m.Body.Instructions.FirstOrDefault(i => i.OpCode == OpCodes.Ldstr && i.Operand is string s && s.StartsWith("Successfully reloaded"))))
        .FirstOrDefault(x => x.ins != null);
    if (hit.m == null) throw new Exception("reload hotkey delegate not found");

    var body = hit.m.Body;
    var il = body.GetILProcessor();
    var callLoad = body.Instructions.First(i => i.OpCode == OpCodes.Call && i.Operand is MethodReference mr && mr.Name == "LoadConfig");
    var next = callLoad.Next;

    var lStaff = il.Create(OpCodes.Ldstr, "staffTransmog");
    il.InsertBefore(next, il.Create(OpCodes.Ldsfld, spear));
    il.InsertBefore(next, il.Create(OpCodes.Brfalse, lStaff));
    il.InsertBefore(next, il.Create(OpCodes.Ldstr, "spearTransmog"));
    il.InsertBefore(next, il.Create(OpCodes.Call, transmog));
    il.InsertBefore(next, il.Create(OpCodes.Br, next));
    il.InsertBefore(next, lStaff);
    il.InsertBefore(next, il.Create(OpCodes.Call, transmog));

    hit.ins!.Operand = "Reloaded mod settings and applied transmog.\nEnter/exit a transform to apply new attack/defense/talents.";
    Console.WriteLine($"[1] Ctrl+Enter now re-applies transmog ({hit.m.DeclaringType.Name}.{hit.m.Name})");
    applied++;
}

// ---- 2. remove hold-jump buff 907 ------------------------------------------
{
    var scan = main.Methods.First(m => m.Name == "ScanBuffWhenCast");
    var ins = scan.Body.Instructions;
    int count = 0;
    for (int i = 0; i + 3 < ins.Count; i++)
    {
        if (IsLdcI4(ins[i], 907) && IsLdcI4(ins[i + 1], 250) && ins[i + 2].OpCode == OpCodes.Ldnull
            && ins[i + 3].OpCode == OpCodes.Call && ins[i + 3].Operand is MethodReference mr && mr.Name == "AddBuff")
        {
            for (int k = 0; k < 4; k++) { ins[i + k].OpCode = OpCodes.Nop; ins[i + k].Operand = null; }
            count++;
        }
    }
    if (count != 1) throw new Exception($"expected exactly one AddBuff(907, 250) call, found {count}");
    Console.WriteLine("[2] Removed hold-jump buff (AddBuff 907) from ScanBuffWhenCast");
    applied++;
}

// ---- 3. disable StrideJump override ----------------------------------------
{
    var sj = main.Methods.First(m => m.Name == "StrideJump");
    var il = sj.Body.GetILProcessor();
    sj.Body.Instructions.Clear();
    sj.Body.ExceptionHandlers.Clear();
    sj.Body.Variables.Clear();
    il.Emit(OpCodes.Ldc_I4_1); // return true => run the game's original UnitCanStrideJump
    il.Emit(OpCodes.Ret);
    Console.WriteLine("[3] StrideJump prefix now defers to the game's own check");
    applied++;
}

// ---- 4. unbind hard-coded debug hotkeys (F4-F9, F12) ------------------------
{
    var init = main.Methods.First(m => m.Name == "Init");
    var ins = init.Body.Instructions;
    int count = 0;
    for (int i = 0; i < ins.Count; i++)
    {
        if (ins[i].OpCode != OpCodes.Ldc_I4_S || ins[i].Operand is not sbyte key) continue;
        if (key < 115 || key > 123) continue; // F4..F12
        // must be the key argument of Utils.RegisterKeyBind(Key, Action): next call within a few instructions
        var call = ins.Skip(i + 1).Take(14).FirstOrDefault(x => x.OpCode == OpCodes.Call);
        if (call?.Operand is not MethodReference mr || mr.Name != "RegisterKeyBind" || mr.Parameters.Count != 2) continue;
        ins[i].OpCode = OpCodes.Ldc_I4_0; // Key.None
        ins[i].Operand = null;
        count++;
    }
    if (count != 7) throw new Exception($"expected 7 debug key registrations, found {count}");
    Console.WriteLine("[4] Debug hotkeys F4-F9 and F12 unbound");
    applied++;
}

// ---- 5. survive without hooks (EnableJit=0 "lite" mode) ---------------------
{
    var init = main.Methods.First(m => m.Name == "Init");
    var ins = init.Body.Instructions;
    var rethrow = ins.FirstOrDefault(x => x.OpCode == OpCodes.Rethrow);
    if (rethrow == null) throw new Exception("rethrow in Init not found");
    var il = init.Body.GetILProcessor();
    // catch block: ... call Log; rethrow  ->  ... call Log; leave <after try>
    var handler = init.Body.ExceptionHandlers.First(h => h.HandlerStart.Offset <= rethrow.Offset && rethrow.Offset < h.HandlerEnd.Offset);
    var afterTry = handler.HandlerEnd; // first instruction after the try/catch
    rethrow.OpCode = OpCodes.Leave;
    rethrow.Operand = afterTry;
    Console.WriteLine("[5] Init no longer aborts when Harmony hooks cannot be installed (EnableJit=0 lite mode)");
    applied++;
}

// ---- 6. marker so the tool can tell a patched DLL without the .orig --------
{
    const string marker = "TransmogTool-patched";
    if (!main.Fields.Any(f => f.Name == "TransmogToolPatch"))
    {
        // a literal string constant lands in the #Blob heap as UTF-16; src/mod.js searches for it
        var field = new FieldDefinition("TransmogToolPatch", FieldAttributes.Public | FieldAttributes.Static | FieldAttributes.Literal | FieldAttributes.HasDefault, mod.TypeSystem.String)
        {
            Constant = marker,
        };
        main.Fields.Add(field);
    }
    Console.WriteLine("[6] Marker constant added (TrueWukong.TransmogToolPatch)");
    applied++;
}

try
{
    asm.Write(dll);
    Console.WriteLine($"Wrote {dll} ({applied} patches)");
    string pending = dll + ".pending";
    if (File.Exists(pending)) File.Delete(pending);
}
catch (IOException)
{
    string pending = dll + ".pending";
    asm.Write(pending);
    Console.WriteLine($"TrueWukong.dll is locked (game running). Patched copy written to {pending}.");
    Console.WriteLine("Close the game and run the patcher again, or rename the .pending file over TrueWukong.dll.");
    return 1;
}
return 0;

static bool IsLdcI4(Instruction i, int value)
{
    if (i.OpCode == OpCodes.Ldc_I4 && i.Operand is int v) return v == value;
    if (i.OpCode == OpCodes.Ldc_I4_S && i.Operand is sbyte sb) return sb == value;
    return false;
}

static IEnumerable<MethodDefinition> AllMethods(TypeDefinition t)
{
    foreach (var m in t.Methods) yield return m;
    foreach (var n in t.NestedTypes) foreach (var m in AllMethods(n)) yield return m;
}
