const DEFAULTS = {
  obsidianKey: "",
  obsidianPort: "27123",
  defaultFolder: "Clippings",
  attachmentsFolder: "Clippings/attachments",
  openAfterSave: false,
};
const els = {
  obsidianPort: document.getElementById("port"),
  obsidianKey: document.getElementById("key"),
  defaultFolder: document.getElementById("folder"),
  attachmentsFolder: document.getElementById("attach"),
};
const openEl = document.getElementById("open");
const statusEl = document.getElementById("status");

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok === undefined ? "" : ok ? "ok" : "err";
}

chrome.storage.local.get(DEFAULTS, (data) => {
  for (const k in els) els[k].value = data[k];
  openEl.checked = !!data.openAfterSave;
});

function collect() {
  const out = { openAfterSave: openEl.checked };
  for (const k in els) out[k] = els[k].value.trim();
  out.obsidianPort = out.obsidianPort || DEFAULTS.obsidianPort;
  return out;
}

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.local.set(collect(), () => setStatus("Saved.", true));
});

// Copies Obsidian's "Default location for new attachments"
// (.obsidian/app.json → attachmentFolderPath) into the field. Obsidian
// leaves the key out when it's the default, which is the vault root.
document.getElementById("fromObsidian").addEventListener("click", async (e) => {
  e.preventDefault();
  const { obsidianPort, obsidianKey } = collect();
  if (!obsidianKey) return setStatus("Enter the API key first.", false);
  try {
    const res = await fetch(`http://127.0.0.1:${obsidianPort}/vault/.obsidian/app.json`, {
      headers: { Authorization: `Bearer ${obsidianKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const path = ((await res.json()).attachmentFolderPath || "/").trim();
    els.attachmentsFolder.value = path === "/" ? "" : path;
    const where = path === "/" ? "vault root" : path.startsWith("./") ? `"${path}" (next to the note)` : `"${path}"`;
    setStatus(`Obsidian saves attachments to: ${where}. Press Save to keep it.`, true);
  } catch (err) {
    setStatus("Couldn't read Obsidian's setting: " + err.message, false);
  }
});

document.getElementById("test").addEventListener("click", async () => {
  await chrome.storage.local.set(collect());
  setStatus("Testing…");
  chrome.runtime.sendMessage({ type: "testConnection" }, (res) => {
    if (res && res.ok) setStatus("Connected to Obsidian ✓", true);
    else setStatus("Failed: " + (res ? res.error : "no response"), false);
  });
});
