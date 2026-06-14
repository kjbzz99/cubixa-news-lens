# Cubixa News Lens — Project TODO

## v3.0 — Initial MVP (Completed)

- [x] Core analysis pipeline (URL + body input)
- [x] Result view with 10-point scoring system
- [x] PWA manifest + install prompt
- [x] Dark/light theme toggle
- [x] Sound toggle
- [x] Recent history tracking

## v3.1 — Design Refinement (Completed)

- [x] Quiet Authority design system
- [x] Fraunces + Pretendard + Space Grotesk typography
- [x] oklch color palette (violet accent, mist white bg)
- [x] Responsive mobile-first layout
- [x] Micro-interactions (button press, hover states)

## v3.2 — PWA Share Target (Completed)

- [x] Share target protocol integration
- [x] Deep linking support (?url=..., ?text=...)
- [x] Auto-submit on shared content
- [x] Install prompt refinement

## v3.3 — Headline Feed (Completed)

- [x] RSS feed integration (40 sources)
- [x] Cached trust scores (24h TTL)
- [x] Source color coding
- [x] Relative time display
- [x] Manual refresh + polling (5min)

## v3.4 — Result Sharing (Completed)

- [x] Share ID generation
- [x] Result permalink (/r/:id)
- [x] Embed snippet generation (SVG/iframe/script)
- [x] Copy-to-clipboard helpers

## v3.5 — Settings & Config (Completed)

- [x] API base override dialog
- [x] localStorage persistence
- [x] Theme preference saving

## v3.6 — Brand & Branding (Completed)

- [x] Cubixa logo + wordmark
- [x] Brand color palette
- [x] Favicon + PWA icons
- [x] Meta tags (OG, Twitter)

## v3.7 — Express Proxy (Completed)

- [x] Express server setup
- [x] /api/feed proxy
- [x] /api/analyze proxy
- [x] /api/r/:id proxy
- [x] Vite dev middleware integration

## v3.8 — UI Refinement (Completed)

- [x] AnalyzingOverlay: oklch 채도 복원 (0.16/0.13 → 0.22/0.20)
- [x] AnalyzingOverlay: glow stdDeviation 복원 (1.4 → 2.4)
- [x] AnalyzingOverlay: 그라디언트 투명도 복원
- [x] AnalyzingOverlay: PipelineNode 캡슐 복원 (rx=11)
- [x] AnalyzingOverlay: edge 그라디언트 채도 원색 복원
- [x] AgentMetricsGrid: palette 채도 복원 (0.05 → 0.06~0.07)
- [x] AgentMetricsGrid: 5축 균등 배치 (grid-cols-2 sm:grid-cols-5)
- [x] 한국어 라벨 정리 + "AI 검증 관제판" 용어 유지
- [x] 입체 C 로고 + 한글 서브타이틀 추가
- [x] 빌드 통과 (TS 0 에러, vite 4.59s)

## v3.17 — 오늘의 헤드라인 불러오기 실패 수정 + 내부 분석 엔진 완성

**문제:**
- ❌ HeadlineFeed에서 "헤드라인을 불러오지 못했어요" 에러
- ❌ /api/analyze가 죽은 외부 백엔드 URL로 프록시
- ❌ localStorage에 저장된 이전 백엔드 URL이 여전히 유효

**완료된 작업:**
- [x] vite.config.ts에서 하드코딩된 URL 제거 (https://8765-i3c90xtu4wd2y1u1ykome...)
- [x] NEWS_BACKEND_URL 환경변수가 없으면 플러그인 비활성화
- [x] UrlInput 컴포넌트에 localStorage 자동 초기화 로직 추가 (마운트 시 stale URL 자동 제거)
- [x] server/index.ts 완전 재작성 — 내부 분석 엔진 구현 (Anthropic Claude)
  - [x] /api/analyze: 9개 항목 평가 (종합 신뢰도, 출처, 제목-본문 일치도, 감정적 표현, 사실-의견 구분, 근거, 과장, 편향, 논리적 비약)
  - [x] /api/feed: 플레이스홀더 (향후 RSS 통합 가능)
  - [x] /api/r/:shareId: 플레이스홀더 (향후 결과 공유 기능)
- [x] 빌드 통과 (TS 0 에러, vite 4.58s, esbuild 8.7kb)
- [x] 프로덕션 테스트 완료 (분석 엔진 정상 작동, 한글 응답 정상)
- [x] dev 서버 재시작
- [x] 라이브 배포 준비 완료 (v3.17 / 1d7a7ebd)


## v3.18 — Railway 이전 + RSS 스케줄러 구현

**목표:** Manus.space → Railway 이전 (24시간 지속 실행, 안정적 스케줄러)

**작업:**
- [ ] 현재 프로젝트 구조 분석 (데이터베이스, 환경 변수)
- [ ] Node.js RSS 스케줄러 구현 (14개 언론사 피드)
- [ ] Railway 프로젝트 생성 및 데이터베이스 마이그레이션
- [ ] 환경 변수 설정 (Railway 시크릿)
- [ ] Railway에 배포 및 RSS 수집 확인
- [ ] 분석 엔진 통합 테스트
- [ ] 최종 검증 및 문서화
