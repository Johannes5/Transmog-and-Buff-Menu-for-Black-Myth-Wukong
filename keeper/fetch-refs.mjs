// Downloads the game's managed reference assemblies needed to build TransmogKeeper
// into keeper/lib (they are not committed). Source: the CSharpLoader repo's GameDll folder.
// CSharpModBase.dll is copied from the installed loader.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lib = path.join(here, 'lib');
fs.mkdirSync(lib, { recursive: true });

const base = 'https://raw.githubusercontent.com/czastack/B1CSharpLoader/master/GameDll/';
const names = [
  'UnrealEngine.dll', 'UnrealEngine.Runtime.dll', 'BtlSvr.Main.dll', 'b1.Native.dll', 'b1.Managed.dll',
  'GSE.Core.dll', 'GSE.ProtobufDB.dll', 'Protobuf.RunTime.dll', 'Google.Protobuf.dll',
];
for (const n of names) {
  const dest = path.join(lib, n);
  if (fs.existsSync(dest)) { console.log('have', n); continue; }
  const res = await fetch(base + n);
  if (!res.ok) throw new Error(`${n}: HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('fetched', n);
}

const loaderBase = process.env.WUKONG_LOADER_DIR
  ?? 'X:/SteamLibrary/steamapps/common/BlackMythWukong/b1/Binaries/Win64/CSharpLoader';
const modBase = path.join(loaderBase, 'CSharpModBase.dll');
if (fs.existsSync(modBase)) {
  fs.copyFileSync(modBase, path.join(lib, 'CSharpModBase.dll'));
  console.log('copied CSharpModBase.dll from the installed loader');
} else console.log('CSharpModBase.dll not found; set WUKONG_LOADER_DIR');
