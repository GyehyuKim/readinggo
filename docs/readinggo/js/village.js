/* =========================================================
   ReadingGo — village.js
   마을 탭: 마을 목록 화면 + [마을 만들기] 버튼
   ========================================================= */

function VillageView({ state, onSelectTown }) {
  const getDday = (dday) => {
    if (dday === 0) return '오늘';
    if (dday > 0) return `D+${dday}`;
    return `D${dday}`;
  };

  const handleCreateTown = () => {
    // 마을 만들기 모달 오픈 (추후 구현)
    showToast('마을 만들기 기능은 준비 중입니다 🏗️');
  };

  return (
    <section className="view active">
      {/* 헤더 */}
      <div style={{textAlign:'center', margin:'16px 0 20px'}}>
        <div style={{fontSize:24, fontWeight:900, letterSpacing:'-.3px'}}>🌳 마을</div>
        <div style={{fontSize:13, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
          함께 책을 읽는 마을들에 참여하세요
        </div>
      </div>

      {/* 마을 만들기 버튼 */}
      <div style={{padding:'0 16px', marginBottom:20}}>
        <button
          onClick={handleCreateTown}
          style={{
            width:'100%',
            padding:'14px 16px',
            border:'2px solid var(--ink-1)',
            borderRadius:'12px',
            backgroundColor:'transparent',
            color:'var(--ink-1)',
            fontWeight:800,
            fontSize:15,
            cursor:'pointer',
            transition:'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor='var(--ink-0)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor='transparent';
          }}
        >
          + 마을 만들기
        </button>
      </div>

      {/* 마을 목록 */}
      <div style={{padding:'0 16px'}}>
        {state.towns && state.towns.length > 0 ? (
          state.towns.map((town) => {
            const book = getBook(town.bookId);
            return (
              <div
                key={town.id}
                className="card"
                onClick={() => onSelectTown(town.id)}
                style={{
                  marginBottom:16,
                  padding:14,
                  cursor:'pointer',
                  transition:'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform='translateY(-2px)';
                  e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform='translateY(0)';
                  e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{display:'flex', gap:12}}>
                  {/* 책 표지 */}
                  <div
                    style={{
                      width:80,
                      height:110,
                      flexShrink:0,
                      borderRadius:6,
                      background:`linear-gradient(135deg, ${book.fb[0]} 0%, ${book.fb[1]} 100%)`,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      fontSize:40,
                      overflow:'hidden',
                      boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
                    }}
                  >
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        style={{
                          width:'100%',
                          height:'100%',
                          objectFit:'cover',
                        }}
                        onError={(e) => {
                          e.target.style.display='none';
                        }}
                      />
                    ) : (
                      '📖'
                    )}
                  </div>

                  {/* 마을 정보 */}
                  <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
                    {/* 마을 이름 */}
                    <div>
                      <div
                        style={{
                          fontSize:15,
                          fontWeight:800,
                          color:'var(--ink-1)',
                          marginBottom:4,
                          lineHeight:1.3,
                        }}
                      >
                        {town.name}
                      </div>
                      <div
                        style={{
                          fontSize:12,
                          color:'var(--ink-2)',
                          fontWeight:600,
                        }}
                      >
                        {book.title}
                      </div>
                    </div>

                    {/* 마을 상태 정보 */}
                    <div
                      style={{
                        display:'flex',
                        alignItems:'center',
                        gap:10,
                        fontSize:13,
                        fontWeight:700,
                        color:'var(--ink-2)',
                      }}
                    >
                      <span>👥 {town.memberCount}명</span>
                      <span>•</span>
                      <span>
                        📖 {town.currentPart}/{town.totalParts}
                      </span>
                      <span>•</span>
                      <span style={{color:'var(--accent)'}}>{getDday(town.dday)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              textAlign:'center',
              padding:'40px 20px',
              color:'var(--ink-2)',
            }}
          >
            <div style={{fontSize:40, marginBottom:12}}>🌳</div>
            <div style={{fontSize:14, fontWeight:600}}>
              아직 참여 중인 마을이 없어요
            </div>
            <div style={{fontSize:13, marginTop:8}}>
              마을을 만들거나 참여해보세요
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

window.VillageView = VillageView;
