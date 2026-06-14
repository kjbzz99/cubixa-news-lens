# Cubixa News Lens — PWA 디자인 아이디어 3종

뉴스 신뢰도 검증이라는 무거운 주제를, **모바일에서 한 손으로 빠르게 사용**하는 도구로 풀어내야 한다.
브랜드는 'Cubixa(보라/큐브)' + 'UTTA AI(흑백, 묵직)'의 결합 — 보라의 신선함과 검정의 권위를 동시에 살려야 한다.

다음 세 가지 접근은 의도적으로 다른 분포의 꼬리(tail)에서 샘플링한 컨셉이다.

---

<response>
<text>

## 1. **Editorial Lens — 인쇄 신문 × 미래형 분석 도구**
*Probability: 0.07*

### Design Movement
The New York Times R&D 랩 + 스위스 타이포그래피 × 디지털 다크모드. 종이 신문의 권위를 디지털로 옮기되, AI 분석이라는 미래성을 잃지 않는다.

### Core Principles
- **Editorial Authority**: 결과 화면이 '판결문'처럼 묵직하게 느껴져야 한다.
- **Readable Density**: 모바일임에도 내용을 압축하지 않고, 신문처럼 정보 밀도를 살린다.
- **Asymmetric Hierarchy**: 정중앙 정렬 절대 금지 — 신문 컬럼처럼 좌측 정렬 기반.
- **Restrained Color**: 색상은 '강조용 잉크' 개념 — 보라는 헤드라인과 점수 게이지에만, 나머지는 흑백.

### Color Philosophy
- **Newsprint Cream** `oklch(0.97 0.012 80)` 배경 — 흰 화면 피로 감소
- **Ink Black** `oklch(0.16 0.01 280)` 본문
- **Cubixa Violet** `oklch(0.55 0.22 295)` 강조 1색만
- **Warning Vermillion** `oklch(0.62 0.22 28)` 위험 신호용 (절제된 사용)
- 색상은 전체 화면의 12% 이하만 점유

### Layout Paradigm
- 상단: 가로 폭 100%의 '머스트헤드(masthead)' — UTTA AI 워드마크 + 날짜 + 발행번호 느낌
- 본문: 12-column grid 기반, 모바일에서는 자연스럽게 1-column으로 흐르되 hairline 보더(0.5px)로 칸을 나눔
- 결과 카드: 신문 '사설(editorial)' 박스 스타일 — 좌측 두꺼운 보더, 풀-justified 텍스트

### Signature Elements
- **Drop cap**: 첫 문장 첫 글자가 3줄 높이의 세리프 대문자 — 결과 요약 도입부에 사용
- **Page number ribbon**: 우상단에 작은 'No. 0001 / Issue 2026.05.17' 형태의 발행 메타데이터
- **Hairline dividers**: 0.5px 검정선이 모든 섹션을 구분, 디지털에서 보기 어려운 두께로 의도적 사용

### Interaction Philosophy
정확하고 절제된 — 마치 신문을 페이지마다 넘기는 듯한 감각. 결과가 뜰 때 '인쇄되는 듯한' 미세한 grain 노이즈 페이드인. 버튼은 클릭이 아니라 'page-turn' 같은 뉘앙스.

### Animation
- 페이지 진입: 위에서 아래로 0.5px 라인이 그려지며 섹션이 차례로 나타남 (180ms × stagger 60ms)
- 점수 게이지: 차오르는 게 아니라, 인쇄된 잉크가 번지듯 opacity로 fade-in
- 버튼: 스케일 효과 없음 — `text-decoration: underline`이 좌→우로 그려지는 느낌

### Typography System
- **헤드라인/제목**: `Fraunces` (variable serif) — 무게 800~900, 진중하고 권위적
- **본문**: `Inter` 또는 `Pretendard` (산세리프) — 무게 400~500
- **메타/넘버**: `JetBrains Mono` — 발행번호, 점수 숫자에만 사용
- 한글: `Pretendard` + `Noto Serif KR` 페어링

</text>
<probability>0.07</probability>
</response>

---

<response>
<text>

## 2. **Forensic Studio — 수사 분석실 × 다크 인터페이스**
*Probability: 0.06*

### Design Movement
Bloomberg Terminal × CIA Threat Dashboard × 블랙 미러식 절제된 SF. '뉴스를 분석한다'를 '디지털 포렌식'의 은유로 풀어낸다.

### Core Principles
- **Investigative Tone**: 모든 화면 요소가 '증거를 살피고 있다'는 인상을 줘야 한다.
- **Dark-First**: 다크 모드가 기본, 라이트는 부가 옵션 정도.
- **Data Density**: 점수 + 막대 + 태그 + 출처 링크가 한 화면에 정밀하게 배치.
- **Glow as Signal**: 색은 빛(glow)으로 표현 — 신뢰도가 낮을수록 빨간 glow가 강해짐.

### Color Philosophy
- **Obsidian Base** `oklch(0.14 0.02 280)` 깊은 검정-보라
- **Forensic Plum** `oklch(0.22 0.05 295)` 카드 배경
- **Cyan Beam** `oklch(0.78 0.16 220)` 분석 진행 시 글로우
- **Cubixa Violet Glow** `oklch(0.65 0.25 295)` 점수 게이지 핵심
- **Threat Red** `oklch(0.65 0.25 25)` 왜곡 위험 시그널

### Layout Paradigm
- 화면을 좌측 narrow rail(60px) + 우측 본문으로 분할
- Rail에는 단계별 진행 표시 (1단계 → 9단계 분석 노드가 점으로 시각화)
- 본문은 카드 grid가 아니라 'terminal command' 스타일의 모놀리식 흐름
- 위→아래로 분석 결과가 '타이핑되듯' 출력 (timestamp 포함)

### Signature Elements
- **Scanline**: 점수 카드 위에 1px의 cyan 선이 위에서 아래로 천천히 스캔 (분석 완료 후에도 유지)
- **Pulse Dot**: 라이브 분석 중일 때 좌상단에 빨간 깜빡이는 dot (3초 주기)
- **Mono Timestamps**: `[2026-05-17 03:14:22 KST]` 형식의 타임스탬프가 모든 주요 결과 옆에

### Interaction Philosophy
'시스템과 대화하는' 느낌 — 모든 입력에 즉각적인 진단성 피드백. 기사 URL을 붙여넣으면 'INGESTING…', 'PARSING…', 'CROSS-REFERENCING…' 같은 진단 로그가 흐른다.

### Animation
- 분석 진행: glitch 효과 + tape rewind 같은 미세한 jitter (3px 이내)
- 결과 등장: typewriter (글자 단위 fade-in 8ms 간격)
- glow는 항상 살짝 호흡(2.5초 주기 0.8 → 1 opacity)

### Typography System
- **헤드라인**: `Space Grotesk` — geometric, 약간의 디지털 SF 느낌
- **메타/숫자**: `IBM Plex Mono` — 수사 보고서 felt
- **본문 한글**: `Pretendard` — 정직함을 유지
- 자간 0.05em ~ 0.1em으로 의도적으로 넓혀 'machine-output' 느낌

</text>
<probability>0.06</probability>
</response>

---

<response>
<text>

## 3. **Quiet Authority — 미니멀 럭셔리 × 직관적 신뢰**
*Probability: 0.08*

### Design Movement
Linear, Stripe, Apple HIG의 정수 — 하지만 한국 사용자를 위한 더 따뜻한 톤. 'AI가 분석한다'를 과시하지 않고, '결과만이 정직하게 남는다'는 인상.

### Core Principles
- **Calm Confidence**: 화려함보다 '안정적인 무게감'으로 신뢰를 구축한다.
- **Generous Whitespace**: 모바일이라도 답답하지 않게, 정보 사이 호흡을 둔다.
- **Soft Shadows over Borders**: 보더 대신 부드러운 그림자(2-3 layer)로 카드 분리.
- **Color as Mood**: 보라색은 액센트가 아니라 전체 분위기로 — 매우 옅게 깔린다.

### Color Philosophy
- **Mist White** `oklch(0.985 0.008 295)` 살짝 보라가 도는 흰색 배경
- **Soft Lavender Wash** `oklch(0.96 0.025 295)` 카드 배경 (흰색과 거의 구분 안 될 정도로 미묘)
- **Ink Slate** `oklch(0.22 0.03 280)` 텍스트
- **Cubixa Violet** `oklch(0.58 0.22 295)` 인터랙션과 점수 강조
- **Mute Forest** `oklch(0.55 0.12 155)` 안전(녹색) 시그널 — 흔한 청록 대신 차분한 숲색

### Layout Paradigm
- 모바일 최우선, 그러나 정중앙 정렬을 피한다 — 좌측 16px 인덴트, 우측은 자연스럽게 풀린 정렬
- 풀-블리드(full-bleed) 카드가 아니라 화면 양옆에 24px 마진이 있는 'floating card' 시리즈
- 점수 카드는 매우 큰 숫자(72-96px) + 그 아래 작은 메타 텍스트
- 결과 흐름: Score → Headline Verdict → Top 2 Issues → Action

### Signature Elements
- **Floating Score**: 점수가 카드 안이 아니라 카드 위에 살짝 떠 있는 듯한 inset 그림자
- **Soft Halo**: 점수 주변에 매우 옅은 보라 글로우 (blur 32px, opacity 0.15)
- **Quiet Dividers**: 검정 보더 절대 없음 — 1px `oklch(0.92 0.01 295)` 미스트 라인만

### Interaction Philosophy
사용자가 무엇을 해야 하는지 한 번에 알 수 있도록, 가장 중요한 액션 하나만 눈에 띄게. 부가 액션은 보조적으로 처리. 모든 인터랙션이 'soft snap' — 부드럽게 빨려들어가는 듯한 감각.

### Animation
- 페이지 전환: opacity + translateY(8px) → 0, 240ms cubic-bezier(0.23, 1, 0.32, 1)
- 점수 카운트업: 0 → N으로 1.2초 동안 ease-out, 동시에 glow halo가 페이드인
- 버튼 press: scale(0.97), 160ms — 눌렀다는 확신을 준다
- 분석 진행: 4개의 도트가 좌→우로 차례로 빛나는 패턴 (각 도트 200ms씩, 무한 반복)

### Typography System
- **헤드라인/스코어 숫자**: `Fraunces` (variable, weight 600-700) — 따뜻한 권위
- **본문**: `Pretendard Variable` (한글 최적) — 가독성 최우선
- **UTTA AI 워드마크**: `Space Grotesk` weight 700 + letter-spacing 0.16em — 미니멀 브랜드감
- **숫자/메타**: `JetBrains Mono` — 분석 점수, 타임스탬프
- 한글-영문 페어링이 자연스럽도록 line-height 1.6, letter-spacing -0.01em 통일

</text>
<probability>0.08</probability>
</response>

---

# 선택: **3. Quiet Authority**

이유:
1. **모바일 우선** 환경에 가장 적합 — 한 손 사용성과 가독성이 핵심
2. **신뢰도 검증 도구**의 본질에 맞음: 화려한 UI는 도구의 진정성을 떨어뜨림. "도구가 아니라 결과가 주인공"이라는 메시지를 전달.
3. **Cubixa 보라 + UTTA AI 검정**의 두 브랜드 색을 가장 자연스럽게 통합 — 보라는 분위기, 검정은 권위
4. **PWA로서의 확장성**: 이 톤이라면 향후 iOS/Android 네이티브 앱으로 옮겨도 위화감 없음
5. **PC 확장 프로그램과의 디자인 연속성**: 동일한 보라 그라디언트를 더 차분한 형태로 재해석

특허 명세서의 "신뢰성 있는 검증 도구"라는 본질에 가장 잘 부합하며, '낚시 같으면 안 된다'는 사용자 요구에도 정확히 응답한다.
