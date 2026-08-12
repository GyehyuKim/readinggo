# 바코드로 책 등록

## 목적

사용자는 책 뒤표지의 ISBN 바코드를 촬영해 책을 검색하고 자신의 책장에 등록할 수 있다.

## 플랫폼 계약

- Android 네이티브 앱은 WebView `BarcodeDetector`가 아니라 Capacitor 네이티브 바코드 스캐너의 ML Kit 경로를 사용한다.
- Android 스캔은 후면 카메라, 세로 화면, EAN-13 형식으로 제한한다. 카메라는 연속 자동초점을 사용하며 플래시를 제공할 수 있다.
- 웹에서는 지원되는 브라우저에 한해 `BarcodeDetector`와 `getUserMedia` 경로를 유지한다.
- 카메라 미지원·권한 거부·실패 시 ISBN 13자리 직접 입력과 제목·저자 검색 경로를 제공한다.

## ISBN 처리

- 인식값은 숫자만 남긴 뒤 13자리 ISBN으로 처리한다.
- 검색 결과가 없거나 조회에 실패하면 오류를 표시하고 다시 스캔할 수 있어야 한다.
- 책이 확인되면 사용자가 책장 상태를 선택해 등록한다.

## Android 시스템 바

- 스캔 화면은 API 36 edge-to-edge 환경을 전제로 한다.
- 헤더는 `--safe-top`, 좌우는 `--safe-left`·`--safe-right`를 소비한다.
- 하단 안내와 책장 선택 시트는 `--safe-bottom`을 소비해 상태바와 제스처 내비게이션 영역을 침범하지 않는다.
- safe-area 전역 변수는 Capacitor SystemBars가 주입하는 `--safe-area-inset-*` 값을 우선하고, 표준 `env(safe-area-inset-*)`를 폴백으로 사용한다.

## 검증

- 웹 번들 빌드가 성공해야 한다.
- Android `assembleDebug`가 성공하고 APK에 CAMERA 권한과 DEV package ID가 있어야 한다.
- 실제 Android 기기에서 978 또는 979 ISBN을 정상 거리에서 인식한다.
- 닫기 버튼과 제목이 상태바 아래에 있고 하단 조작부가 제스처 영역 위에 있어야 한다.
