const DEFAULTS = {
  obsidianKey: "",
  obsidianPort: "27123",
  defaultFolder: "Clippings",
  attachmentsFolder: "Clippings/attachments",
  openAfterSave: false,
  defaultMode: "article",
};
const els = {
  obsidianPort: document.getElementById("port"),
  obsidianKey: document.getElementById("key"),
  defaultFolder: document.getElementById("folder"),
  attachmentsFolder: document.getElementById("attach"),
  defaultMode: document.getElementById("defMode"),
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
  chrome.storage.local.set(collect(), () => setStatus("저장했습니다.", true));
});

// Copies Obsidian's "Default location for new attachments"
// (.obsidian/app.json → attachmentFolderPath) into the field. Obsidian
// leaves the key out when it's the default, which is the vault root.
document.getElementById("fromObsidian").addEventListener("click", async (e) => {
  e.preventDefault();
  const { obsidianPort, obsidianKey } = collect();
  if (!obsidianKey) return setStatus("API 키를 먼저 입력하세요.", false);
  try {
    const res = await fetch(`http://127.0.0.1:${obsidianPort}/vault/.obsidian/app.json`, {
      headers: { Authorization: `Bearer ${obsidianKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const path = ((await res.json()).attachmentFolderPath || "/").trim();
    els.attachmentsFolder.value = path === "/" ? "" : path;
    const where = path === "/" ? "볼트 루트" : path.startsWith("./") ? `"${path}" (노트 옆)` : `"${path}"`;
    setStatus(`옵시디언의 첨부 위치: ${where}. 저장을 눌러야 적용됩니다.`, true);
  } catch (err) {
    setStatus("옵시디언 설정을 읽지 못했습니다: " + err.message, false);
  }
});

document.getElementById("test").addEventListener("click", async () => {
  await chrome.storage.local.set(collect());
  setStatus("연결 확인 중…");
  chrome.runtime.sendMessage({ type: "testConnection" }, (res) => {
    if (res && res.ok) setStatus("옵시디언에 연결되었습니다 ✓", true);
    else setStatus("실패: " + (res ? res.error : "응답 없음"), false);
  });
});
