# GitHub Release 생성 가이드

## 현재 상태

- 태그 `v0.1.0` / `v0.2.0` / `v0.3.0` / `v0.3.1` / `v0.4.0` 전부 GitHub에 푸시 완료
- `gh` CLI는 시스템에 설치됨 (`C:\Program Files\GitHub CLI\gh.exe`) 단, 로그인 미완료
- `RELEASE_NOTES_v0.*.md` 4개 파일이 각 릴리스 본문으로 준비됨

## 빠른 실행 (사용자 로컬 터미널에서 1회만)

```bash
# 1. gh 로그인 (브라우저로 OAuth, 1회만)
gh auth login --web --git-protocol https

# 2. 태그별 Release 생성 (CHANGELOG 링크 포함)
gh release create v0.1.0 \
  --title "v0.1.0 — Foundation" \
  --notes "첫 구조적 기반 릴리스. 상세: [RELEASE_NOTES_v0.1.0.md](./RELEASE_NOTES_v0.1.0.md) · [CHANGELOG.md](./CHANGELOG.md)"

gh release create v0.2.0 \
  --title "v0.2.0 — Local Executable + Automated Verification" \
  --notes-file RELEASE_NOTES_v0.2.0.md

gh release create v0.3.0 \
  --title "v0.3.0 — Operations + Container + CI" \
  --notes-file RELEASE_NOTES_v0.3.0.md

gh release create v0.3.1 \
  --title "v0.3.1 — Feature Polish (shipping/filter/payment)" \
  --notes "카트 배송지 폼 + 상품 필터/검색 + 결제수단 탭. 상세: [CHANGELOG.md](./CHANGELOG.md#031---2026-04-21)"

gh release create v0.4.0 \
  --title "v0.4.0 — Admin Connected + 2FA + Observability" \
  --notes-file RELEASE_NOTES_v0.4.0.md \
  --latest
```

## 웹 UI 수동 방법 (gh CLI 대신)

1. 브라우저에서 https://github.com/hobbong21/nuxia2/releases/new
2. "Choose a tag" 드롭다운에서 `v0.4.0` 선택
3. "Release title": `v0.4.0 — Admin Connected + 2FA + Observability`
4. "Describe this release" 본문에 `RELEASE_NOTES_v0.4.0.md` 내용 복사 붙여넣기
5. "Set as the latest release" 체크
6. "Publish release" 클릭
7. v0.1.0 / v0.2.0 / v0.3.0 / v0.3.1 에 대해 반복 (latest 체크는 v0.4.0만)

## Release 생성 후 확인

```bash
gh release list --limit 10
gh release view v0.4.0
```

또는 브라우저: https://github.com/hobbong21/nuxia2/releases

## Release가 중요한 이유

- **버전 앵커**: 외부 의존자(포크, issue 링크)가 정확한 시점의 아티팩트 참조 가능
- **Changelog 노출**: GitHub UI의 "Releases" 탭에 릴리스 노트 표시
- **Tarball/Zip 자동 생성**: 각 Release에 소스 아카이브 자동 첨부 (커밋 SHA 기반)
- **프로덕션 배포 기준점**: CI/CD 파이프라인이 태그 기반 트리거 (`docker-build.yml`는 `v*.*.*` 푸시에 활성)

## 후속 릴리스 워크플로 (v0.5 이후)

1. 기능 완성 후 `main`에 머지
2. `CHANGELOG.md`의 `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD` 변경
3. `RELEASE_NOTES_vX.Y.Z.md` 작성 (highlights + 품질 지표 표 + breaking guide + roadmap)
4. 커밋 후 `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`
5. `gh release create vX.Y.Z --notes-file RELEASE_NOTES_vX.Y.Z.md --latest`

## 참고: `gh` 설치 경로

Windows에서 `gh` CLI가 설치된 위치: `C:\Program Files\GitHub CLI\gh.exe`

PATH에 없으면:
```bash
# Git Bash
export PATH="$PATH:/c/Program Files/GitHub CLI"

# PowerShell
$env:PATH += ';C:\Program Files\GitHub CLI'
```

영구 추가는 시스템 환경 변수 편집기에서 진행.
