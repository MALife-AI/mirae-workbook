# mirae-workbook-api

웹 모드 백엔드. nginx 리버스 프록시 뒤에서 동작하며, 두 개의 엔드포인트만 노출한다.

## Endpoints

### `GET /api/me`
nginx Basic Auth가 검증한 사용자명을 반환.

```
→ 200 { "username": "user07" }
→ 401 (X-Remote-User 헤더가 없거나 형식 불일치)
```

### `POST /api/check`
미션 자동검증. 요청 본문은 `MissionSlide.jsx`/`runtime.js`의 `autoChecks`와 동일한 스키마.

```json
{
  "checks": [
    { "type": "file-exists", "path": ".claude/settings.local.json" },
    { "type": "any-exists", "paths": [".claude/skills", "skills"] },
    { "type": "file-contains", "path": "CLAUDE.md", "keyword": "한국어" },
    { "type": "any-contains", "paths": [".claude/settings.local.json"], "keyword": "mcp" },
    { "type": "global-contains", "keyword": "mcp" }
  ]
}
```

응답:
```json
{ "results": [true, false, true, false, true] }
```

## 보안 모델

- 모든 경로는 사용자 홈(`/home/${user}`) 안으로 정규화. 절대경로·`..`·`\0` 거부.
- `global-contains`는 `~/.claude.json`만 허용 (Claude Code의 글로벌 설정 파일).
- 요청당 최대 32개 체크.
- 프로세스는 `workbook-api` 사용자, `workbook-readers` 그룹으로 동작.
- systemd unit은 `ProtectHome=read-only`로 사용자 홈을 읽기 전용으로만 마운트.

## 권한 설정 (setup-server.sh가 자동 수행)

1. `workbook-api` 시스템 사용자 생성 (홈 없음, nologin)
2. `workbook-readers` 그룹 생성
3. `workbook-api`를 `workbook-readers`에 추가
4. 각 `userXX`의 홈을 `chmod 750` + `chgrp workbook-readers`

이 모델에서 백엔드는 사용자 홈을 **읽을 수만** 있고 쓸 수 없다 (`ProtectHome=read-only`).

## 배포

setup-server.sh가 자동으로:
1. 이 디렉터리를 `/opt/mirae-workbook-api/`로 복사
2. `npm install --production`
3. systemd unit을 `/etc/systemd/system/`에 설치
4. `systemctl enable --now mirae-workbook-api`

## 수동 테스트

```bash
# 서버 머신에서
sudo systemctl status mirae-workbook-api
journalctl -u mirae-workbook-api -f

# nginx 통과 테스트
curl -u user01:user01 http://localhost/api/me
curl -u user01:user01 -X POST http://localhost/api/check \
  -H "Content-Type: application/json" \
  -d '{"checks":[{"type":"file-exists","path":".bashrc"}]}'
```
