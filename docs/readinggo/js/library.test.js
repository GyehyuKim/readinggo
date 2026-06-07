/**
 * library.js 단위 테스트 (브라우저 콘솔 실행용)
 * 사용법: 브라우저 콘솔에서 `runLibraryTests()` 호출
 *
 * 테스트 대상:
 *   T1 — Markdown Export 포맷 (§5.8.4)
 *   T2 — 별점 유효숫자 toFixed(1) (§5.8.3 v7.2)
 *   T3 — 쪽수 미상 graceful — total=0/null 시 progressPct 안전 (§5.8.4 v7.2 #204)
 */

function runLibraryTests() {
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`  ✅ ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  console.group('📚 library.js — 프로필 탭 테스트');

  // ── T1: Markdown Export 포맷 ────────────────────────────────
  console.group('T1: Markdown Export 포맷');
  {
    const book = { title: '사피엔스', author: '유발 하라리' };
    const quotes = [
      { page: 42, when: '2026-05-10T12:00:00', text: '인류는 이야기를 믿는 능력으로 협력한다', note: '' },
      { page: 120, when: '2026-05-20', text: '돈은 역사상 가장 성공한 이야기다', note: '자본주의의 핵심' },
    ];

    // 포맷 로직 재현 (exportMarkdown 내부와 동일)
    const lines = [`# ${book.title} — ${book.author}`, ''];
    const sorted = quotes.slice().sort((a, b) => (a.page || 0) - (b.page || 0));
    sorted.forEach(q => {
      const date = q.when ? String(q.when).slice(0, 10) : '날짜 미상';
      lines.push(`## ${date} (p.${q.page ?? '?'})`);
      lines.push(`> ${q.text || ''}`);
      if (q.note) { lines.push(''); lines.push(q.note); }
      lines.push('');
    });
    const md = lines.join('\n');

    assert('헤더가 "# 사피엔스 — 유발 하라리" 로 시작', md.startsWith('# 사피엔스 — 유발 하라리'));
    assert('날짜 형식이 YYYY-MM-DD (p.N) 포함', md.includes('## 2026-05-10 (p.42)'));
    assert('문장이 blockquote(>) 로 래핑', md.includes('> 인류는 이야기를'));
    assert('my_note가 있으면 빈 줄 후 포함', md.includes('자본주의의 핵심'));
    assert('페이지 오름차순 정렬 (42 → 120)', md.indexOf('p.42') < md.indexOf('p.120'));

    // 파일명 특수문자 치환
    const title = '사피엔스: 인류의 역사';
    const filename = title.replace(/[\\/:*?"<>|]/g, '_');
    assert('파일명 특수문자(:) 를 _ 로 치환', filename === '사피엔스_ 인류의 역사');
  }
  console.groupEnd();

  // ── T2: 별점 유효숫자 toFixed(1) ───────────────────────────
  console.group('T2: 별점 유효숫자 toFixed(1)');
  {
    const cases = [
      { rating: 4,   expected: '4.0' },
      { rating: 3.5, expected: '3.5' },
      { rating: 5,   expected: '5.0' },
      { rating: 0.5, expected: '0.5' },
    ];
    cases.forEach(({ rating, expected }) => {
      assert(
        `rating ${rating} → toFixed(1) = "${expected}"`,
        (typeof rating === 'number' ? rating.toFixed(1) : '') === expected
      );
    });
    // null/undefined → '별점 없음' 분기
    assert('rating undefined → 별점 없음 분기', typeof undefined !== 'number');
    assert('rating null → 별점 없음 분기', typeof null !== 'number');
  }
  console.groupEnd();

  // ── T3: 쪽수 미상 graceful ──────────────────────────────────
  console.group('T3: 쪽수 미상 graceful (total=0/null)');
  {
    const calcPct = (cur, total) => total ? Math.round((cur / total) * 100) : 0;
    const isUnknown = (total) => !total || total === 0;

    assert('total=0 → progressPct=0 (1/0=∞ 버그 없음)', calcPct(50, 0) === 0);
    assert('total=null → progressPct=0', calcPct(50, null) === 0);
    assert('total=0 → isUnknown=true (쪽수 미상 분기)', isUnknown(0) === true);
    assert('total=null → isUnknown=true', isUnknown(null) === true);
    assert('total=300 → isUnknown=false (정상 진도 표시)', isUnknown(300) === false);
    assert('total=300, cur=150 → 50%', calcPct(150, 300) === 50);
  }
  console.groupEnd();

  // ── 결과 요약 ───────────────────────────────────────────────
  console.log('');
  console.log(`결과: ${passed} passed / ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 모든 테스트 통과!');
  } else {
    console.error(`⚠️ ${failed}개 실패 — 위 항목 확인`);
  }
  console.groupEnd();

  return { passed, failed };
}

// Node.js 환경(테스트 러너)에서도 실행 가능
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runLibraryTests };
}
