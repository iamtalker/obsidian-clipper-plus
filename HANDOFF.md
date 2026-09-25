# HANDOFF — Obsidian Clipper Plus 인계 문서

마지막 갱신: 2026-09-25 / 현재 버전: **v0.36.1** (GitHub 태그·릴리스 완료) / 작업 폴더: `C:\claude program\obsidian-clipper-plus`

## 0. 이 프로젝트는
- 조플린용 크롬 확장 **Joplin Clipper Plus**(`C:\claude program\joplin-clipper-plus`, 레포 `iamtalker/joplin-clipper-plus`)를 포크해서 옵시디언용으로 바꾼 크롬 확장(Manifest V3). 레포: `iamtalker/obsidian-clipper-plus`(공개).
- 사용자가 조플린 관리(고아 이미지, 중복 노트 찾기 불편 등)가 귀찮아서 옵시디언으로 옮기는 걸 고민하면서 시작함.
- 사용자는 **이름의 일관성**을 좋아함: 표시 이름 "Joplin Clipper Plus" / "Obsidian Clipper Plus", 레포와 로컬 폴더 이름 `*-clipper-plus`.
- 원본 쪽 인계 문서(`joplin-clipper-plus/HANDOFF.md`)에 사이트 지원 방법, 웹툰 모드, 과거 삽질 교훈이 자세히 있음. 사이트 관련 작업이면 그것도 읽을 것.

## 1. 구조
| 파일 | 공유? | 역할 |
|---|---|---|
| `content.js` | 공유 | 페이지에서 본문 추출(Readability) → 마크다운(Turndown). 사이트별 설정(`SITE_CONTENT_SELECTORS` 등), 이미지 받기/캡처, 웹툰 모드. 이미지는 마크다운 안에 `data:` URL로 넣어서 넘김 |
| `core.js` | 공유 | 서비스 워커 공통부: 스크립트 주입, 캡처 폴백(탭 스크린샷, CDP, 백그라운드 fetch), 메시지 처리, `clipAndSave()` |
| `toolbar.js` | 공유 | Selection 모드 플로팅 툴바(모드 먼저 → 선택 → 저장) |
| `popup.js` | 공유 | 팝업 동작. "Joplin"/"Obsidian" 문구는 manifest 이름을 보고 자동 결정 |
| `lib/` | 공유 | Readability, Turndown |
| `background.js` | **옵시디언 전용** | `importScripts("core.js")` 후 `globalThis.BACKEND = { testConnection, listFolders, defaultFolderLabel, saveClip }` 정의 |
| `popup.html`, `options.*`, `manifest.json` | 옵시디언 전용 | Full Page 버튼 없음, "Folder" 라벨, 보라색 |

- 공유 파일은 원본 레포에서만 수정 → `joplin-clipper-plus/scripts/sync-to-obsidian.sh`로 복사.
- 이 폴더에서 세션을 열면 원본 레포 폴더에 접근하려면 작업 폴더 추가를 요청해야 할 수 있음.

## 2. 옵시디언 저장 방식 (`background.js`)
- 옵시디언 커뮤니티 플러그인 **Local REST API with MCP**(coddingtonbear, 5.2.0)를 통해 저장. **HTTP 포트 27123** 사용(기본 HTTPS 27124는 자체 서명 인증서라 확장에서 못 씀). 인증: `Authorization: Bearer <key>`.
- API 요점(실제로 확인함): `PUT /vault/<경로>`는 중간 폴더를 자동 생성하고 바이너리도 받음, **기존 파일은 조용히 덮어씀**. `HEAD`는 없는 파일이면 404. 경로는 `/`로 나눠서 조각마다 `encodeURIComponent`. `GET /vault/<폴더>/`는 한 단계만 나열하고 빈 폴더는 안 보여줌. `POST /open/<경로>`는 옵시디언에서 노트를 엶. 전체 명세: 플러그인 레포의 `docs/openapi.yaml`.
- 저장 흐름: 마크다운 안의 `data:image` → 첨부 폴더(기본 `Clippings/attachments`)에 파일로 PUT → 본문에서 `![[파일명]]`으로 교체(같은 이미지는 한 번만). 첨부 파일명은 `YYYYMMDD-HHMMSS-제목-N.ext`이고, 이미 있으면 번호를 건너뜀(같은 초에 두 번 저장해도 안 겹치게 — 테스트로 찾은 버그를 고친 것).
- 노트: frontmatter(`title`, `source`, `clipped`, `tags`) + 본문. 파일명에 못 쓰는 문자 정리, 같은 이름이 있으면 `제목 (2).md`.
- 설정(`chrome.storage.local`): `obsidianKey`, `obsidianPort`(27123), `defaultFolder`(Clippings), `attachmentsFolder`(Clippings/attachments), `openAfterSave`(false).
- Full Page 모드는 제외(`saveClip`에서 에러 반환).

## 3. 사용자 환경
- 볼트: `C:\MyData\Obsidian Scrapbook`. 플러그인 HTTP 서버 켜져 있음.
- 테스트용 API 키는 `C:\MyData\Obsidian Scrapbook\.obsidian\plugins\obsidian-local-rest-api\data.json`의 `apiKey`에서 읽음. **절대 출력 금지.** 테스트는 `__jcptest` 같은 전용 폴더에 저장하고 끝나면 삭제.
- GitHub CLI(`gh`)는 iamtalker로 로그인돼 있음. 이 레포의 git 사용자 정보는 레포 로컬 설정에 있음(전역 설정 없음).

## 4. 현재 상태와 할 일
**v0.36.1에서 확인한 것**: 실제 크롬+실제 볼트에서 Article / Webtoon / Bookmark / Selection 툴바 저장, 한글 제목·태그, 이미지 원본과 바이트 단위 동일, 이름 충돌 처리. 단, **로컬 테스트 페이지로만** 확인함.

**다음 후보**
1. **실사용 검증**: 실제 한국 커뮤니티 사이트(디시, 클리앙, 휴먼유니브 웹툰 등)에서 저장해 보고 옵시디언에서 보이는 모양 확인. 사용자 피드백 받기.
2. **폴더 선택 개선**: API가 빈 폴더를 안 보여줘서 새로 만든 빈 폴더가 목록에 안 나옴. 팝업에서 새 폴더 이름을 직접 입력하는 칸도 고려.
3. **옵시디언다운 기능**: 첨부 폴더를 옵시디언 자체 설정(`.obsidian/app.json`의 `attachmentFolderPath`)에 맞추기, 저장 후 열기 기본값, 노트 템플릿(frontmatter 항목) 설정.
4. **관리 편의**(사용자가 옵시디언으로 옮기려는 이유): 이 플러그인의 MCP 서버(`https://127.0.0.1:27124/mcp/`)를 Claude에 연결하면 중복 노트 찾기, 안 쓰는 첨부 이미지 정리 같은 걸 Claude가 볼트에서 직접 할 수 있음. 또는 볼트가 그냥 폴더라 스크립트로 해결.
5. **크롬 웹 스토어**(나중에): `debugger`와 `<all_urls>` 권한이 심사 대상이라 사유 설명이 필요함. 원본도 같은 문제가 있음(원본 HANDOFF 3번). 스토어 이름 "Obsidian Clipper Plus"는 기존 확장(Obsidian Web Clipper, Obsidian Clipper, Obsidian Plus Web Clipper)과 헷갈릴 수 있다는 점은 사용자에게 이미 알렸고, 사용자가 일관성 때문에 이 이름으로 정함.

## 5. 실제 크롬으로 테스트하는 방법
- 스크래치 폴더에 `npm i puppeteer-core` + `npx @puppeteer/browsers install chrome@stable`(Chrome for Testing — 일반 Chrome 137+는 `--load-extension`을 무시함).
- 확장 폴더를 `--disable-extensions-except=<폴더> --load-extension=<폴더>`로 headed 실행 → `browser.waitForTarget(t=>t.type()==='service_worker')` → `.worker()`.
- 서비스 워커에서 `chrome.storage.local.set({obsidianKey, defaultFolder:'__jcptest', attachmentsFolder:'__jcptest/attachments'})` → 로컬 http 서버로 띄운 테스트 페이지를 연 뒤 `clipAndSave(tab.id, 'article', {tags:'...'})`를 `evaluate`로 호출 → 볼트 폴더의 결과 파일을 직접 확인.
- Selection 툴바: `window.__jcpToolbarOpts` 설정 + `toolbar.js` 주입 → 마우스로 드래그 → 툴바의 Save 좌표 클릭(shadow root가 closed라 셀렉터로는 못 잡음).
- 끝나면 `__jcptest` 폴더 삭제.
