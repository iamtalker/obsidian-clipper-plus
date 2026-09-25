# HANDOFF — Obsidian Clipper Plus 인계 문서

마지막 갱신: 2026-09-25 / 현재 버전: **v0.38.0**(조플린은 0.37.0) (GitHub 태그·릴리스 완료) / 작업 폴더: `C:\claude program\obsidian-clipper-plus`

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
| `popup.html`, `options.*`, `manifest.json` | 옵시디언 전용 | "Folder" 라벨, 보라색(버튼 배치는 조플린과 같음) |

- 공유 파일은 원본 레포에서만 수정 → `joplin-clipper-plus/scripts/sync-to-obsidian.sh`로 복사.
- 이 폴더에서 세션을 열면 원본 레포 폴더에 접근하려면 작업 폴더 추가를 요청해야 할 수 있음.

## 2. 옵시디언 저장 방식 (`background.js`)
- 옵시디언 커뮤니티 플러그인 **Local REST API with MCP**(coddingtonbear, 5.2.0)를 통해 저장. **HTTP 포트 27123** 사용(기본 HTTPS 27124는 자체 서명 인증서라 확장에서 못 씀). 인증: `Authorization: Bearer <key>`.
- API 요점(실제로 확인함): `PUT /vault/<경로>`는 중간 폴더를 자동 생성하고 바이너리도 받음, **기존 파일은 조용히 덮어씀**. `HEAD`는 없는 파일이면 404. 경로는 `/`로 나눠서 조각마다 `encodeURIComponent`. `GET /vault/<폴더>/`는 한 단계만 나열하고 빈 폴더는 안 보여줌. `POST /open/<경로>`는 옵시디언에서 노트를 엶. 전체 명세: 플러그인 레포의 `docs/openapi.yaml`.
- 저장 흐름: 마크다운 안의 `data:image` → 첨부 폴더(기본 `Clippings/attachments`)에 파일로 PUT → 본문에서 `![[파일명]]`으로 교체(같은 이미지는 한 번만). 첨부 파일명은 `YYYYMMDD-HHMMSS-제목-N.ext`이고, 이미 있으면 번호를 건너뜀(같은 초에 두 번 저장해도 안 겹치게 — 테스트로 찾은 버그를 고친 것).
- 노트: frontmatter(`title`, `source`, `clipped`, `tags`) + 본문. 파일명에 못 쓰는 문자 정리, 같은 이름이 있으면 `제목 (2).md`.
- 설정(`chrome.storage.local`): `obsidianKey`, `obsidianPort`(27123), `defaultFolder`(Clippings), `attachmentsFolder`(Clippings/attachments — `./`로 시작하면 노트 폴더 기준, `attachmentsFolderFor()`; 설정 화면 버튼이 `.obsidian/app.json`의 `attachmentFolderPath`를 읽어 채움), `openAfterSave`(false).
- Full Page 모드(0.37.0~): 옵시디언은 HTML 노트가 없고 md 안의 HTML은 스타일이 지워지므로, `clip.html`(이미지 data: URL 포함)을 첨부 폴더에 `.html` 파일로 PUT하고 노트에는 `[[파일.html|...]]` 링크를 넣음(`saveFullPageFile`). 사용자가 조플린과의 **기능 일관성**을 원해서 추가함.
- **남은 확인**: 옵시디언에서 `[[x.html]]` 링크를 눌렀을 때 기본 브라우저로 잘 열리는지는 실제 앱에서 사람이 눌러 봐야 함(API로 확인 불가).

## 3. 사용자 환경
- 볼트: `C:\MyData\Obsidian Scrapbook`. 플러그인 HTTP 서버 켜져 있음.
- 테스트용 API 키는 `C:\MyData\Obsidian Scrapbook\.obsidian\plugins\obsidian-local-rest-api\data.json`의 `apiKey`에서 읽음. **절대 출력 금지.** 테스트는 `__jcptest` 같은 전용 폴더에 저장하고 끝나면 삭제.
- GitHub CLI(`gh`)는 iamtalker로 로그인돼 있음. 이 레포의 git 사용자 정보는 레포 로컬 설정에 있음(전역 설정 없음).

## 4. 현재 상태와 할 일
**v0.37.0(2026-09-25)에서 한 것**(두 레포 모두 0.37.0 — 공유 코드도 바뀌었기 때문. 버전 규칙은 이제 "바뀐 쪽만", CLAUDE.md 2번):
- 옵시디언 전용: Full Page 모드(§2), `extractImages` 정규식이 alt 속 이스케이프된 `[ ]`에서 끊기던 버그, HTML 표 안의 raw `<img>`를 빈 줄로 감싼 `![[파일|너비]]`로 바꿈(옵시디언은 HTML 블록 안 embed를 안 그림).
- 공유 코드: Daum 뉴스 지원, 이미지 fetch `include` 실패 시 `omit` 재시도 → 백그라운드 fetch → `src` 폴백, 백그라운드 fetch 429 재시도, `ins.adsbygoogle` 전역 제거, 디시 닉네임 아이콘 제거.
- **실사이트 테스트 완료**(실제 크롬+볼트, 사진 있는 글): 디시 PC/모바일, 클리앙, 뽐뿌, 오유, 휴먼유니브(Article/웹툰/MP4 첨부), SLR, 이토랜드, 인벤, 더쿠, 82쿡(글만), 다모앙(글만), 아카, 루리웹, 네이버 블로그, 나무위키, 위키백과, Daum. aagag는 1차에 OK, 2차엔 봇 확인 화면에 걸림(사람이 눌러야 함).
- 테스트 방법: §5 + 사이트 목록을 도는 스크립트(게시판 목록 → 페이지를 스크롤해 사진 있는 글 고르기 → `clipAndSave` → 볼트의 노트에서 `![[` 개수, 원격 이미지, 남은 `data:image` 검사). Cloudflare 사이트(아카, 나무위키, aagag)는 사람 확인이 뜨면 사용자가 눌러야 함.

**다음 후보**
1. ~~뀨잉~~ → 확인 완료(글 주소는 `bbs/board.php?bo_table=humor&wr_id=N`, 사진 글 정상).
2. **디시 모바일 광고 문구**(우선순위 낮음 — 사용자는 데스크톱만 씀): 원인 찾음. `m.dcinside.com`의 선택자 `.thum-txt`가 스크롤하면 불러와지는 아래쪽 순위 목록 항목(`span.rank-num`이 든 `.thum-txt`)에도 걸려서 광고성 기사 제목이 딸려 옴. 고치려면 글 본문의 첫 `.thum-txt`만 잡도록 선택자를 좁히면 됨.
3. **옵시디언에서 눈으로 확인**: Full Page 노트의 `[[x.html]]` 링크 클릭 시 브라우저로 열리는지, 표 밖으로 빼낸 `![[파일|너비]]`가 제대로 보이는지는 사용자가 앱에서 확인해 줘야 함.
4. **폴더 선택 개선**: API가 빈 폴더를 안 보여줘서 새로 만든 빈 폴더가 목록에 안 나옴. 팝업에서 새 폴더 이름을 직접 입력하는 칸도 고려.
5. **옵시디언다운 기능**: ~~첨부 폴더를 옵시디언 설정에 맞추기~~(0.38.0 완료), 저장 후 열기 기본값, 노트 템플릿(frontmatter 항목) 설정.
6. **관리 편의**(사용자가 옵시디언으로 옮기려는 이유): 이 플러그인의 MCP 서버(`https://127.0.0.1:27124/mcp/`)를 Claude에 연결하면 중복 노트 찾기, 안 쓰는 첨부 이미지 정리 같은 걸 Claude가 볼트에서 직접 할 수 있음. 또는 볼트가 그냥 폴더라 스크립트로 해결.
7. **크롬 웹 스토어**(나중에): `debugger`와 `<all_urls>` 권한이 심사 대상이라 사유 설명이 필요함. 원본도 같은 문제가 있음(원본 HANDOFF 3번). 스토어 이름 "Obsidian Clipper Plus"는 기존 확장(Obsidian Web Clipper, Obsidian Clipper, Obsidian Plus Web Clipper)과 헷갈릴 수 있다는 점은 사용자에게 이미 알렸고, 사용자가 일관성 때문에 이 이름으로 정함.

## 5. 실제 크롬으로 테스트하는 방법
- 스크래치 폴더에 `npm i puppeteer-core` + `npx @puppeteer/browsers install chrome@stable`(Chrome for Testing — 일반 Chrome 137+는 `--load-extension`을 무시함).
- 확장 폴더를 `--disable-extensions-except=<폴더> --load-extension=<폴더>`로 headed 실행 → `browser.waitForTarget(t=>t.type()==='service_worker')` → `.worker()`.
- 서비스 워커에서 `chrome.storage.local.set({obsidianKey, defaultFolder:'__jcptest', attachmentsFolder:'__jcptest/attachments'})` → 로컬 http 서버로 띄운 테스트 페이지를 연 뒤 `clipAndSave(tab.id, 'article', {tags:'...'})`를 `evaluate`로 호출 → 볼트 폴더의 결과 파일을 직접 확인.
- Selection 툴바: `window.__jcpToolbarOpts` 설정 + `toolbar.js` 주입 → 마우스로 드래그 → 툴바의 Save 좌표 클릭(shadow root가 closed라 셀렉터로는 못 잡음).
- 끝나면 `__jcptest` 폴더 삭제.
