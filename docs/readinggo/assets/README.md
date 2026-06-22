# 앱 아이콘·스플래시 소스 (#874)

@capacitor/assets 의 **소스 자산**. sparrow 브랜드(밝은 민트 배경 + 참새, 불투명·풀스퀘어 — iOS 규격).

| 파일 | 크기 | 용도 |
|---|---|---|
| `icon.png` | 1024×1024 | 앱 아이콘 소스(알파 없음 — iOS) |
| `splash.png` | 2732×2732 | 스플래시 소스(중앙 로고+워드마크) |

## 생성(플랫폼 자산) — 툴체인 준비 후
`cap add ios/android`(Xcode/Android Studio 필요, #872) 이후:

```bash
cd docs/readinggo
npm i -D @capacitor/assets
npx @capacitor/assets generate   # icon.png/splash.png → ios·android 전 사이즈 생성
```

## 메모
- 초안 디자인(브랜드 기본). 최종 아이콘은 디자인 검토(승원) 후 교체 가능 — 이 파일만 갈아끼우면 위 명령으로 재생성.
- Android 적응형 아이콘 전경/배경 분리가 필요하면 `icon-foreground.png`/`icon-background.png` 추가.
