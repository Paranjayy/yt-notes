import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const source = "/Users/paranjay/Library/Caches/com.raycast-x.macos/clipboard";
const destination = path.resolve("raycast-transcripts");
const files = await readdir(source, { withFileTypes: true });
const captures = [];
const safe = (value) => value.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled";
const field = (content, name, fallback) => content.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim() || fallback;

for (const file of files) {
  if (!file.isFile() || path.extname(file.name).toLowerCase() !== ".txt") continue;
  const sourcePath = path.join(source, file.name);
  const content = await readFile(sourcePath, "utf8");
  if (!/^# Transcript\s*$/m.test(content)) continue;
  const sourceStat = await stat(sourcePath);
  captures.push({
    channel: field(content, "Channel", "Unknown channel"),
    content,
    modified: sourceStat.mtime,
    sourceFile: file.name,
    sourcePath,
    title: field(content, "Title", "Untitled transcript"),
  });
}

captures.sort((a, b) => a.modified - b.modified || a.title.localeCompare(b.title));
await mkdir(destination, { recursive: true });
const used = new Set();
const manifest = [];
for (const capture of captures) {
  const date = capture.modified.toISOString().slice(0, 10);
  const stem = `${date} — ${safe(capture.title)} — ${safe(capture.channel)}`;
  let number = 1;
  let name = `${stem}.md`;
  while (used.has(name)) name = `${stem} (${++number}).md`;
  used.add(name);
  await writeFile(path.join(destination, name), capture.content, "utf8");
  manifest.push({ ...capture, outputFile: name, sha256: createHash("sha256").update(capture.content).digest("hex") });
}
await writeFile(path.join(destination, "_raycast-transcript-manifest.json"), `${JSON.stringify({ transcriptCount: manifest.length, transcripts: manifest }, null, 2)}\n`);
console.log(`Exported ${manifest.length} named Markdown transcripts.`);
