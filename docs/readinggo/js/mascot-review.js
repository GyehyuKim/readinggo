import candidateA from './mascot-candidates/jacky-candidate-a.svg?url';
import candidateB from './mascot-candidates/jacky-candidate-b.svg?url';
import candidateC from './mascot-candidates/jacky-candidate-c.svg?url';

const CANDIDATES = [
  { id: 'A', name: 'Balanced Sage', src: candidateA, variable: '둥근 면, 중간 굵기, 정본 세이지 비중 높음' },
  { id: 'B', name: 'Editorial Line', src: candidateB, variable: '윤곽선 강조, 올리브 세이지, 여백 많은 면' },
  { id: 'C', name: 'Quiet Geometric', src: candidateC, variable: '기하학적 단순화, 짙은 세이지, 높은 실루엣 대비' },
];

const CRITERIA = [
  ['small', '48px에서 얼굴·부리·날개 또는 얼굴 윤곽이 뭉개지지 않는다.'],
  ['views', '정면과 측면이 같은 캐릭터로 인식된다.'],
  ['emotion', '네 감정이 과장된 유아형 표정 없이 구분된다.'],
  ['brand', 'SparrowMark와 색·형태 계열이 충돌하지 않는다.'],
  ['surface', '브랜드 표면과 대화 표면에서 같은 캐릭터로 사용할 수 있다.'],
  ['identity', '사용자 fallback avatar와 혼동되지 않는다.'],
  ['meaning', '진화·보상·상실·죄책감의 의미를 암시하지 않는다.'],
];

function MascotReviewScreen({ onClose }) {
  const [results, setResults] = React.useState({});
  const setResult = (candidate, criterion, value) => {
    setResults((current) => ({ ...current, [`${candidate}:${criterion}`]: value }));
  };
  return ReactDOM.createPortal(
    <section aria-labelledby="mascot-review-title" style={{ position: 'fixed', inset: 0, zIndex: 1500, overflowY: 'auto', background: 'var(--paper)', color: 'var(--ink)', padding: 'max(16px, var(--safe-top)) 16px max(28px, var(--safe-bottom))' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0', background: 'var(--paper)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--brand-3)', fontWeight: 900, fontSize: 12 }}>DEV ONLY · #1389 · CANDIDATES, NOT CANONICAL</div>
            <h1 id="mascot-review-title" style={{ margin: '3px 0 0', fontSize: 24 }}>Jacky / 재키 모델 시트 비교</h1>
            <p style={{ margin: '5px 0 0', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.55 }}>A/B/C는 같은 참새 brief의 비교안입니다. 사람의 최종 선택 전에는 앱 아이콘·헤더·로그인·대화·공유·스토어 자산을 교체하지 않습니다.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="재키 후보 비교 닫기" style={{ flexShrink: 0, border: 'none', borderRadius: 'var(--r-sm)', padding: '10px 14px', background: 'var(--brand-soft)', color: 'var(--brand-3)', fontWeight: 900, cursor: 'pointer' }}>닫기</button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16, marginTop: 18 }}>
          {CANDIDATES.map((candidate) => (
            <article key={candidate.id} aria-labelledby={`candidate-${candidate.id}`} style={{ minWidth: 0, border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', background: 'var(--card)', padding: 14 }}>
              <h2 id={`candidate-${candidate.id}`} style={{ margin: 0, fontSize: 19 }}>후보 {candidate.id} · {candidate.name}</h2>
              <p style={{ minHeight: 38, margin: '5px 0 12px', color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>{candidate.variable}</p>
              <img src={candidate.src} alt={`재키 후보 ${candidate.id} 모델 시트: 아이콘 얼굴, 전신 정면과 측면, 평온·반가움·궁금함·공감`} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0', padding: 10, borderRadius: 'var(--r-sm)', background: 'var(--paper-2)' }}>
                <img src={candidate.src} alt="" aria-hidden="true" style={{ width: 48, height: 48, objectFit: 'cover', objectPosition: '91% 73%', borderRadius: 'var(--r-sm)' }} />
                <span style={{ color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.45 }}><b style={{ color: 'var(--ink)' }}>48px 실사용 확인</b><br />얼굴 윤곽·부리·날개 분리</span>
              </div>
              <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
                <legend style={{ marginBottom: 8, fontSize: 13, fontWeight: 900 }}>감사 가능한 pass / fail</legend>
                <div style={{ display: 'grid', gap: 8 }}>
                  {CRITERIA.map(([key, label]) => {
                    const value = results[`${candidate.id}:${key}`] || '';
                    return (
                      <div key={key} style={{ padding: '9px 10px', borderRadius: 'var(--r-sm)', background: 'var(--card-soft)' }}>
                        <div style={{ fontSize: 12, lineHeight: 1.45 }}>{label}</div>
                        <div role="group" aria-label={`${candidate.id} ${label}`} style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                          {['PASS', 'FAIL'].map((option) => (
                            <button key={option} type="button" aria-pressed={value === option} onClick={() => setResult(candidate.id, key, option)} style={{ flex: 1, padding: '6px 8px', border: 'none', borderRadius: 'var(--r-sm)', background: value === option ? (option === 'PASS' ? 'var(--brand)' : 'var(--ink-2)') : 'var(--paper-2)', color: value === option ? '#fff' : 'var(--ink-2)', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>{option}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <p role="status" style={{ margin: '12px 0 0', color: 'var(--ink-2)', fontSize: 12, fontWeight: 800 }}>
                {CRITERIA.some(([key]) => results[`${candidate.id}:${key}`] === 'FAIL')
                  ? '판정: 탈락 — 하나 이상의 FAIL'
                  : CRITERIA.every(([key]) => results[`${candidate.id}:${key}`] === 'PASS')
                    ? '판정: 모든 기준 PASS — 선택 후보로 검토 가능'
                    : '판정: 검토 중 — 모든 기준을 기록하세요'}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>,
    document.body,
  );
}

export { CANDIDATES, CRITERIA, MascotReviewScreen };
