# 플레이 후기 구글 폼 만들기 (Apps Script)

아래 스크립트를 한 번 실행하면 **후기 폼 + 응답 스프레드시트**가 내 구글 드라이브에 만들어집니다.

## 사용 방법

1. [script.google.com](https://script.google.com) → **새 프로젝트**
2. 기본 코드를 지우고 아래 코드를 붙여넣기 → 저장(⌘S)
3. 상단 함수 목록에서 `createForm` 선택 → **실행**
4. 권한 요청 → 계정 선택 → "확인되지 않은 앱" 경고가 나오면 **고급 → (프로젝트 이름)(으)로 이동 → 허용**
5. 아래쪽 **실행 로그**에 나온 링크 3개를 확인
   - `편집:` 폼 수정용 (나만)
   - `공유:` 사이트 버튼·QR에 넣을 응답용 링크
   - `응답 시트:` 응답이 쌓이는 스프레드시트
6. 편집 링크로 폼을 열어 **응답 받기가 켜져 있는지** 확인. 우측 상단에 **게시** 버튼이 보이면 눌러 주세요.

> 다시 실행하면 폼과 시트가 **하나 더** 만들어집니다. 문항을 고치려면 폼 편집 화면에서 직접 고치는 편이 편합니다.

## 코드

```javascript
function createForm() {
  const title = 'Echoes of Farewell 플레이 후기';
  const form = FormApp.create(title)
    .setDescription('Echoes of Farewell 데모를 플레이해 주셔서 감사합니다!\n'
      + '3분이면 끝나요. 남겨 주신 의견은 게임을 다듬는 데 소중히 쓰겠습니다.\n— TEAM A>S>D>F_')
    .setConfirmationMessage('소중한 후기 감사합니다! 더 좋은 게임으로 돌아올게요.');

  // 플레이 정보
  form.addMultipleChoiceItem()
    .setTitle('어디서 플레이하셨나요?')
    .setChoiceValues(['대구콘텐츠페어 부스', 'Windows (데모 다운로드)', 'macOS (데모 다운로드)'])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('얼마나 플레이하셨나요?')
    .setChoiceValues(['10분 미만', '10~30분', '30분~1시간', '1시간 이상'])
    .setRequired(true);

  // 평가
  form.addGridItem()
    .setTitle('항목별 만족도')
    .setHelpText('1 = 별로예요, 5 = 최고예요')
    .setRows(['전체', '전투', '패링', '카드 시스템'])
    .setColumns(['1', '2', '3', '4', '5'])
    .setRequired(true);

  form.addScaleItem()
    .setTitle('난이도는 어땠나요?')
    .setBounds(1, 5)
    .setLabels('너무 쉬움', '너무 어려움')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('친구에게 추천하고 싶나요?')
    .setBounds(1, 5)
    .setLabels('전혀 아니요', '꼭 추천할래요')
    .setRequired(true);

  // 의견 (모두 선택)
  form.addParagraphTextItem().setTitle('가장 좋았던 점');
  form.addParagraphTextItem().setTitle('아쉬웠던 점');
  form.addParagraphTextItem()
    .setTitle('막힌 구간이나 버그')
    .setHelpText('어느 구간에서, 어떤 상황이었는지 적어 주시면 큰 도움이 됩니다.');
  form.addParagraphTextItem().setTitle('자유롭게 하고 싶은 말');

  form.addTextItem()
    .setTitle('이메일 (선택)')
    .setHelpText('출시·업데이트 소식을 받고 싶으시면 적어 주세요. 소식 안내 외에는 사용하지 않습니다.')
    .setValidation(FormApp.createTextValidation()
      .setHelpText('이메일 형식으로 적어 주세요.')
      .requireTextIsEmail()
      .build());

  // 응답을 스프레드시트로 받기
  const sheet = SpreadsheetApp.create(title + ' (응답)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('편집: ' + form.getEditUrl());
  Logger.log('공유: ' + form.getPublishedUrl());
  Logger.log('응답 시트: ' + sheet.getUrl());
}
```
