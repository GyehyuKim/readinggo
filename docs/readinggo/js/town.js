/* =========================================================
   ReadingGo — town.js
   마을 상세 화면 (멤버 현황 · 마일스톤 · 한 문장 · 파트 랭킹)
   ========================================================= */

function TownDetailView({ state, townId, onBack }) {
  const { useState } = React;
  const town = (state.towns || []).find(t => t.id === townId);

  // poke(콕찌르기) 로컬 상태: 멤버 name → sent 여부
  const [poked, setPoked] = useState({});
  // 스포일러 전역 토글 + 카드별 탭 공개 (§5.7.1)
  const revealAll = React.useContext(SpoilerContext);
  const [revealed, setRevealed] = useState({});

  if (!town) {
    return (
      <section className="view active">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 12px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, fontWeight: 900, color: 'var(--ink-2)', padding: '0 4px', lineHeight: 1 }}
            aria-label="뒤로"
          >
            ‹
          </button>
          <span style={{ fontWeight: 900, fontSize: 17 }}>마을</span>
        </div>
        <div className="empty">
          <span className="ico">🌳</span>
          마을을 찾을 수 없어요.
        </div>
      </section>
    );
  }

  const book = getBook(town.bookId);
  const partPct = town.totalParts ? Math.round((town.currentPart / town.totalParts) * 100) : 0;
  const ddayText = town.dday === 0 ? '오늘 마감' : town.dday > 0 ? `D+${town.dday}` : `D${town.dday}`;

  const members = town.members || [];
  // 파트 랭킹: 마을 책 누적 페이지 내림차순
  const ranking = [...members].sort((a, b) => (b.cumulativePage || 0) - (a.cumulativePage || 0));
  // 오늘의 한 문장: todayRecorded + quote 있는 멤버
  const todayQuotes = members.filter(m => m.todayRecorded && m.quote);

  const handlePoke = (m) => {
    if (m.todayRecorded || poked[m.name]) return;
    setPoked(p => ({ ...p, [m.name]: true }));
    showToast(`@${m.name}에게 🪱 콕찌르기를 보냈어요!`);
  };

  return (
    <section className="view active">
      {/* 상단 바: 뒤로가기 + 마을명 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 12px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, fontWeight: 900, color: 'var(--ink-2)', padding: '0 4px', lineHeight: 1 }}
          aria-label="뒤로"
        >
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {town.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
            {book.title} · 👥 {town.memberCount}명
          </div>
        </div>
      </div>

      {/* 마일스톤 진행 바 */}
      <div className="town-milestone" style={{ marginTop: 0 }}>
        <div className="town-milestone-label">
          <span>📖 파트 {town.currentPart}/{town.totalParts}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--brand-3)' }}>{ddayText}</span>
        </div>
        <div className="book-progress" style={{ marginTop: 4 }}>
          <span style={{ width: partPct + '%' }} />
        </div>
      </div>

      {/* 참여자 둥지 그리드 */}
      <div className="section-head">
        <h3>🌳 마을 주민</h3>
      </div>
      <div className="village-grid">
        {members.map((m) => {
          const isSent = poked[m.name];
          return (
            <div key={m.name} className={'friend-nest' + (m.todayRecorded ? ' on' : '')}>
              {!m.todayRecorded && (
                <span
                  className={'seed' + (isSent ? ' sent' : '')}
                  title="콕찌르기"
                  onClick={() => handlePoke(m)}
                >
                  🪱
                </span>
              )}
              <span className="light" />
              <div className="nestico">{m.nest}</div>
              <div className="nick">@{m.name}</div>
              <div className="streakmini">
                {m.streak > 0 ? `🔥${m.streak}` : '쉼 중'} · p{m.cumulativePage}
              </div>
            </div>
          );
        })}
      </div>

      {/* 오늘의 한 문장 */}
      <div className="section-head">
        <h3>📚 오늘의 한 문장</h3>
      </div>
      {todayQuotes.length > 0 ? (
        todayQuotes.map((m) => {
          const blinded = !revealAll && !revealed[m.name] &&
            isSentenceBlinded(town.bookId, m.cumulativePage);
          return (
            <div key={m.name} className="my-q-card">
              <div className="meta">
                <span>{m.avatar}</span>
                <span className="bk">@{m.name}</span>
                <span className="dot">·</span>
                <span>p{m.cumulativePage}</span>
              </div>
              {blinded ? (
                <div className="spoiler-blind" onClick={() => setRevealed(r => ({ ...r, [m.name]: true }))}>
                  ⚠️ 내가 아직 안 읽은 부분 · 탭하면 보기
                </div>
              ) : (
                <div className="quote">"{m.quote}"</div>
              )}
            </div>
          );
        })
      ) : (
        <div className="my-q-empty">
          <span className="ico">🐦</span>
          아직 오늘 한 문장이 없어요. 먼저 짹 해보세요.
        </div>
      )}

      {/* 파트별 랭킹 */}
      <div className="section-head">
        <h3>🏅 파트 랭킹</h3>
      </div>
      <div className="trank-list">
        {ranking.map((m, i) => {
          const done = m.cumulativePage >= book.total;
          const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
          return (
            <div key={m.name} className={'trank-row' + (m.name === 'jerome' ? ' me' : '')}>
              <span className={'trank-rank' + (rankClass ? ' ' + rankClass : '')}>{done ? '🏆' : i + 1}</span>
              <span className="trank-avatar">{m.avatar}</span>
              <span className="trank-name">@{m.name}</span>
              <span className="trank-page">{m.cumulativePage}p</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

window.TownDetailView = TownDetailView;
