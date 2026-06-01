/* =========================================================
   ReadingGo — social.js
   소셜 탭: 친구 한 문장 피드
   ========================================================= */

function SocialView({ state }) {
  // 모든 NPC 인용 모아서 활성 책 우선 정렬
  const allQuotes = React.useMemo(() => {
    const all = [];
    for (const bid of Object.keys(NPC_QUOTES)) {
      for (const it of NPC_QUOTES[bid]) all.push({ bookId: bid, ...it });
    }
    all.sort((a, b) =>
      a.bookId === state.book.id ? -1 : b.bookId === state.book.id ? 1 : b.claps - a.claps
    );
    return all;
  }, [state.book.id]);

  return (
    <section className="view active">
      <div className="section-head">
        <h3>📚 친구들의 한 문장</h3>
      </div>
      <div>
        {allQuotes.map((it, i) => (
          <SentenceCard key={i} item={it} bookId={it.bookId} />
        ))}
      </div>
    </section>
  );
}

window.SocialView = SocialView;
