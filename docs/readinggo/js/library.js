// library.js — 내서재 탭 (§5.7: 책 목록 + 책 상세 + Markdown export + 설정)
// 의존: data.js, components.js

// ── SNS 공유 카드 모달 (Canvas 이미지 다운로드 지원) ──────────────────────────
const SNSCardModal = ({ book, sentence, page, onClose }) => {
  const [theme, setTheme] = React.useState('cream'); // cream | dark | mint | warm
  const canvasRef = React.useRef(null);

  const themeColors = {
    cream: { bg: '#FAF6F0', text: '#2A2D33', sub: '#9097A0', accent: '#3FD17F', border: '#ECE6DA' },
    dark: { bg: '#1F1F1F', text: '#FAF6F0', sub: '#AFAFAF', accent: '#58CC02', border: '#2A2D33' },
    mint: { bg: '#EBFBF3', text: '#1E5E3A', sub: '#629E7D', accent: '#3FD17F', border: '#D2F2E1' },
    warm: { bg: '#FFF5F5', text: '#5E2B2B', sub: '#9E6E6E', accent: '#FF8A9A', border: '#FCDCDC' },
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = themeColors[theme];

    // 고해상도 1080x1080 스케일링
    canvas.width = 1080;
    canvas.height = 1080;

    // 배경색 채우기
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, 1080, 1080);

    // 테두리 선
    ctx.lineWidth = 20;
    ctx.strokeStyle = colors.border;
    ctx.strokeRect(40, 40, 1000, 1000);

    // 앱 이름
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('🐦 ReadingGo', 100, 130);

    // D-Day / 스트릭 배지
    ctx.fillStyle = colors.text;
    ctx.font = '800 32px sans-serif';
    ctx.fillText('🔥 21일 연속 독서 중', 750, 130);

    // 구분선
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(100, 180);
    ctx.lineTo(980, 180);
    ctx.stroke();

    // 책 제목
    ctx.fillStyle = colors.text;
    ctx.font = '900 64px sans-serif';
    ctx.fillText(`《${book.title}》`, 100, 290);

    ctx.fillStyle = colors.sub;
    ctx.font = '700 36px sans-serif';
    ctx.fillText(`${book.author} · p.${page}`, 110, 350);

    // 따옴표 마크
    ctx.fillStyle = colors.accent;
    ctx.font = '900 240px sans-serif';
    ctx.fillText('“', 100, 580);

    // 문장 텍스트 래핑 렌더링
    ctx.fillStyle = colors.text;
    ctx.font = 'italic 700 44px sans-serif';
    const text = sentence;
    const words = text.split('');
    let line = '';
    let y = 620;
    const maxWidth = 880;
    const lineHeight = 70;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n];
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, 100, y);
        line = words[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 100, y);

    // 닫는 따옴표
    ctx.fillStyle = colors.accent;
    ctx.font = '900 240px sans-serif';
    ctx.fillText('”', 880, y + 160);

    // 하단 카피라이트
    ctx.fillStyle = colors.sub;
    ctx.font = '700 30px sans-serif';
    ctx.fillText('하루 한 페이지, 독서 습관 리딩고', 100, 970);
    ctx.fillText('@gyehyu', 850, 970);

    // 실제 다운로드 링크 생성
    const link = document.createElement('a');
    link.download = `ReadingGo_Card_${book.title.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL();
    link.click();
    window._showToast && window._showToast('🎨 고해상도 PNG 이미지를 저장했습니다!');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} className="fade-in">
      <div style={{ width: '100%', background: '#fff', borderRadius: 24, padding: 20, maxWidth: 360 }} className="pop-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: '#1F1F1F', margin: 0 }}>🎨 인스타그램 공유 카드</p>
          <button onClick={onClose} className="rg-btn-icon"><XIcon s={20}/></button>
        </div>

        {/* 프리뷰 카드 카드 */}
        <div style={{
          width: '100%', aspectRatio: '1/1', borderRadius: 16, padding: 20,
          background: themeColors[theme].bg, color: themeColors[theme].text,
          border: `2px solid ${themeColors[theme].border}`, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', position: 'relative', overflow: 'hidden'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: themeColors[theme].accent }}>🐦 ReadingGo</span>
              <span style={{ fontSize: 10, fontWeight: 800 }}>🔥 21일 연속</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 900, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>《{book.title}》</p>
            <p style={{ fontSize: 11, color: themeColors[theme].sub, margin: 0 }}>{book.author} · p.{page}</p>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 50, color: themeColors[theme].accent, opacity: 0.3 }}>“</span>
            <p style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
              {sentence}
            </p>
            <span style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 50, color: themeColors[theme].accent, opacity: 0.3 }}>”</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: themeColors[theme].sub, fontWeight: 700 }}>
            <span>하루 한 페이지 독서 리딩고</span>
            <span>@gyehyu</span>
          </div>
        </div>

        {/* 테마 셀렉터 */}
        <div style={{ display: 'flex', gap: 6, margin: '14px 0' }}>
          {['cream', 'dark', 'mint', 'warm'].map(t => (
            <button key={t} onClick={() => setTheme(t)} style={{
              flex: 1, height: 26, borderRadius: 8, border: theme === t ? '2px solid #58CC02' : '1.5px solid #E5E5E5',
              background: themeColors[t].bg, cursor: 'pointer', outline: 'none'
            }}/>
          ))}
        </div>

        {/* 렌더링용 숨겨진 Canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }}/>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-duo btn-white" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>취소</button>
          <button onClick={handleDownload} className="btn-duo btn-green" style={{ flex: 1, padding: '10px 0', fontSize: 13 }}>💾 이미지 저장</button>
        </div>
      </div>
    </div>
  );
};

// ── AI 추출책(Extracted Book) 모달 ──────────────────────────────────────────
const AIExtractedBookModal = ({ book, sentences, onClose }) => {
  const [activeChapter, setActiveChapter] = React.useState(0);

  // 시드 추출 책 내용 (Phase 0 데모용 사피엔스 기준)
  const sampleChapters = [
    {
      title: '제 1장: 상상의 질서와 인지혁명',
      summary: '사피엔스가 지구를 지배하게 된 근본 힘은 존재하지 않는 대상을 믿는 "상상력"과 "공동의 신화"입니다. 종교, 국가, 돈 모두 상상의 질서 위에서 작동합니다.',
      quotes: sentences.slice(0, 2),
      action: '나의 믿음 중 당연하다고 여겨온 사회적 상상물(예: 브랜드 가치, 화폐 가치)이 무엇인지 되돌아보기.'
    },
    {
      title: '제 2장: 농업혁명이라는 거대한 덫',
      summary: '농업혁명은 인류 전체를 풍요롭게 만들기보다, 소수 지배 계급의 번영과 개별 사피엔스의 과도한 노동 시간 증가를 불러왔습니다. 인류는 밀을 길들인 것이 아니라 밀에 길들여졌습니다.',
      quotes: sentences.slice(2, 4),
      action: '효율성을 극대화하기 위해 나 자신을 도구화하여 오히려 자유를 잃고 있지 않은지 성찰하기.'
    },
    {
      title: '제 3장: 과학혁명과 제국의 결합',
      summary: '사피엔스가 다른 생명체와 구별되는 과학혁명의 원동력은 "우리가 무지하다는 것을 인정하는 태도"였습니다. 과학은 제국주의, 자본주의와 강력히 결합하며 세계를 팽창시켰습니다.',
      quotes: sentences.slice(4),
      action: '나의 한계를 인정하고 새로운 배움과 호기심을 두려워하지 않는 자세 확립하기.'
    }
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} className="fade-in">
      <div style={{ width: '100%', background: '#FAF6F0', borderRadius: 24, padding: 20, maxHeight: '85%', overflowY: 'auto', border: '6px double #C49A4A' }}
        className="pop-in" onClick={e => e.stopPropagation()}>
        
        {/* 북 커버 느낌의 헤더 */}
        <div style={{ borderBottom: '2px solid #C49A4A', paddingBottom: 12, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#C49A4A', letterSpacing: 1 }}>🤖 AI EXTRACTED BOOK</span>
            <button onClick={onClose} className="rg-btn-icon" style={{ color: '#C49A4A' }}><XIcon s={20}/></button>
          </div>
          <p style={{ fontWeight: 900, fontSize: 18, color: '#2A2D33', margin: '10px 0 2px' }}>《{book.title}》 추출책</p>
          <p style={{ fontSize: 11, color: '#9097A0', margin: 0 }}>나의 {sentences.length}개 모이로 컴파일된 단 하나의 텍스트</p>
        </div>

        {/* 장 선택 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #ECE6DA', paddingBottom: 6 }}>
          {sampleChapters.map((ch, idx) => (
            <button key={idx} onClick={() => setActiveChapter(idx)} style={{
              flex: 1, padding: '6px 0', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
              color: activeChapter === idx ? '#C49A4A' : '#9097A0',
              borderBottom: activeChapter === idx ? '3px solid #C49A4A' : '3px solid transparent',
            }}>
              {idx + 1}장
            </button>
          ))}
        </div>

        {/* 챕터 요약 내용 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1.5px solid #ECE6DA', marginBottom: 14 }}>
          <p style={{ fontWeight: 900, fontSize: 14, color: '#2A2D33', margin: '0 0 10px' }}>{sampleChapters[activeChapter].title}</p>
          <p style={{ fontSize: 13, color: '#5A5F69', lineHeight: 1.6, margin: '0 0 14px' }}>
            {sampleChapters[activeChapter].summary}
          </p>

          {/* 수집된 문장 매핑 */}
          {sampleChapters[activeChapter].quotes.length > 0 && (
            <div style={{ borderTop: '1px dashed #ECE6DA', paddingTop: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#C49A4A', marginBottom: 8 }}>📌 내가 수집한 문장</p>
              {sampleChapters[activeChapter].quotes.map(q => (
                <div key={q.id} style={{ fontStyle: 'italic', fontSize: 12, color: '#2A2D33', marginBottom: 6, paddingLeft: 8, borderLeft: '2.5px solid #C49A4A', lineHeight: 1.4 }}>
                  "{q.text}" <span style={{ fontSize: 10, color: '#9097A0', fontStyle: 'normal' }}>(p.{q.page})</span>
                </div>
              ))}
            </div>
          )}

          {/* AI 추천 액션 아이템 */}
          <div style={{ background: '#FFF9F0', borderRadius: 10, padding: 10, border: '1px solid #FFE0A0' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#C8901C', margin: '0 0 4px' }}>💡 AI가 추천하는 실천 액션</p>
            <p style={{ fontSize: 11, color: '#8A6234', margin: 0, lineHeight: 1.4 }}>
              {sampleChapters[activeChapter].action}
            </p>
          </div>
        </div>

        <button onClick={() => {
          window.print();
        }} className="btn-duo btn-yellow" style={{ width: '100%', padding: '12px 0', background: '#C49A4A', boxShadow: '0 4px 0 #8B6234' }}>
          📄 PDF 책자로 내보내기 (인쇄)
        </button>
      </div>
    </div>
  );
};

// ── BookDetail ──────────────────────────────────────────────────────────────────
const BookDetail = ({ userBook, onBack, onDelete }) => {
  const { book, currentPage, sessions = [], sentences = [] } = userBook;
  const pct = Math.min(100, Math.round((currentPage / book.total_pages) * 100));
  const st  = getNestStage(pct);
  const isCompleted = userBook.status === 'completed' || pct === 100;

  // 모달 상태
  const [activeShareSentence, setActiveShareSentence] = React.useState(null);
  const [showExtractedBook, setShowExtractedBook] = React.useState(false);

  // §5.7 Markdown export
  const handleExport = () => {
    const lines = [`# ${book.title} — ${book.author}\n`];
    sentences.slice().reverse().forEach(s => {
      const d = new Date(s.createdAt);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      lines.push(`## ${dateStr} (p.${s.page})`);
      lines.push(`> ${s.text}\n`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${book.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '2px solid #E5E5E5', background: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BackIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
        <span style={{ flex: 1, fontWeight: 900, fontSize: 16, color: '#1F1F1F', overflow: 'hidden',
          whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{book.title}</span>
        <button onClick={handleExport} style={{ background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 12px', borderRadius: 10, background: '#F0FDF4', border: '1.5px solid #D7F0BF' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#58CC02' }}>↓ Export</span>
        </button>
      </div>

      <div className="rg-scroll">
        {/* 표지 + 진척 바 */}
        <div className="rg-card" style={{ padding: 20, marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', background: '#fff' }}>
          <BookCover book={book} size={80} radius={14}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: '#1F1F1F', margin: '0 0 4px',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{book.title}</p>
            <p style={{ fontSize: 12, color: '#AFAFAF', margin: '0 0 10px' }}>{book.author}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#E5E5E5', overflow: 'hidden' }}>
                <div style={{ height: 8, borderRadius: 4, width: `${pct}%`, background: st.color }}/>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{pct}%</span>
            </div>
            <p style={{ fontSize: 11, color: '#AFAFAF', margin: '4px 0 0' }}>
              {currentPage}/{book.total_pages}p · {sessions.length}회 기록
            </p>
          </div>
        </div>

        {/* 완독 세레머니 및 AI 추출책 & AI 도서 추천 기능 */}
        {isCompleted && (
          <div className="rg-card" style={{ padding: 16, background: '#F0FDF4', borderColor: '#D7F0BF', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🎉</span>
              <p style={{ fontWeight: 900, fontSize: 14, color: '#1F8E4D', margin: 0 }}>축하합니다! 완독에 성공하셨습니다.</p>
            </div>
            <p style={{ fontSize: 12, color: '#5A5F69', fontWeight: 600, margin: '0 0 12px', lineHeight: 1.4 }}>
              완독 후 나의 한 문장 모이들을 인공지능이 테마별로 컴파일하여 탄생한 단 하나의 책자를 읽어보세요!
            </p>
            
            {/* AI 추출책 버튼 */}
            <button
              onClick={() => setShowExtractedBook(true)}
              className="btn-duo btn-green"
              style={{ width: '100%', padding: '10px 0', fontSize: 13, marginBottom: 12 }}
            >
              📖 나만의 Extracted Book 보기
            </button>

            {/* AI 도서 추천 섹션 (§5.8) */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1.5px solid #D7F0BF', marginTop: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#1F8E4D', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🤖</span> Gemini 추천 다음 읽을 책 3선
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { title: '호모 데우스', author: '유발 하라리', reason: '사피엔스의 후속작으로 인류가 신이 되려 할 때 마주할 미래를 전망합니다.', isbn: '9788934979920' },
                  { title: '총, 균, 쇠', author: '제러드 다이아몬드', reason: '지리적 요인이 인류 역사에 미친 장기적 영향의 궤적을 심층 추적합니다.', isbn: '9788947520027' },
                  { title: '도파민네이션', author: '애나 렘키', reason: '현대 문명 속 사피엔스가 마주한 쾌락과 고통의 저울 메커니즘을 밝힙니다.', isbn: '9788950997486' }
                ].map((rec, i) => (
                  <div key={i} style={{ borderBottom: i < 2 ? '1px dashed #E5E5E5' : 'none', paddingBottom: i < 2 ? 8 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                      <p style={{ fontWeight: 800, fontSize: 12, color: '#1F1F1F', margin: 0 }}>{rec.title}</p>
                      <a
                        href={`https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(rec.isbn)}&partner=readinggo`} // 파트너 키 파라미터 (§5.8)
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 10, color: '#58CC02', fontWeight: 800, textDecoration: 'none' }}
                      >
                        구매 🛒
                      </a>
                    </div>
                    <p style={{ fontSize: 10, color: '#AFAFAF', margin: '0 0 4px' }}>{rec.author}</p>
                    <p style={{ fontSize: 10, color: '#5A5F69', margin: 0, lineHeight: 1.3 }}>"{rec.reason}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 오늘의 문장 타임라인 (§5.7: 날짜 desc) */}
        <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', marginBottom: 10 }}>📝 기록한 문장</p>
        {sentences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#AFAFAF' }}>
            <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
              오늘의 문장을 첫 페이지에 남겨보세요
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sentences.slice().reverse().map(s => {
              const d = new Date(s.createdAt);
              const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
              return (
                <div key={s.id} className="rg-card" style={{ borderRadius: 16, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#58CC02' }}>{dateStr}</span>
                    <span style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 700 }}>p.{s.page}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#1F1F1F', lineHeight: 1.6, margin: '0 0 10px',
                    fontStyle: 'italic' }}>{s.text}</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setActiveShareSentence(s)}
                      className="btn-duo btn-white"
                      style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8 }}
                    >
                      🎨 SNS 공유 카드
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 교보문고 링크 (§5.7) */}
        <a href={KYOBO_URLS[book.isbn] || `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(book.isbn || book.title)}&partner=readinggo`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', textAlign: 'center', marginTop: 16, padding: '12px 0',
            background: '#FFF9F0', border: '1.5px solid #FFE0A0', borderRadius: 14,
            fontSize: 13, fontWeight: 800, color: '#C8901C', textDecoration: 'none' }}>
          교보문고에서 보기 →
        </a>

        {/* 삭제 (§5.7: soft delete) */}
        <button onClick={() => window.confirm('이 책을 삭제할까요? 기록은 보존됩니다.') && onDelete(userBook.id)}
          style={{ marginTop: 20, width: '100%', background: 'none', border: '2px solid #E5E5E5',
            borderRadius: 14, padding: '12px 0', color: '#AFAFAF', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: 'Nunito' }}>
          책 삭제 (기록 보존)
        </button>
      </div>

      {/* 팝업 모달 */}
      {activeShareSentence && (
        <SNSCardModal
          book={book}
          sentence={activeShareSentence.text}
          page={activeShareSentence.page}
          onClose={() => setActiveShareSentence(null)}
        />
      )}

      {showExtractedBook && (
        <AIExtractedBookModal
          book={book}
          sentences={sentences}
          onClose={() => setShowExtractedBook(null)}
        />
      )}
    </div>
  );
};

// ── 설정 화면 ─────────────────────────────────────────────────────────────────
const SettingsView = ({ state, onBack, onStateChange, onReset }) => {
  const [handle, setHandle] = React.useState(state.user.handle || '');
  const [shieldSim, setShieldSim] = React.useState(false);

  const saveHandle = () => {
    if (!handle.trim()) return;
    onStateChange(prev => ({ ...prev, user: { ...prev.user, handle: handle.trim() } }));
    window._showToast && window._showToast('닉네임이 저장되었어요 ✓');
  };

  // §9 2:45 시뮬레이션: 방패 0 → 스트릭 리셋
  const triggerShieldSim = () => {
    setShieldSim(true);
    onStateChange(prev => ({
      ...prev,
      user: { ...prev.user, streak: 0, shields: 0 },
    }));
    window._showToast && window._showToast('🌱 오늘부터 다시 1일차예요');
    setTimeout(() => setShieldSim(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '2px solid #E5E5E5', background: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BackIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
        <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>설정</span>
      </div>

      <div className="rg-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 닉네임 */}
        <div className="rg-card" style={{ padding: 20 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 10px' }}>닉네임 (§5.8)</p>
          <p style={{ fontSize: 11, color: '#AFAFAF', margin: '0 0 10px', lineHeight: 1.5 }}>
            영소문자 / 숫자 / 한글 / 언더스코어 · 2~16자
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={handle} onChange={e => setHandle(e.target.value)}
              placeholder="@nickname"
              style={{ flex: 1, border: '2px solid #E5E5E5', borderRadius: 12, padding: '10px 14px',
                fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'Nunito' }}
              onFocus={e => e.target.style.borderColor = '#58CC02'}
              onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
            />
            <button onClick={saveHandle} className="btn-duo btn-green" style={{ padding: '10px 16px', fontSize: 13 }}>
              저장
            </button>
          </div>
        </div>

        {/* 데모 시뮬레이션 패널 (§9) */}
        <div className="rg-card" style={{ padding: 20, borderColor: '#FFC80044' }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 4px' }}>
            🎬 데모 시뮬레이션
          </p>
          <p style={{ fontSize: 11, color: '#AFAFAF', margin: '0 0 12px' }}>Phase 0 발표용</p>
          <button onClick={triggerShieldSim} className="btn-duo btn-yellow" style={{ width: '100%', fontSize: 13 }}>
            미참여 시뮬 (방패 0 → 스트릭 리셋)
          </button>
        </div>

        {/* 로그아웃 */}
        <div className="rg-card" style={{ padding: 20 }}>
          <button onClick={onReset} style={{ width: '100%', background: 'none', border: '2px solid #FF4B4B',
            borderRadius: 14, padding: '12px 0', color: '#FF4B4B', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', fontFamily: 'Nunito' }}>
            로그아웃 / 데이터 초기화
          </button>
          <p style={{ fontSize: 11, color: '#AFAFAF', textAlign: 'center', margin: '8px 0 0' }}>
            Phase 0: localStorage 전체 삭제
          </p>
        </div>
      </div>
    </div>
  );
};

// ── LibraryView (내서재 탭) ────────────────────────────────────────────────────
const LibraryView = ({ state, onStateChange, onAddBook }) => {
  const [query,      setQuery]  = React.useState('');
  const [detail,     setDetail] = React.useState(null); // userBook id
  const [showSettings, setSettings] = React.useState(false);
  const [libTab, setLibTab] = React.useState('shelf'); // 'shelf' | 'wish' | 'bookmark'

  const userBooks  = state.userBooks  || [];
  const wishBooks  = state.wishBooks  || [];
  const bookmarks  = state.bookmarks  || [];
  const activeBook = getActiveBook(state);

  const filtered = query
    ? userBooks.filter(ub =>
        ub.book.title.toLowerCase().includes(query.toLowerCase()) ||
        ub.book.author.toLowerCase().includes(query.toLowerCase()))
    : userBooks;

  const handleDelete = id => {
    onStateChange(prev => ({
      ...prev,
      userBooks: prev.userBooks.map(ub => ub.id === id ? { ...ub, status: 'archived' } : ub),
      activeUserBookId: prev.activeUserBookId === id ? null : prev.activeUserBookId,
    }));
    setDetail(null);
  };

  const handleReset = () => {
    if (window.confirm('모든 데이터를 초기화할까요?')) {
      localStorage.removeItem('rg_v41');
      localStorage.removeItem('rg_pending_sentence');
      window.location.reload();
    }
  };

  // 책 상세 화면
  const detailBook = detail ? userBooks.find(ub => ub.id === detail) : null;
  if (detailBook) return (
    <BookDetail
      userBook={detailBook}
      onBack={() => setDetail(null)}
      onDelete={handleDelete}
    />
  );

  // 설정 화면
  if (showSettings) return (
    <SettingsView
      state={state}
      onBack={() => setSettings(false)}
      onStateChange={onStateChange}
      onReset={handleReset}
    />
  );

  const visible = filtered.filter(ub => ub.status !== 'archived');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '2px solid #E5E5E5', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>📚</span>
          <span style={{ fontWeight: 900, fontSize: 17, color: '#1F1F1F' }}>내 서재</span>
        </div>
        <button onClick={() => setSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <SettingsIcon s={22} style={{ color: '#AFAFAF' }}/>
        </button>
      </div>

      {/* 탭 행 */}
      <div style={{ display: 'flex', padding: '0 16px', borderBottom: '2px solid #E5E5E5',
        background: '#fff', gap: 0, flexShrink: 0 }}>
        {[['shelf','내 책장'],['wish','관심 책'],['bookmark','책갈피']].map(([id, label]) => (
          <button key={id} onClick={() => setLibTab(id)} style={{
            flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
            color: libTab === id ? '#3FD17F' : '#AFAFAF',
            borderBottom: libTab === id ? '2.5px solid #3FD17F' : '2.5px solid transparent',
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      <div className="rg-scroll">
        {/* ── 관심 책 탭 ── */}
        {libTab === 'wish' && (
          <div style={{ padding: '16px 0' }}>
            {wishBooks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📌</div>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>마음에 드는 책을 발견하면 담아두세요</p>
                <p style={{ fontSize: 12, margin: '6px 0 0', color: '#C7CCD3' }}>소셜 피드 모이 → 책 상세 → 관심 책 추가</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wishBooks.slice().reverse().map((w, i) => (
                  <div key={i} className="rg-card" style={{ padding: '14px 16px' }}>
                    <p style={{ fontWeight: 900, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px' }}>{w.bookTitle}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <a href={KYOBO_URLS[w.isbn] || `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(w.isbn || w.bookTitle)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, textAlign: 'center', padding: '8px 0',
                          background: '#FFF9F0', border: '1.5px solid #FFE0A0', borderRadius: 10,
                          fontSize: 12, fontWeight: 800, color: '#C8901C', textDecoration: 'none' }}>
                        교보문고에서 보기 →
                      </a>
                      <button
                        onClick={() => onStateChange(prev => ({
                          ...prev,
                          wishBooks: prev.wishBooks.filter((_, idx) => idx !== prev.wishBooks.length - 1 - i),
                        }))}
                        style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5E5E5',
                          background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          color: '#AFAFAF', fontFamily: 'inherit' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 책갈피 탭 ── */}
        {libTab === 'bookmark' && (
          <div style={{ padding: '16px 0' }}>
            {bookmarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔖</div>
                <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>저장한 모이가 없어요</p>
                <p style={{ fontSize: 12, margin: '6px 0 0', color: '#C7CCD3' }}>소셜 피드에서 🔖 탭하면 여기에 모여요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bookmarks.slice().reverse().map(b => (
                  <div key={b.id} className="rg-card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#3FD17F' }}>{b.book}</span>
                      {b.page && <span style={{ fontSize: 12, color: '#AFAFAF', fontWeight: 700 }}>p.{b.page}</span>}
                    </div>
                    <p style={{ fontSize: 13, color: '#4a4a4a', fontStyle: 'italic', lineHeight: 1.6,
                      margin: '0 0 8px', borderLeft: '3px solid #3FD17F', paddingLeft: 10 }}>
                      {b.sentence}
                    </p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', margin: 0 }}>@{b.handle} · {b.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 내 책장 탭 ── */}
        {libTab === 'shelf' && (<>
        {/* 현재 읽는 중 카드 (§5.7) */}
        {activeBook && (
          <div onClick={() => setDetail(activeBook.id)} className="rg-card" style={{
            marginBottom: 12, cursor: 'pointer', borderColor: '#D7F0BF' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#58CC02', margin: '0 0 8px' }}>
              📖 현재 읽는 중
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BookCover book={activeBook.book} size={52} radius={10}/>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px' }}>
                  {activeBook.book.title}
                </p>
                <p style={{ fontSize: 12, color: '#AFAFAF', margin: 0 }}>
                  {activeBook.book.author} · {activeBook.currentPage}/{activeBook.book.total_pages}p
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 검색창 */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <SearchIcon s={16} style={{ position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: '#AFAFAF' }}/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="책 제목, 저자 검색..."
            style={{ width: '100%', border: '2px solid #E5E5E5', borderRadius: 14,
              padding: '11px 14px 11px 36px', fontSize: 14, fontWeight: 600,
              outline: 'none', fontFamily: 'Nunito', background: '#fff', transition: 'border-color .2s' }}
            onFocus={e => e.target.style.borderColor = '#58CC02'}
            onBlur={e => e.target.style.borderColor  = '#E5E5E5'}
          />
        </div>

        {/* 책 목록 */}
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#AFAFAF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>첫 책을 등록해보세요 📚</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {visible.map(ub => {
              const pct = Math.min(100, Math.round((ub.currentPage / ub.book.total_pages) * 100));
              const st  = getNestStage(pct);
              return (
                <button key={ub.id} onClick={() => setDetail(ub.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, background: '#fff',
                  borderRadius: 16, padding: '14px 16px', border: '2px solid #E5E5E5',
                  cursor: 'pointer', textAlign: 'left', width: '100%'
                }}>
                  <BookCover book={ub.book} size={48} radius={10}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: '#1F1F1F', margin: '0 0 2px',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {ub.book.title}
                    </p>
                    <p style={{ fontSize: 11, color: '#AFAFAF', margin: '0 0 6px' }}>
                      {ub.book.author} · {ub.currentPage}/{ub.book.total_pages}p
                      {ub.status === 'completed' && <span style={{ color: '#58CC02', marginLeft: 6 }}>✓ 완독</span>}
                    </p>
                    <div style={{ height: 5, borderRadius: 3, background: '#E5E5E5', overflow: 'hidden' }}>
                      <div style={{ height: 5, borderRadius: 3, width: `${pct}%`, background: st.color }}/>
                    </div>
                  </div>
                  <RightIcon s={18} style={{ color: '#AFAFAF', flexShrink: 0 }}/>
                </button>
              );
            })}
          </div>
        )}

        {/* + 책 추가하기 */}
        <button onClick={onAddBook} className="btn-duo btn-white" style={{ width: '100%' }}>
          + 책 추가하기
        </button>
        </>)}
      </div>
    </div>
  );
};

window.BookDetail    = BookDetail;
window.SettingsView  = SettingsView;
window.LibraryView   = LibraryView;
