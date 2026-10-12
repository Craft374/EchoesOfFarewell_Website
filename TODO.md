# 직접 하셔야 할 일

## 1. 게임 빌드 — 완료
- `#download` 의 Windows / macOS 버튼에 구글 드라이브 링크(DCCF 빌드) 연결됨. 새 빌드를 올리면 `docs/index.html` 의 `#dl-win`, `#dl-mac` href 만 바꿔 주세요.

## 2. 플레이 후기 구글 폼 — 완료 / 팀원 소개 — 보류
- 후기 폼(https://forms.gle/ixTq9JHmvwYqbg5D6)은 `#contact` 의 `#feedback` 버튼에 연결됨. 폼 생성 스크립트는 `GOOGLE_FORM.md`.
- 팀원 소개는 준비되면 말씀해 주세요.

## 3. 도메인 — 완료
- `echoes-of-farewell.kro.kr` 가 대표 주소이고, `echoesoffarewell.kro.kr`, `eof.r-e.kr` 은 대표 주소로 이동합니다.
- 서버(nginx, `/etc/nginx/sites-enabled/echoes-of-farewell.kro.kr.conf`)와 인증서(acme.sh, 자동 갱신)는 설정됨.

## 4. 행사 후 정리 (10월 18일 이후)
- 행사 팝업은 `data-until` 날짜가 지나면 자동으로 뜨지 않습니다.
- `docs/index.html` 의 `#notice` 팝업과 `#events` 의 DCCF 항목은 행사가 끝나면 지우거나 "참가 완료"로 바꿔 주세요.

## 참고
- 캐릭터 스프라이트를 다시 만들 때: `python3 tools/make_sprites.py`
