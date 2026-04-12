# Mirae Workbook - Multi-user Server Deploy

한 서버에 Claude Code를 1번만 설치하고 user01~user15가 각자 SSH 또는 브라우저(ttyd)로 접속해 자기 터미널/홈에서 Claude를 사용하는 셋업입니다.

## 사양 권장
- Ubuntu 22.04+ / Debian 12+
- 8 vCPU / 16GB RAM / 50GB SSD (15명 동시)

## 실행 순서
```bash
scp -r deploy/multi-user/ root@서버:/root/
ssh root@서버
cd /root/multi-user
chmod +x setup-server.sh setup-ttyd.sh
sudo ./setup-server.sh 20      # 사용자 + Claude + 자원제한
sudo ./setup-ttyd.sh 20        # (선택) 브라우저 터미널
sudo cat /root/workbook-credentials.txt
```

## 사용자 접속
- SSH: `ssh user07@서버` → `claude` → `/login` (첫 1회)
- 브라우저: `http://서버/user07/` → Basic Auth → 동일

## 첫 Claude 로그인
1. `claude` 입력
2. `/login` 입력
3. 표시되는 URL을 본인 PC 브라우저에서 열기
4. Claude 계정 로그인 → 코드 받아서 터미널에 붙여넣기
5. `~/.claude/.credentials.json`에 영구 저장

## 자원 제한 (사용자당)
CPU 150%, RAM 1.5GB, Tasks 300 — `/etc/systemd/system/user-.slice.d/limits.conf`

## 청소
```bash
sudo systemctl stop ttyd-user07
sudo rm -rf /home/user07/.claude /home/user07/*
sudo cp /etc/skel/.bashrc /home/user07/
sudo chown -R user07:user07 /home/user07
sudo systemctl start ttyd-user07
```
