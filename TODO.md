# 직접 하셔야 할 일

## 1. 게임 빌드 올리기
- [ ] Unity에서 **Windows 빌드**, **macOS 빌드**를 각각 만들어 zip으로 압축
  (게임 저장소의 `Build/` 안에 예전 zip이 있지만 `no_hits`, `unicon` 같은 행사용 버전이니 최신인지 확인해 주세요)
- [ ] 구글 드라이브에 업로드 → 공유를 **"링크가 있는 모든 사용자 / 뷰어"** 로 설정
- [ ] `docs/index.html` 의 `#dl-win`, `#dl-mac` 버튼 `href="#"` 를 각 공유 링크로 교체
  (교체하면 "준비 중" 표시가 자동으로 사라집니다)

## 2. (보류) 플레이 후기 구글 폼 · 팀원 소개
- 지금은 사이트에서 뺐습니다. 준비되면 말씀해 주세요. 문의는 이메일(leejeongwoo1103@gmail.com)로 받습니다.

## 3. 도메인 — 완료
- `echoes-of-farewell.kro.kr` 가 대표 주소이고, `echoesoffarewell.kro.kr`, `eof.r-e.kr` 은 대표 주소로 이동합니다.
- 서버(nginx, `/etc/nginx/sites-enabled/echoes-of-farewell.kro.kr.conf`)와 인증서(acme.sh, 자동 갱신)는 설정됨.

## 4. 행사 후 정리 (10월 18일 이후)
- 행사 팝업은 `data-until` 날짜가 지나면 자동으로 뜨지 않습니다.
- `docs/index.html` 의 `#notice` 팝업과 `#events` 의 DCCF 항목은 행사가 끝나면 지우거나 "참가 완료"로 바꿔 주세요.

## 참고
- 캐릭터 스프라이트를 다시 만들 때: `python3 tools/make_sprites.py`
