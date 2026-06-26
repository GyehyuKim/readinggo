package com.readinggo.app;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 상태바·내비바 아이콘을 어두운색으로(#1013). 앱 배경이 밝은 크림(--paper #FAF6F0)이라
    // 시스템 기본 흰색 아이콘/시계가 묻혀 안 보인다. targetSdk 36(Android 16) 엣지투엣지에선
    // android:statusBarColor 가 무시되므로, WindowInsetsController 로 appearance 를 직접 설정한다
    // (light bars = 밝은 배경 가정 → 어두운 아이콘). 앱은 라이트 전용이라 정적 설정으로 충분.
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (controller != null) {
      controller.setAppearanceLightStatusBars(true);
      controller.setAppearanceLightNavigationBars(true);
    }
  }
}
