# Obsidian Clipper Plus — 작업 규칙

세션을 시작하면 먼저 **[HANDOFF.md](HANDOFF.md)**를 읽을 것. 현재 상태, 구조, 테스트 방법, 다음 할 일이 모두 거기 있음.

## 꼭 지킬 것
1. **공유 파일은 여기서 직접 고치지 않는다**: `content.js`, `core.js`, `toolbar.js`, `popup.js`, `lib/`는 원본 레포 `C:\claude program\joplin-clipper-plus`가 기준. 거기서 고친 뒤 `bash "C:/claude program/joplin-clipper-plus/scripts/sync-to-obsidian.sh"`로 복사해 온다. 이 레포에서만 고치는 파일은 `background.js`, `popup.html`, `options.*`, `manifest.json`, 문서뿐.
2. **버전은 두 레포가 항상 같다**: 코드를 바꾸면 두 레포 모두 `manifest.json` 버전을 올리고 → 각 README "변경 이력" 맨 위에 한글로 원인+해결 기록 → 커밋 → `git tag vX.Y.Z` → 커밋과 태그 푸시. 한쪽만 바뀐 경우에도 다른 쪽은 "공통 코드 동기화" 또는 "변경 없음, 버전 맞춤"으로 올린다. 문서만 바뀌면 버전 안 올림.
3. **`content.js`를 바꾼 뒤(원본 레포에서) 필수 체크**: `node -e "global.window=global;global.document={createElement:()=>({})};const s=require('fs').readFileSync('content.js','utf8');eval(s);eval(s);console.log(typeof window.__jcpRunClip)"` → `function`이 나와야 함.
4. **추측 전에 실제로 돌려 본다**: 실제 크롬(Chrome for Testing)과 실제 볼트로 확인하는 방법은 HANDOFF.md 5번에 있음.
5. 사용자 볼트의 API 키는 테스트할 때 설정 파일에서 읽어 쓰되 **절대 화면에 출력하지 않는다**. 테스트 노트는 전용 폴더에 만들고 끝나면 지운다.
