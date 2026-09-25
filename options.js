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

document.getElementById("test").addEventListener("click", async () => {
  await chrome.storage.local.set(collect());
  setStatus("Testing…");
  chrome.runtime.sendMessage({ type: "testConnection" }, (res) => {
    if (res && res.ok) setStatus("Connected to Obsidian ✓", true);
    else setStatus("Failed: " + (res ? res.error : "no response"), false);
  });
});
