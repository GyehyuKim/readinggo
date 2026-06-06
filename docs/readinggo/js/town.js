/* =========================================================
   ReadingGo — town.js (clean)
   마을 내부: 멤버 / 한 문장 / 게시판 + 설정 시트 (Phase0: 로컬 모의)
   ========================================================= */

/* 상황별 재치 문구 — spec §5.5.4 우선순위 순 */
function _getVillageMottoLine(town, myHandle) {
  const members = town.members || [];
  const total = members.length;
  if (total === 0) return '';

  const dday = town.dday || 0;
  const myMember = members.find(m => String(m.name || '').replace(/^@/, '') === String(myHandle || '').replace(/^@/, ''));
  const myDone = myMember ? !!myMember.todayRecorded : false;
  const doneCount = members.filter(m => m.todayRecorded).length;
  const doneRatio = total > 0 ? doneCount / total : 0;

  // 우선순위 1: D-1 + 내가 미완료
  if (dday >= -1 && dday < 0 && !myDone) return '내일이 마감이에요 😱 오늘 꼭 읽어요!';
  // 우선순위 2: D-3 이내 + 내가 미완료
  if (dday >= -3 && dday < 0 && !myDone) return `마감 D${dday}! 지금 펼치면 딱 좋아요 📚`;
  // 우선순위 3: 내 완료 O
  if (myDone) {
    if (doneCount === total) return '오늘 마을 전체가 짹! 완벽한 하루예요 🌟';
    if (doneRatio > 0.5) return '잘 하고 있어요! 나머지도 곧 따라올 거예요 🐦';
    if (doneCount === 1) return '오늘의 첫 번째 불꽃은 바로 나예요 🔥';
    return '오늘은 내가 선두예요 ✨ 마을 불씨가 됐어요!';
  }
  // 우선순위 3: 내 완료 X
  const avgProgress = total > 0 ? members.reduce((s, m) => s + (m.cumulativePage || 0), 0) / total : 0;
  const bookTotal = 1; // 상대 비교용 — 70% 기준은 완료 인원 비율로 대체
  if (doneRatio > 0.7) return '멤버들이 쌩쌩 달리는 중 💨 뒤처지지 마세요!';
  if (doneRatio > 0.5) return '절반 넘게 읽었는데 나만 아직이에요 😅 얼른요!';
  if (doneCount === 0) return '오늘 마을 전체 정전 🌑 첫 불꽃이 되어볼까요?';
  if (doneRatio < 0.3) return '오늘 마을이 조용해요. 같이 시작해봐요 📖';
  return '오늘도 같이 읽어요 🐦';
}

function TownDetailView({ state, townId, onBack, onTownUpdate }) {
  const { useState, useEffect } = React;
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeSubtab, setActiveSubtab] = useState('members');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [membersList, setMembersList] = useState(() => {
    const t = (state.towns || []).find(x => x.id === townId);
    return (t && t.members) || [];
  });
  const [topics, setTopics] = useState(() => {
    const t = (state.towns || []).find(x => x.id === townId);
    return (t && t._topics) || [];
  });
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState([]);

  const town = (state.towns || []).find(t => t.id === townId);
  const book = town ? resolveBook(town) : null;
  if (!town || !book) return (<section className="view active"><div>마을을 찾을 수 없습니다</div></section>);

  // 마을 멤버 비동기 로드 (Supabase) — React state로 관리하여 부모 리렌더에도 안전
  useEffect(() => {
    const DS = window.DataStore;
    const fallback = () => {
      setMembersList(prev => {
        if (prev.length) return prev;
        const me = window.RG_ME;
        if (!me) return prev;
        return [{ name: me.handle || me.name || '나', nest: '🪺', streak: 0, cumulativePage: 0, todayRecorded: false }];
      });
    };
    if (!DS || !DS.villages || !DS.villages.members) { fallback(); return; }
    Promise.resolve(DS.villages.members(townId)).then(rows => {
      if (!rows || !rows.length) { fallback(); return; }
      setMembersList(rows.map(r => {
        const u = r.user || {};
        return {
          name: u.handle || u.display_name || u.email || '멤버',
          nest: u.nest_emoji || '🪺',
          streak: (u.streak && u.streak.current) || 0,
          cumulativePage: u.cumulativePage || 0,
          todayRecorded: !!u.todayRecorded,
          quote: u.todaySentence ? u.todaySentence.text : '',
          page: u.todaySentence ? u.todaySentence.page : null,
          claps: 0,
        };
      }));
    }).catch(fallback);
  }, [townId]);

  // 게시판 주제 비동기 로드 (Supabase)
  useEffect(() => {
    const DS = window.DataStore;
    if (!DS || !DS.villages || !DS.villages.listTopics) return;
    Promise.resolve(DS.villages.listTopics(townId)).then(rows => {
      if (!rows || !rows.length) return;
      setTopics(rows.map(r => ({
        id: r.id,
        title: r.title,
        desc: r.description || '',
        status: 'open',
        due: r.due_days || 3,
        createdBy: (r.author && (r.author.handle || r.author.display_name)) || '',
        createdAt: r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '방금',
        opinions: (r.opinions || []).map(o => ({
          id: o.id,
          author: (o.author && (o.author.handle || o.author.display_name)) || '',
          text: o.text,
          createdAt: o.created_at ? new Date(o.created_at).toLocaleDateString('ko-KR') : '방금',
        })),
      })));
    }).catch(() => {});
  }, [townId]);

  const myHandle = (window.RG_ME && window.RG_ME.handle) || '';
  const leaderHandle = String(town.leader || '').replace(/^@/, '');
  const isAdmin = (town.myRole === 'admin' || (leaderHandle && leaderHandle === myHandle) || (town.coAdmins || []).includes(myHandle)) && town.collection !== 'past';
  // 모든 노출 닉네임 → 프로필 (#3·7·8·9). @ 접두 정규화 후 RG_openProfile.
  const goProfile = (h) => { const handle = String(h || '').replace(/^@/, ''); if (handle && window.RG_openProfile) window.RG_openProfile(handle); };
  const _norm = (h) => String(h || '').replace(/^@/, '');
  const canEditTopic = (t) => isAdmin || (t.createdBy && _norm(t.createdBy) === myHandle);
  const canEditOpinion = (o) => isAdmin || (o.author && _norm(o.author) === myHandle);
  // 마을 한 문장 좋아요/짹 (#4) — Phase0 in-memory 토글
  const [sentLikes, setSentLikes] = useState({});
  const toggleSentLike = (name) => setSentLikes(s => ({ ...s, [name]: !s[name] }));

  // 콕찌르기 — Phase0 in-memory (KST 자정 리셋은 세션 재시작으로 대체)
  const [pokedToday, setPokedToday] = useState({});
  const handlePoke = (memberName) => {
    if (pokedToday[memberName]) return;
    setPokedToday(prev => ({ ...prev, [memberName]: true }));
    showToast(`@${memberName}에게 🪱 콕 찔렀어요! 오늘도 같이 읽어요 🐦`);
  };

  // 마을 공유 (#8) — 공유 URL + Web Share API, 미지원 시 클립보드 폴백
  const shareVillage = async () => {
    const base = window.location.origin;
    const url = town.inviteCode
      ? `${base}/?village=${town.id}&code=${town.inviteCode}`
      : `${base}/?village=${town.id}`;
    const shareData = { title: `ReadingGo 마을 · ${town.name}`, text: `"${book.title}" 같이 읽어요 — ReadingGo 마을에 초대합니다 🐦`, url };
    try {
      if (navigator.share) { await navigator.share(shareData); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); showToast('초대 링크 복사됨 — 붙여넣어 공유하세요'); }
    catch (e) { showToast('공유 링크: ' + url); }
  };

  // 마을 나가기 (#9) — 실제 탈퇴 후 목록으로
  const leaveVillage = () => {
    if (!window.confirm(`'${town.name}' 마을에서 나갈까요?`)) return;
    const done = () => { showToast('마을에서 나왔어요'); setIsSettingsOpen(false); onBack(); };
    if (window.DataStore && window.DataStore.villages && window.DataStore.villages.leave) {
      Promise.resolve(window.DataStore.villages.leave(town.id)).then(done).catch(() => showToast('나가기 실패 — 잠시 후 다시'));
    } else { done(); }
  };

  // 마을 삭제 (관리자 전용) — ⚠️ 확인 다이얼로그 필수
  const deleteVillage = () => {
    if (!window.confirm(`⚠️ '${town.name}' 마을을 삭제할까요?\n삭제하면 모든 데이터가 사라지고 복구할 수 없습니다.`)) return;
    const done = () => { showToast('마을이 삭제됐어요'); setIsSettingsOpen(false); onBack(); };
    if (window.DataStore && window.DataStore.villages && window.DataStore.villages.delete) {
      Promise.resolve(window.DataStore.villages.delete(town.id)).then(done).catch(() => showToast('삭제 실패 — 잠시 후 다시'));
    } else { done(); }
  };

  // 마을 정보 수정 (관리자 전용) — in-memory
  const openEditInfo = () => {
    setEditName(town.name || '');
    setEditDesc(town.description || '');
    setEditVisibility(town.visibility || 'public');
    setIsEditingInfo(true);
  };

  const saveEditInfo = () => {
    if (!editName.trim()) { showToast('마을 이름을 입력해주세요'); return; }
    const patch = { id: town.id, name: editName.trim(), description: editDesc.trim(), visibility: editVisibility };
    const done = () => {
      // in-place mutation for TownDetailView 즉시 반영 + onTownUpdate로 villageTowns 상태 갱신
      town.name = patch.name;
      town.description = patch.description;
      town.visibility = patch.visibility;
      if (onTownUpdate) onTownUpdate(patch);
      showToast('마을 정보를 수정했어요');
      setIsEditingInfo(false);
    };
    if (window.DataStore && window.DataStore.villages && window.DataStore.villages.update) {
      Promise.resolve(window.DataStore.villages.update(town.id, { name: patch.name, description: patch.description, visibility: patch.visibility })).then(done).catch(() => showToast('수정 실패 — 잠시 후 다시'));
    } else { done(); }
  };

  // Board handlers — optimistic 업데이트 + background Supabase 저장
  const addTopic = (title, desc, days) => {
    if (!title || title.trim().length===0) { showToast('주제는 필수입니다'); return; }
    const localId = 't' + Math.random().toString(36).slice(2,8);
    setTopics(prev => [{ id: localId, title: title.slice(0,100), desc: desc ? desc.slice(0,200):'', status:'open', due: days, createdBy: myHandle, createdAt: '방금', opinions: [] }, ...prev]);
    showToast('주제가 등록되었습니다');
    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.addTopic) {
      Promise.resolve(DS.villages.addTopic(townId, { title: title.slice(0,100), description: desc ? desc.slice(0,200) : null, dueDays: days }))
        .then(row => { if (row && row.id) setTopics(prev => prev.map(x => x.id===localId ? {...x, id: row.id} : x)); })
        .catch(() => {});
    }
  };
  const updateTopic = (id, title, desc, days) => {
    const t = topics.find(x=>x.id===id); if(!t) return;
    if (!canEditTopic(t)) { showToast('내가 등록한 주제만 수정할 수 있어요'); return; }
    setTopics(prev => prev.map(x => x.id===id ? {...x, title: title.slice(0,100), desc: desc ? desc.slice(0,200):'', due: days} : x));
    showToast('주제를 수정했습니다');
    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.updateTopic) {
      Promise.resolve(DS.villages.updateTopic(id, { title: title.slice(0,100), description: desc ? desc.slice(0,200) : null, dueDays: days })).catch(() => {});
    }
  };
  const addOpinion = (topicId, text, author) => {
    if (!text || text.trim().length===0) { showToast('의견을 입력하세요'); return; }
    const localId = 'o'+Math.random().toString(36).slice(2,8);
    const newOp = { id: localId, author: author||myHandle, text: text.slice(0,300), createdAt: '방금' };
    setTopics(prev => prev.map(t => t.id===topicId ? {...t, opinions: [...(t.opinions||[]), newOp]} : t));
    showToast('의견이 등록되었습니다');
    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.addOpinion) {
      Promise.resolve(DS.villages.addOpinion(topicId, text.slice(0,300)))
        .then(row => { if (row && row.id) setTopics(prev => prev.map(t => t.id===topicId ? {...t, opinions: t.opinions.map(o => o.id===localId ? {...o, id: row.id} : o)} : t)); })
        .catch(() => {});
    }
  };
  const deleteTopic = (topicId) => {
    const t = topics.find(x=>x.id===topicId);
    if (t && !canEditTopic(t)) { showToast('내가 등록한 주제만 삭제할 수 있어요'); return; }
    setTopics(prev => prev.filter(x=>x.id!==topicId));
    showToast('주제를 삭제했습니다');
    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.deleteTopic) {
      Promise.resolve(DS.villages.deleteTopic(topicId)).catch(() => {});
    }
  };
  const deleteOpinion = (topicId, opinionId) => {
    const t = topics.find(x=>x.id===topicId); if(!t) return;
    const o = t.opinions.find(x=>x.id===opinionId);
    if (o && !canEditOpinion(o)) { showToast('내가 쓴 의견만 삭제할 수 있어요'); return; }
    setTopics(prev => prev.map(x => x.id===topicId ? {...x, opinions: x.opinions.filter(op=>op.id!==opinionId)} : x));
    showToast('의견이 삭제되었습니다');
    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.deleteOpinion) {
      Promise.resolve(DS.villages.deleteOpinion(opinionId)).catch(() => {});
    }
  };

  // 유저 검색 초대 (관리자 전용)
  const handleInviteSearch = () => {
    if (!inviteQuery.trim()) return;
    const DS = window.DataStore;
    if (DS && DS.users && DS.users.search) {
      Promise.resolve(DS.users.search(inviteQuery.trim())).then(rows => {
        setInviteResults(rows || []);
        if (!rows || !rows.length) showToast('검색 결과가 없어요');
      }).catch(() => showToast('검색 실패'));
    }
  };

  // Topic editor control (parent-controlled)
  const [topicEditorOpen, setTopicEditorOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState(null);
  const [editingTopicId, setEditingTopicId] = useState(null);

  const openNewTopic = () => { setEditingTopicId(null); setTopicDraft({title:'',desc:'',due:3}); setTopicEditorOpen(true); };
  const openEditTopic = (topic) => { setEditingTopicId(topic.id); setTopicDraft({title:topic.title,desc:topic.desc,due:topic.due}); setTopicEditorOpen(true); };

  return (
    <section className="view active" style={{animation: 'fadeIn .2s ease both'}}>
      <div style={{padding:'12px 16px', borderBottom:'1.5px solid var(--line)', display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
        <button onClick={onBack} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',padding:4}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800}}>{town.name}</div>
          <div style={{fontSize:12,color:'var(--ink-2)',fontWeight:600,marginTop:2}}>{book.title}</div>
        </div>
        <button onClick={()=>setIsSettingsOpen(true)} style={{background:'transparent',border:'none',fontSize:18,cursor:'pointer'}}>⚙️</button>
      </div>

      {/* 헤더 2줄: 파트·D-day·진행바 / 오늘 완료 인원·재치문구 (spec §5.5.4) */}
      {(() => {
        const totalParts = Math.max(town.totalParts || 1, 1);
        const partProgress = Math.min(100, Math.max(0, ((town.currentPart - 1) / totalParts) * 100));
        const members = membersList;
        const todayDone = members.filter(m => m.todayRecorded).length;
        const totalMembers = members.length;
        const dday = town.dday || 0;
        const ddayLabel = dday === 0 ? '오늘 마감' : dday < 0 ? `D${dday}` : `D+${dday}`;
        const motto = _getVillageMottoLine({ ...town, members: membersList }, myHandle);
        return (
          <div style={{padding:'12px 16px 8px', borderBottom:'1px solid var(--line)', marginBottom:4}}>
            {/* 1줄: 파트 · 챕터범위 · D-day + 진행 바 */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
              <div style={{fontSize:13, fontWeight:800, color:'var(--ink-1)'}}>
                {town.currentPart}/{totalParts} 파트 {town.currentRange ? `· ${town.currentRange}` : ''}
              </div>
              <div style={{fontSize:12, fontWeight:800, color:'var(--accent)'}}>{ddayLabel}</div>
            </div>
            <div style={{height:8, borderRadius:999, background:'var(--line-2)', overflow:'hidden', marginBottom:8}}>
              <div style={{width:`${partProgress}%`, height:'100%', borderRadius:999, background:'linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%)'}} />
            </div>
            {/* 2줄: 오늘 완료 인원 · 재치문구 */}
            <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <span style={{fontSize:12, fontWeight:800, color:'var(--ink-2)'}}>오늘 {todayDone}/{totalMembers} 완료</span>
              {motto && <span style={{fontSize:12, color:'var(--ink-3)', fontWeight:600}}>· {motto}</span>}
            </div>
          </div>
        );
      })()}

      <div style={{padding:'0 16px',position:'sticky',top:0,zIndex:20,background:'var(--paper)',borderBottom:'1px solid var(--line)',marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,paddingBottom:10}}>
          {['members','sentence','board'].map(id=> (
            <button key={id} onClick={()=>setActiveSubtab(id)} style={{padding:'10px 8px',border:'1.5px solid '+(activeSubtab===id?'var(--brand)':'var(--line)'),borderRadius:12,background:activeSubtab===id?'var(--brand-tint)':'var(--card)',fontWeight:900,fontSize:13,color:activeSubtab===id?'var(--brand-3)':'var(--ink-2)'}}>{id==='members'?'👥 멤버':id==='sentence'?'📖 한 문장':'💬 게시판'}</button>
          ))}
        </div>
      </div>

      {activeSubtab==='members' && (() => {
        const totalPages = book.total || 1;
        const isPrivate = town.visibility === 'private';

        // 진척률 계산: 읽은 페이지 / 책 전체 페이지 × 100
        const getProgress = (m) => Math.min(100, ((m.cumulativePage || 0) / totalPages) * 100);

        // 랭킹: 전체 책 진척률 내림차순 → 동점 시 스트릭 높은 순.
        const regularMembers = membersList
          .slice()
          .sort((a, b) => {
            const diff = getProgress(b) - getProgress(a);
            return diff !== 0 ? diff : (b.streak || 0) - (a.streak || 0);
          })
          .map((m, i) => ({ ...m, rank: i + 1 }));

        // 15명 이하: 전원 3열 그리드. 16명 이상: 상위 15위 그리드 + 나머지 한 줄 목록
        const gridMembers = regularMembers.slice(0, 15);
        const listMembers = regularMembers.slice(15);

        return (
          <div style={{padding:'0 16px 40px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)',marginBottom:12}}>
              👥 참여자 ({regularMembers.length}명)
            </div>

            {/* 3열 랭킹 그리드 — align-items:stretch 로 같은 row 높이 균일 */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,alignItems:'start'}}>
              {gridMembers.map(m => {
                const progress = getProgress(m);
                const isLit = !!m.todayRecorded;
                const isSelf = _norm(m.name) === _norm(myHandle);
                const canPoke = isPrivate && !isLit && !isSelf;
                const hasPoked = !!pokedToday[m.name];

                return (
                  <div key={m.name} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    {/* 순위 번호 (카드 외부 상단) */}
                    <div style={{fontSize:13,fontWeight:900,color:'var(--ink-2)',alignSelf:'center'}}>
                      {m.rank <= 3 ? ['🥇','🥈','🥉'][m.rank - 1] : `${m.rank}위`}
                    </div>

                    {/* 멤버 카드 — position:relative 로 불빛 우측상단 절대배치 */}
                    <div
                      style={{
                        position:'relative',
                        width:'100%',
                        borderRadius:14,
                        border:'1.5px solid ' + (isLit ? 'var(--brand)' : 'var(--line)'),
                        background: isLit ? 'var(--brand-tint)' : 'var(--card)',
                        boxShadow: isLit ? '0 0 14px rgba(34,122,83,0.22)' : 'none',
                        transition:'box-shadow 0.15s ease',
                        padding:'10px 6px 10px',
                        boxSizing:'border-box',
                        display:'flex',
                        flexDirection:'column',
                        alignItems:'center',
                        minHeight:100,
                      }}
                    >
                      {/* 불빛 — 우측 상단 코너 절대배치 */}
                      <span style={{
                        position:'absolute',
                        top:6,
                        right:7,
                        fontSize:9,
                        color: isLit ? '#F5A623' : 'var(--ink-3)',
                        lineHeight:1,
                      }}>
                        {isLit ? '●' : '○'}
                      </span>

                      {/* 카드 본체: 프로필 이동 영역 */}
                      <button
                        onClick={() => goProfile(m.name)}
                        style={{
                          width:'100%',
                          background:'transparent',
                          border:'none',
                          cursor:'pointer',
                          textAlign:'center',
                          padding:0,
                          flex:1,
                        }}
                      >
                        {/* 둥지 이모지 */}
                        <div style={{fontSize:26,lineHeight:1,marginBottom:4}}>{m.nest}</div>
                        {/* 닉네임 */}
                        <div style={{fontSize:11,fontWeight:800,color:'var(--ink-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'0 2px'}}>
                          {m.name}
                        </div>
                        {/* 진도 XX% */}
                        <div style={{fontSize:12,fontWeight:900,color:'var(--brand-3)',marginTop:4}}>
                          진도 {Math.round(progress)}%
                        </div>
                      </button>

                      {/* 콕찌르기 — 카드 내부 하단. 비공개 마을 + 불 꺼진 멤버 전용 */}
                      {canPoke && (
                        <button
                          onClick={() => handlePoke(m.name)}
                          disabled={hasPoked}
                          style={{
                            marginTop:6,
                            width:'100%',
                            padding:'4px 0',
                            border:'1.5px solid ' + (hasPoked ? 'var(--line-2)' : 'var(--line)'),
                            borderRadius:20,
                            background: hasPoked ? 'var(--line-2)' : 'var(--paper)',
                            color: hasPoked ? 'var(--ink-3)' : 'var(--ink-2)',
                            fontWeight:700,
                            fontSize:10,
                            cursor: hasPoked ? 'default' : 'pointer',
                            whiteSpace:'nowrap',
                          }}
                        >
                          {hasPoked ? '✓ 콕 찔렀어요' : '🪱 콕찌르기'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 16위+ 한 줄 목록 */}
            {listMembers.length > 0 && (
              <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
                {listMembers.map(m => {
                  const progress = getProgress(m);
                  const isLit = !!m.todayRecorded;
                  const isSelf = _norm(m.name) === _norm(myHandle);
                  const canPoke = isPrivate && !isLit && !isSelf;
                  const hasPoked = !!pokedToday[m.name];
                  return (
                    <div key={m.name} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,background:'var(--card)',border:'1px solid var(--line-2)'}}>
                      <span style={{fontSize:12,fontWeight:900,color:'var(--ink-2)',minWidth:28}}>{m.rank}위</span>
                      <span style={{fontSize:20}}>{m.nest}</span>
                      <span style={{fontSize:10,color: isLit ? '#F5A623' : 'var(--ink-3)'}}>{isLit ? '●' : '○'}</span>
                      <button onClick={()=>goProfile(m.name)} style={{flex:1,background:'none',border:'none',textAlign:'left',fontSize:13,fontWeight:700,color:'var(--brand-3)',cursor:'pointer'}}>
                        {m.name}
                      </button>
                      <span style={{fontSize:13,fontWeight:900,color:'var(--brand-3)'}}>진도 {Math.round(progress)}%</span>
                      {canPoke && (
                        <button
                          onClick={() => handlePoke(m.name)}
                          disabled={hasPoked}
                          style={{padding:'4px 10px',border:'1.5px solid '+(hasPoked?'var(--line-2)':'var(--line)'),borderRadius:20,background:hasPoked?'var(--line-2)':'var(--paper)',color:hasPoked?'var(--ink-3)':'var(--ink-2)',fontWeight:700,fontSize:10,cursor:hasPoked?'default':'pointer',whiteSpace:'nowrap'}}
                        >
                          {hasPoked ? '✓ 콕 찔렀어요' : '🪱 콕찌르기'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        );
      })()}

      {activeSubtab==='sentence' && (() => {
        const allMembers = membersList;
        const todayQuotes = allMembers.filter(m => m.quote && m.todayRecorded);
        const yesterdayQuotes = allMembers.filter(m => m.quote && !m.todayRecorded);
        const todayCount = todayQuotes.length;
        const totalCount = allMembers.length;

        const QuoteCard = ({ m }) => {
          const liked = !!sentLikes[m.name];
          return (
            <div style={{padding:14, borderRadius:14, background:'var(--card)', border:'1.5px solid var(--line)'}}>
              <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>
                <button onClick={() => goProfile(m.name)} style={{background:'none', border:'none', padding:0, color:'var(--brand-3)', fontWeight:800, fontSize:12, cursor:'pointer'}}>@{m.name}</button>
                {m.page ? ` · p.${m.page}` : ''}
              </div>
              <div style={{fontSize:14, fontWeight:700, lineHeight:1.5, marginBottom:8}}>{m.quote}</div>
              <button onClick={() => toggleSentLike(m.name)} style={{background:liked?'var(--brand-tint)':'transparent', border:'1.5px solid '+(liked?'var(--brand)':'var(--line)'), borderRadius:16, padding:'5px 12px', fontSize:13, fontWeight:800, color:liked?'var(--brand-3)':'var(--ink-3)', cursor:'pointer'}}>
                🐦 짹 {liked ? (m.claps||0)+1 : (m.claps||0) || ''}
              </button>
            </div>
          );
        };

        return (
          <div style={{padding:'0 16px 40px'}}>
            {/* 오늘 기록 카운터 */}
            <div style={{fontSize:13, fontWeight:800, color:'var(--ink-2)', marginBottom:12}}>
              오늘 {todayCount}/{totalCount}명 기록
            </div>
            {/* 오늘 기록 */}
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              {todayQuotes.length > 0
                ? todayQuotes.map(m => <QuoteCard key={m.name} m={m} />)
                : <div style={{padding:'18px 14px', borderRadius:14, border:'1px dashed var(--line-2)', color:'var(--ink-2)', fontSize:13, fontWeight:700}}>오늘 기록한 멤버가 없어요</div>
              }
            </div>
            {/* 어제 기록 — 접히는 섹션 */}
            {yesterdayQuotes.length > 0 && (
              <YesterdaySentenceSection quotes={yesterdayQuotes} QuoteCard={QuoteCard} />
            )}
          </div>
        );
      })()}

      {activeSubtab==='board' && (
        <div style={{padding:'0 16px 80px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)'}}>💬 게시판</div>
            {isAdmin && (<button onClick={openNewTopic} style={{background:'var(--brand)',color:'white',padding:'8px 10px',borderRadius:10,border:'none',fontWeight:800}}>+ 주제 등록</button>)}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {topics.length === 0 && (
              <div style={{padding:'24px 16px', borderRadius:12, border:'1px dashed var(--line-2)', color:'var(--ink-2)', fontSize:13, fontWeight:700, textAlign:'center'}}>
                아직 주제가 없어요<br/>{isAdmin ? '+ 주제 등록으로 첫 토론을 시작해보세요 🐦' : '관리자가 주제를 등록하면 여기에 나타나요'}
              </div>
            )}
            {topics.map(topic=> (
              <div key={topic.id} style={{padding:12,borderRadius:12,background:'var(--card)',border:'1.5px solid var(--line)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:900}}>{topic.title}</div>
                    {topic.desc && <div style={{fontSize:12,color:'var(--ink-3)'}}>{topic.desc}</div>}
                    <div style={{fontSize:11,color:'var(--ink-3)',fontWeight:700,marginTop:3}}>
                      <button onClick={()=>goProfile(topic.createdBy)} style={{background:'none',border:'none',padding:0,color:'var(--brand-3)',fontWeight:800,fontSize:11,cursor:'pointer'}}>@{_norm(topic.createdBy)}</button>
                      {topic.createdAt ? ' · ' + topic.createdAt : ''} · 🗓 {topic.due}일 토론 · 의견 {topic.opinions.length}
                    </div>
                  </div>
                  {canEditTopic(topic) && (<div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                    <button onClick={()=>openEditTopic(topic)} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:12,color:'var(--ink-2)',fontWeight:700}}>수정</button>
                    <button onClick={()=>deleteTopic(topic.id)} style={{background:'transparent',border:'none',color:'#E5484D',cursor:'pointer',fontSize:12,fontWeight:700}}>삭제</button>
                  </div>)}
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {topic.opinions.map(op=> (
                    <div key={op.id} style={{padding:8,borderRadius:8,background:'white',border:'1px solid var(--line-2)'}}><button onClick={()=>goProfile(op.author)} style={{background:'none',border:'none',padding:0,fontSize:12,fontWeight:700,color:'var(--brand-3)',cursor:'pointer'}}>@{_norm(op.author)}</button><div style={{fontSize:13}}>{op.text}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>{op.createdAt} {canEditOpinion(op) && (<button onClick={()=>deleteOpinion(topic.id,op.id)} style={{background:'transparent',border:'none',color:'var(--ink-3)',cursor:'pointer'}}>삭제</button>)}</div></div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <input placeholder="의견 쓰기..." style={{flex:1,padding:8,borderRadius:8,border:'1px solid var(--line)'}} id={`op_input_${topic.id}`} />
                    <button onClick={()=>{ const el=document.getElementById(`op_input_${topic.id}`); if(el) { addOpinion(topic.id, el.value, myHandle); el.value=''; } }} style={{padding:'8px 10px',borderRadius:8,background:'var(--brand)',color:'white',border:'none'}}>등록</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Topic editor sheet (controlled) */}
          <TopicEditor open={topicEditorOpen} editing={!!editingTopicId} onClose={()=>setTopicEditorOpen(false)} initial={topicDraft} onSave={(title,desc,due)=>{ if(editingTopicId) updateTopic(editingTopicId,title,desc,due); else addTopic(title,desc,due); setTopicEditorOpen(false); }} />
        </div>
      )}

      {/* Settings sheet */}
      {isSettingsOpen && (
        <div className="modal-backdrop show" onClick={()=>setIsSettingsOpen(false)}>
          <div className="sheet" role="dialog" aria-label="설정" onClick={(e)=>e.stopPropagation()}>
            <div className="sheet-grip" />
            <div style={{padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <button onClick={()=>setIsSettingsOpen(false)} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',padding:4}}>←</button>
                <div style={{fontSize:16,fontWeight:900}}>설정</div>
                <div style={{width:32}} />
              </div>
              <div style={{display:'grid',gap:10}}>
                <div style={{padding:10,background:'var(--card)',borderRadius:10}}>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>
                    마을 초대 {town.visibility === 'private' ? '🔒 비공개' : '🌐 공개'}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                    <span style={{fontSize:12, color:'var(--ink-3)'}}>초대 코드</span>
                    <strong style={{letterSpacing:2, fontFamily:'monospace'}}>
                      {town.inviteCode || (town.visibility === 'private' ? '(미생성)' : '(없음)')}
                    </strong>
                    <button onClick={shareVillage} style={{marginLeft:'auto', padding:'6px 14px', borderRadius:16, border:'none', background:'var(--brand)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer'}}>📤 공유하기</button>
                  </div>
                </div>
                <div style={{padding:10,background:'var(--card)',borderRadius:10}}>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>알림 설정</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                    {town.visibility === 'private' && (
                      <label style={{fontSize:12, display:'flex', alignItems:'center', gap:5, color:'var(--ink-2)', fontWeight:700}}>
                        <input type="checkbox" defaultChecked={!town.notificationPrefs || town.notificationPrefs.poke !== false}/> 🪱 콕찌르기
                      </label>
                    )}
                    <label style={{fontSize:12, display:'flex', alignItems:'center', gap:5, color:'var(--ink-2)', fontWeight:700}}>
                      <input type="checkbox" defaultChecked={!town.notificationPrefs || town.notificationPrefs.board !== false}/> 💬 게시판 새 주제
                    </label>
                    <label style={{fontSize:12, display:'flex', alignItems:'center', gap:5, color:'var(--ink-2)', fontWeight:700}}>
                      <input type="checkbox" defaultChecked={!town.notificationPrefs || town.notificationPrefs.deadline !== false}/> 🗓 파트 마감 D-3·D-1
                    </label>
                    <label style={{fontSize:12, display:'flex', alignItems:'center', gap:5, color:'var(--ink-2)', fontWeight:700}}>
                      <input type="checkbox" defaultChecked={!town.notificationPrefs || town.notificationPrefs.complete !== false}/> 🎉 멤버 완독
                    </label>
                  </div>
                </div>

                {/* 관리자 전용 섹션 */}
                {town.myRole === 'admin' && (
                  <div style={{padding:10, background:'var(--card)', borderRadius:10, border:'1px solid var(--brand-tint)'}}>
                    <div style={{fontSize:12, fontWeight:800, color:'var(--brand-3)', marginBottom:8}}>👑 관리자</div>
                    {!isEditingInfo ? (
                      <button
                        onClick={openEditInfo}
                        style={{padding:'8px 0', width:'100%', background:'none', border:'none', color:'var(--ink-1)', fontWeight:800, fontSize:13, cursor:'pointer', textAlign:'left'}}
                      >
                        ✏️ 마을 정보 수정
                      </button>
                    ) : (
                      <div style={{display:'flex', flexDirection:'column', gap:8}}>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="마을 이름"
                          style={{padding:'8px 10px', borderRadius:8, border:'1.5px solid var(--brand)', background:'var(--paper)', fontSize:13, fontWeight:700, boxSizing:'border-box'}}
                        />
                        <textarea
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          placeholder="소개 (선택)"
                          rows={2}
                          style={{padding:'8px 10px', borderRadius:8, border:'1.5px solid var(--line)', background:'var(--paper)', fontSize:13, fontWeight:600, boxSizing:'border-box', resize:'none'}}
                        />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
                          {['public', 'private'].map(v => (
                            <button
                              key={v}
                              onClick={() => setEditVisibility(v)}
                              style={{padding:'7px 10px', border:'1.5px solid '+(editVisibility===v?'var(--brand)':'var(--line)'), background:editVisibility===v?'var(--brand-tint)':'var(--card)', borderRadius:8, fontWeight:800, fontSize:12, cursor:'pointer'}}
                            >
                              {v === 'public' ? '공개' : '비공개'}
                            </button>
                          ))}
                        </div>
                        <div style={{display:'flex', gap:8}}>
                          <button onClick={() => setIsEditingInfo(false)} style={{flex:1, padding:'8px 0', border:'1.5px solid var(--line)', borderRadius:8, background:'var(--card)', fontWeight:800, fontSize:13, cursor:'pointer'}}>취소</button>
                          <button onClick={saveEditInfo} style={{flex:1, padding:'8px 0', border:'none', borderRadius:8, background:'var(--brand)', color:'white', fontWeight:800, fontSize:13, cursor:'pointer'}}>저장</button>
                        </div>
                      </div>
                    )}
                    <div style={{height:'1px', background:'var(--line)', margin:'8px 0'}} />
                    {/* 유저 검색 초대 */}
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>👤 유저 초대</div>
                      <div style={{display:'flex', gap:6}}>
                        <input
                          value={inviteQuery}
                          onChange={e => setInviteQuery(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') handleInviteSearch(); }}
                          placeholder="핸들 검색..."
                          style={{flex:1, padding:'6px 8px', borderRadius:8, border:'1.5px solid var(--line)', fontSize:12, background:'var(--paper)', boxSizing:'border-box'}}
                        />
                        <button onClick={handleInviteSearch} style={{padding:'6px 10px', borderRadius:8, background:'var(--brand-tint)', border:'1.5px solid var(--brand)', color:'var(--brand-3)', fontWeight:800, fontSize:12, cursor:'pointer', whiteSpace:'nowrap'}}>검색</button>
                      </div>
                      {inviteResults.length > 0 && (
                        <div style={{marginTop:6, display:'flex', flexDirection:'column', gap:4}}>
                          {inviteResults.map(u => (
                            <div key={u.id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, background:'var(--paper)', border:'1px solid var(--line-2)'}}>
                              <span style={{flex:1, fontSize:12, fontWeight:700, color:'var(--ink-1)'}}>@{u.handle || u.display_name}</span>
                              <button
                                onClick={() => {
                                  const newMember = {
                                    name: u.handle || u.display_name || u.email || '멤버',
                                    nest: u.nest_emoji || '🪺',
                                    streak: 0,
                                    cumulativePage: 0,
                                    todayRecorded: false,
                                    quote: '',
                                  };
                                  setMembersList(prev => {
                                    if (prev.some(m => m.name === newMember.name)) return prev;
                                    return [...prev, newMember];
                                  });
                                  showToast(`@${u.handle || u.display_name} 초대 완료!`);
                                  setInviteResults([]);
                                  setInviteQuery('');
                                  const DS = window.DataStore;
                                  if (DS && DS.villages && DS.villages.invite) {
                                    Promise.resolve(DS.villages.invite(townId, u.id))
                                      .catch(() => {});
                                  }
                                }}
                                style={{padding:'4px 10px', borderRadius:16, background:'var(--brand)', color:'white', border:'none', fontWeight:800, fontSize:11, cursor:'pointer'}}
                              >
                                초대
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{height:'1px', background:'var(--line)', margin:'8px 0'}} />
                    <button
                      onClick={deleteVillage}
                      style={{padding:'8px 0', width:'100%', background:'none', border:'none', color:'#E5484D', fontWeight:800, fontSize:13, cursor:'pointer', textAlign:'left'}}
                    >
                      🗑️ 마을 삭제
                    </button>
                  </div>
                )}

                <div style={{padding:10,background:'var(--card)',borderRadius:10}}>
                  <button onClick={leaveVillage} style={{padding:'8px 0', width:'100%', background:'none', border:'none', color:'#E5484D', fontWeight:800, fontSize:14, cursor:'pointer'}}>🚪 마을 나가기</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

function YesterdaySentenceSection({ quotes, QuoteCard }) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div style={{marginTop:16}}>
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', background:'transparent', border:'none', cursor:'pointer', fontSize:13, fontWeight:800, color:'var(--ink-2)'}}
      >
        어제 기록 보기
        <span style={{fontSize:12, transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s ease'}}>▾</span>
      </button>
      {isOpen && (
        <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
          {quotes.map(m => <QuoteCard key={m.name} m={m} />)}
        </div>
      )}
    </div>
  );
}

function TopicEditor({ open, editing, onClose, initial, onSave }) {
  const [title, setTitle] = React.useState(initial ? initial.title : '');
  const [desc, setDesc] = React.useState(initial ? initial.desc : '');
  const [due, setDue] = React.useState(initial ? initial.due : 3);

  React.useEffect(() => {
    if (initial) {
      setTitle(initial.title || '');
      setDesc(initial.desc || '');
      setDue(initial.due || 3);
    }
  }, [initial]);

  if (!open) return null;

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="주제 등록" onClick={e=>e.stopPropagation()}>
        <div className="sheet-grip" />
        <div style={{padding:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontSize:15,fontWeight:900}}>{editing ? '주제 수정' : '주제 등록'}</div>
            <button onClick={onClose} style={{background:'transparent',border:'none'}}>✕</button>
          </div>
          <input placeholder="주제 (최대 100자)" value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%',padding:8,borderRadius:8,border:'1px solid var(--line)',marginBottom:8}} />
          <textarea placeholder="설명 (선택, 최대 200자)" value={desc} onChange={e=>setDesc(e.target.value)} style={{width:'100%',padding:8,borderRadius:8,border:'1px solid var(--line)',marginBottom:8}} />
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label style={{fontSize:13,color:'var(--ink-2)',fontWeight:700}}>토론 마감</label>
            <select value={due} onChange={e=>setDue(Number(e.target.value))}><option value={1}>1일</option><option value={3}>3일</option><option value={5}>5일</option><option value={7}>7일</option></select>
            <button onClick={()=>{ if(onSave) onSave(title,desc,due); }} style={{marginLeft:'auto',background:'var(--brand)',color:'white',padding:8,borderRadius:8,border:'none',fontWeight:800,cursor:'pointer'}}>{editing ? '수정' : '등록'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.TownDetailView = TownDetailView;
