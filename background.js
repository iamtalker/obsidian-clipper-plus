// Obsidian backend. Everything shared with the Joplin version (injection,
// capture fallbacks, message routing) is in core.js.
//
// Talks to the "Local REST API with MCP" community plugin (coddingtonbear)
// over its plain-HTTP port. Its default HTTPS port uses a self-signed
// certificate Chrome won't accept from an extension, and the traffic never
// leaves 127.0.0.1 anyway.
//
// Unlike Joplin — which turns data: images in a note body into attachments
// on its own — Obsidian just stores whatever text it's given. So every
// data: image content.js produced is uploaded as a real file into the
// attachments folder and the note embeds it with ![[file]].
importScripts("core.js");

const DEFAULTS = {
  obsidianKey: "",
  obsidianPort: "27123",
  defaultFolder: "Clippings",
  attachmentsFolder: "Clippings/attachments",
  openAfterSave: false,
};

async function getSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

function cleanFolder(p) {
  return (p || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

// Each path segment is encoded on its own; real "/" separators must stay.
function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

async function obsFetch(path, options = {}) {
  const { obsidianKey, obsidianPort } = await getSettings();
  if (!obsidianKey) {
    throw new Error("Obsidian API key is not set. Open the extension options first.");
  }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${obsidianPort}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${obsidianKey}`, ...(options.headers || {}) },
    });
  } catch (e) {
    throw new Error(
      `Obsidian에 연결할 수 없어요 (port ${obsidianPort}). Obsidian이 켜져 있고 Local REST API 플러그인의 HTTP 서버가 켜져 있는지 확인하세요.`
    );
  }
  return res;
}

async function obsJson(path, options) {
  const res = await obsFetch(path, options);
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).message || "";
    } catch (e) {}
    throw new Error(`Obsidian API ${res.status}: ${detail || res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

async function putFile(vaultPath, body, contentType) {
  const res = await obsFetch("/vault/" + encodePath(vaultPath), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!res.ok) throw new Error(`Obsidian API ${res.status} writing ${vaultPath}`);
}

async function fileExists(vaultPath) {
  const res = await obsFetch("/vault/" + encodePath(vaultPath), { method: "HEAD" });
  return res.ok;
}

async function testConnection() {
  try {
    const info = await obsJson("/");
    if (!info.authenticated) return { ok: false, error: "API key was rejected by Obsidian." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Vault folders for the popup's folder picker. The API only lists one
// directory per call, so walk breadth-first with caps so a huge vault
// can't stall the popup. (Empty folders aren't listed by the API.)
async function listFolders() {
  const out = [];
  const queue = [""];
  let calls = 0;
  while (queue.length && calls < 200) {
    const dir = queue.shift();
    calls++;
    const data = await obsJson("/vault/" + (dir ? encodePath(dir) + "/" : ""));
    for (const f of data.files || []) {
      if (!f.endsWith("/") || f.startsWith(".")) continue;
      const full = dir ? `${dir}/${f.slice(0, -1)}` : f.slice(0, -1);
      out.push({ id: full, title: full });
      if (full.split("/").length < 4) queue.push(full);
    }
  }
  return out;
}

async function defaultFolderLabel() {
  const { defaultFolder } = await getSettings();
  return `(default: ${cleanFolder(defaultFolder) || "vault root"})`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function timestamps(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const iso =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  const compact =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { iso, compact };
}

// Characters Obsidian (or Windows) won't allow in a file name, plus the
// ones that break [[wikilinks]].
function safeFileName(name, maxLen) {
  const s = (name || "")
    .replace(/[\\/:*?"<>|#^\[\]]/g, " ")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen)
    .replace(/[.\s]+$/, "");
  return s || "Untitled";
}

const MIME_EXT = { jpeg: "jpg", "svg+xml": "svg", "x-icon": "ico" };

// Moves every data: image out of the markdown into its own vault file.
// Handles both markdown images and raw <img> tags Turndown kept as HTML;
// the same image appearing twice is uploaded once.
// Alt text and titles can hold backslash-escaped brackets/quotes — news photo
// captions like "\[뉴욕=AP/뉴시스\]" — so those are matched as escapes rather
// than stopping at the first "]".
async function extractImages(markdown, baseName, attachmentsFolder) {
  const re =
    /!\[(?:\\.|[^\]\\])*\]\((data:image\/([a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/=\s]+?)(?:\s+"(?:\\.|[^"\\])*")?\)|<img\b[^>]*?\bsrc="(data:image\/([a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/=\s]+?)"[^>]*>/g;
  const matches = [...markdown.matchAll(re)];
  if (!matches.length) return { markdown, images: [] };

  const saved = new Map(); // dataUrl -> file name
  const images = [];
  for (const m of matches) {
    const dataUrl = (m[1] || m[3]).replace(/\s+/g, "");
    if (saved.has(dataUrl)) continue;
    const sub = (m[2] || m[4]).toLowerCase();
    const ext = MIME_EXT[sub] || sub.replace(/[^a-z0-9]/g, "") || "bin";
    // Two clips of the same page within one second would share baseName,
    // and PUT silently overwrites — so skip numbers already taken.
    let fileName, path;
    for (let n = saved.size + 1; ; n++) {
      fileName = `${baseName}-${n}.${ext}`;
      path = attachmentsFolder ? `${attachmentsFolder}/${fileName}` : fileName;
      if (!(await fileExists(path))) break;
    }
    const blob = await (await fetch(dataUrl)).blob();
    await putFile(path, blob, blob.type || "application/octet-stream");
    saved.set(dataUrl, fileName);
    images.push(path);
  }
  // A raw <img> only exists inside HTML that Turndown kept as-is (e.g. the
  // table around humoruniv's MP4 attachments). Obsidian doesn't render
  // ![[embeds]] inside an HTML block, and a blank line ends the block — so
  // put the embed on its own paragraph, keeping the width the tag had.
  const out = markdown.replace(re, (whole, d1, _s1, d2) => {
    const name = saved.get((d1 || d2).replace(/\s+/g, ""));
    if (!name) return whole;
    if (d1) return `![[${name}]]`;
    const w = /\bwidth="(\d+)"/.exec(whole);
    return `\n\n![[${name}${w ? "|" + w[1] : ""}]]\n\n`;
  });
  return { markdown: out, images };
}

function yamlString(s) {
  return JSON.stringify(String(s)); // a JSON string is a valid YAML double-quoted scalar
}

function frontmatter({ title, url, iso, tags }) {
  const lines = ["---", `title: ${yamlString(title)}`];
  if (url) lines.push(`source: ${yamlString(url)}`);
  lines.push(`clipped: ${yamlString(iso)}`);
  if (tags.length) {
    lines.push("tags:");
    tags.forEach((t) => lines.push(`  - ${yamlString(t)}`));
  }
  lines.push("---", "");
  return lines.join("\n");
}

function parseTags(tags) {
  return (tags || "")
    .split(",")
    .map((t) => t.trim().replace(/^#+/, "").replace(/\s+/g, "-"))
    .filter(Boolean);
}

// Full Page: Obsidian has no HTML notes (Joplin does), and HTML pasted into
// a .md gets its <style> stripped, so the page would render broken. Instead
// the whole page — images already inlined as data: URLs by content.js — goes
// into the attachments folder as one self-contained .html file, and the note
// links to it. Obsidian opens that link in the default browser.
async function saveFullPageFile(clip, baseName, attachmentsFolder) {
  let fileName, path;
  for (let n = 1; ; n++) {
    fileName = n === 1 ? `${baseName}.html` : `${baseName}-${n}.html`;
    path = attachmentsFolder ? `${attachmentsFolder}/${fileName}` : fileName;
    if (!(await fileExists(path))) break;
  }
  await putFile(path, clip.html || "", "text/html; charset=utf-8");
  return { fileName, path };
}

async function saveClip({ clip, parentId, tags, titleOverride }) {
  const settings = await getSettings();
  const folder = cleanFolder(parentId || settings.defaultFolder);
  const attachmentsFolder = cleanFolder(settings.attachmentsFolder);
  const title = titleOverride || clip.title || "Untitled";
  const { iso, compact } = timestamps();

  let body;
  if (clip.mode === "full") {
    const pageFile = await saveFullPageFile(
      clip,
      `${compact}-${safeFileName(title, 40).replace(/\s/g, "-")}`,
      attachmentsFolder
    );
    body = `[[${pageFile.fileName}|🖼 저장된 전체 페이지 열기]]\n\n원본: [${clip.title || title}](${clip.url})\n`;
  } else if (clip.mode === "bookmark") {
    body = `${clip.description ? clip.description + "\n\n" : ""}[${clip.title}](${clip.url})\n`;
  } else {
    body = clip.markdown || "";
  }

  // Attachment names carry a timestamp (plus a free-number check in
  // extractImages) so they never collide across clips
  // (![[name]] resolves by file name anywhere in the vault).
  const { markdown, images } = await extractImages(
    body,
    `${compact}-${safeFileName(title, 40).replace(/\s/g, "-")}`,
    attachmentsFolder
  );

  const base = safeFileName(title, 120);
  let notePath = "";
  for (let i = 1; i <= 50; i++) {
    const name = i === 1 ? `${base}.md` : `${base} (${i}).md`;
    const candidate = folder ? `${folder}/${name}` : name;
    if (!(await fileExists(candidate))) {
      notePath = candidate;
      break;
    }
  }
  if (!notePath) notePath = `${folder ? folder + "/" : ""}${base} ${compact}.md`;

  const content = frontmatter({ title, url: clip.url, iso, tags: parseTags(tags) }) + "\n" + markdown;
  await putFile(notePath, content, "text/markdown; charset=utf-8");

  if (settings.openAfterSave) {
    await obsFetch("/open/" + encodePath(notePath), { method: "POST" }).catch(() => {});
  }
  return { path: notePath, images: images.length };
}

globalThis.BACKEND = {
  testConnection,
  listFolders,
  defaultFolderLabel,
  saveClip,
};
