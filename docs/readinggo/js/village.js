/* =========================================================
   ReadingGo — village.js
   마을 탭: 목록 / 찾기 / 추천 / 지난 마을
   ========================================================= */

/* town._bookData 폴백을 포함한 book 해석 (UUID bookId일 때 Supabase 메타 사용) */
function resolveBook(town) {
  if (town && town._bookData) {
    return {
      title: town._bookData.title || '',
      cover: town._bookData.cover || '',
      author: town._bookData.author || '',
      fb: ['#9AA7B2', '#C7D0D8'],
    };
  }
  return getBook(town ? town.bookId : '');
}

/* Supabase village row → VillageView 내부 town 형태 변환 */
function _villageRowToTown(v, collection, myUserId) {
  const parts = Array.isArray(v.parts) ? v.parts : [];
  const totalParts = parts.length || 1;
  const isMyVillage = myUserId && v.created_by === myUserId;
  // book_id 는 Supabase UUID — ISBN 경유로 로컬 TSV ID 매핑
  // 미매핑 시 UUID 유지하되 _bookData에 Supabase 메타 보존 (TownCard 폴백용)
  let bookId = v.book_id || '';
  let _bookData = null;
  if (v.book && v.book.isbn13) {
    const found = (window.ALL_BOOKS || []).find(b => b.isbn === v.book.isbn13);
    if (found) {
      bookId = found.book_id;
    } else {
      _bookData = { title: v.book.title || '', cover: v.book.cover_url || '', author: v.book.author || '' };
    }
  }
  const _todayStr = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
  // 만료된 파트 수로 currentPart 계산 (마감일이 오늘 이전인 파트 = 완료된 파트)
  const _expiredCount = parts.filter(p => p.due_date && new Date(p.due_date + 'T00:00:00') < new Date(_todayStr + 'T00:00:00')).length;
  const currentPart = Math.min(_expiredCount + 1, totalParts);
  // currentPart 기준 마감일로 dday 계산
  const _currentPartDue = parts[currentPart - 1] && parts[currentPart - 1].due_date;
  const dday = _currentPartDue
    ? Math.round((new Date(_currentPartDue + 'T00:00:00') - new Date(_todayStr + 'T00:00:00')) / 86400000)
    : 0;
  // 마지막 파트 마감일이 오늘 이전이면 자동 완료(지난 마을) 처리 — active 마을만 대상
  const _lastPart = parts[parts.length - 1];
  const _isExpired = _lastPart && _lastPart.due_date
    && new Date(_lastPart.due_date + 'T00:00:00') < new Date(_todayStr + 'T00:00:00');
  const autoCollection = (collection === 'active' && _isExpired) ? 'past' : (collection || 'active');
  return {
    id: v.id,
    bookId,
    _bookData,
    name: v.name || '',
    description: v.description || '',
    collection: autoCollection,
    visibility: v.visibility || 'public',
    inviteCode: v.invite_code || null,
    capacity: v.capacity || null,
    myRole: isMyVillage ? 'admin' : 'member',
    coAdmins: [],
    memberCount: (Array.isArray(v.village_members) && v.village_members[0] ? (v.village_members[0].count || 0) : 0) || v.member_count || (isMyVillage ? 1 : 0),
    currentPart,
    totalParts,
    dday,
    isOpen: true,
    leader: '',
    currentRange: parts[currentPart - 1] ? (parts[currentPart - 1].title || `파트 ${currentPart}`) : '',
    status: _isExpired ? 'completed' : (v.status || 'active'),
    milestones: parts.map(p => ({ part: p.part_order, dueDate: p.due_date || null, completed: false })),
    members: [],
  };
}

function VillageView({ state, onSelectTown, onTownsChange }) {
  const { useMemo, useState, useEffect } = React;
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [finderTab, setFinderTab] = useState('code');
  const [inviteCode, setInviteCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTown, setPreviewTown] = useState(null);
  const [finderError, setFinderError] = useState('');
  const [isPastOpen, setIsPastOpen] = useState(false);
  const [createBookQuery, setCreateBookQuery] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createVisibility, setCreateVisibility] = useState('public');
  const [createCapacity, setCreateCapacity] = useState('');
  const [createPartCount, setCreatePartCount] = useState('3');
  const [createPartDueDates, setCreatePartDueDates] = useState(['', '', '']);
  const [createBookId, setCreateBookId] = useState((state.book && state.book.id) || 'b001');
  const [createError, setCreateError] = useState('');

  // Supabase 연동: 내 마을 + 공개 마을을 비동기 로드. 실패 시 데모 데이터 유지.
  const [towns, setTowns] = useState(state.towns || []);
  const [myVillageIds, setMyVillageIds] = useState([]);

  useEffect(() => {
    const DS = window.DataStore;
    if (!DS || !DS.villages || !DS.villages.listMine) return;
    let alive = true;

    Promise.all([
      Promise.resolve(DS.villages.listMine()).catch(() => null),
      Promise.resolve(DS.villages.listPublic && DS.villages.listPublic({ limit: 30 })).catch(() => null),
    ]).then(([mine, pub]) => {
      if (!alive) return;

      // mine: active collection (내가 속한 마을)
      // RG_ME.id = 로그인한 현재 유저 UUID — v.created_by 비교로 admin 판정
      const meId = window.RG_ME && window.RG_ME.id;
      const mineIds = [];
      const mineTowns = [];
      (mine || []).forEach(v => {
        if (!v) return;
        mineIds.push(v.id);
        mineTowns.push(_villageRowToTown(v, 'active', meId));
      });

      // pub: recommended collection, 내 마을 제외 (#170)
      const pubTowns = (pub || [])
        .filter(v => v && !mineIds.includes(v.id))
        .map(v => _villageRowToTown(v, 'recommended', null));

      // listPublic 결과가 없으면 초기 state의 seed 추천 마을을 폴백으로 보존 (Phase0 데모용)
      const seedRec = pubTowns.length === 0
        ? (state.towns || []).filter(t => (t.collection || '') === 'recommended' && !mineIds.includes(t.id))
        : [];

      const merged = [...mineTowns, ...pubTowns, ...seedRec];
      if (merged.length > 0) {
        setTowns(merged);
        setMyVillageIds(mineIds);
      }
      // 완료 상태 Supabase 동기화: 만료된 mine 마을의 status를 'completed'로 업데이트
      if (DS.villages.update) {
        mineTowns.filter(t => t.status === 'completed').forEach(t => {
          Promise.resolve(DS.villages.update(t.id, { status: 'completed' })).catch(() => {});
        });
      }
    });

    return () => { alive = false; };
  }, []);

  // towns 변경 시 부모(App)에 동기화 — TownDetailView가 appState.towns로 조회하기 때문
  useEffect(() => {
    if (onTownsChange) onTownsChange(towns);
  }, [towns]);

  const codeInputRef = React.useRef(null);

  const getDday = (dday) => {
    if (dday === 0) return '오늘';
    if (dday < 0) return `D-${Math.abs(dday)}`;
    return `D+${dday}`;
  };

  const getTownProgress = (town) => {
    const totalParts = Math.max(town.totalParts || 1, 1);
    return Math.min(100, Math.max(0, (town.currentPart / totalParts) * 100));
  };

  const getTodayDoneCount = (town) => {
    return (town.members || []).filter((member) => member.todayRecorded).length;
  };

  const activeTowns = useMemo(
    () => towns.filter((town) => (town.collection || 'active') === 'active'),
    [towns]
  );

  const pastTowns = useMemo(
    () => towns.filter((town) => (town.collection || 'active') === 'past'),
    [towns]
  );

  const recommendedTowns = useMemo(() => {
    const currentBookId = state.book && state.book.id;
    return towns
      // #170: 내가 생성/참여 중인 마을은 추천에서 제외 (collection 라벨 + myVillageIds 이중 방어)
      .filter((town) => (town.collection || 'active') === 'recommended' && (town.visibility || 'public') === 'public' && !myVillageIds.includes(town.id))
      .slice()
      .sort((a, b) => {
        const aPriority = a.bookId === currentBookId ? 0 : 1;
        const bPriority = b.bookId === currentBookId ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (b.memberCount || 0) - (a.memberCount || 0);
      });
  }, [towns, state.book, myVillageIds]);

  const createBookOptions = useMemo(() => {
    const query = createBookQuery.trim().toLowerCase();
    return (ALL_BOOKS || [])
      .filter((book) => {
        if (!query) return true;
        const haystack = [book.title, book.author, book.publisher, book.isbn].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [createBookQuery]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return recommendedTowns;

    return towns.filter((town) => {
      if ((town.collection || 'active') === 'past') return false;
      if ((town.visibility || 'public') !== 'public') return false;
      // 검색 시에는 내 마을도 포함 (미리보기에서 "이미 참여 중" 표시)

      const book = resolveBook(town);
      const haystack = [town.name, town.currentRange, book.title, book.author, town.bookId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [towns, recommendedTowns, searchQuery]);

  const openFinder = () => {
    setFinderTab('code');
    setInviteCode('');
    setSearchQuery('');
    setPreviewTown(null);
    setFinderError('');
    setIsFinderOpen(true);
  };

  const closeFinder = () => {
    setIsFinderOpen(false);
    setPreviewTown(null);
    setFinderError('');
  };

  const handleCreateTown = () => {
    setCreateBookQuery('');
    setCreateTitle('');
    setCreateDescription('');
    setCreateVisibility('public');
    setCreateCapacity('');
    setCreatePartCount('3');
    setCreatePartDueDates(['', '', '']);
    setCreateBookId((state.book && state.book.id) || 'b001');
    setCreateError('');
    setIsCreateOpen(true);
  };

  const closeCreateTown = () => {
    setIsCreateOpen(false);
    setCreateError('');
  };

  const submitCreateTown = () => {
    if (!createBookId) {
      setCreateError('책을 먼저 선택해주세요.');
      return;
    }

    const partCount = Math.max(1, parseInt(createPartCount, 10) || 0);
    const capacityValue = createCapacity.trim() ? parseInt(createCapacity, 10) : null;

    if (createCapacity.trim() && (!capacityValue || capacityValue < 2)) {
      setCreateError('직접 정원을 입력할 경우 최소 2명 이상이어야 해요.');
      return;
    }

    if (!createTitle.trim()) {
      setCreateError('마을 이름을 입력해주세요.');
      return;
    }

    const normalizedCapacity = capacityValue || null;
    const parts = Array.from({ length: partCount }).map((_, i) => ({ part_order: i + 1, title: null, end_page: null, due_date: createPartDueDates[i] || null }));

    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.create) {
      // Supabase 연동: 실제 마을 생성
      Promise.resolve(DS.villages.create({
        bookId: createBookId,
        name: createTitle.trim(),
        visibility: createVisibility,
        capacity: normalizedCapacity,
        parts,
      })).then(v => {
        if (!v) { setCreateError('마을 생성에 실패했어요. 다시 시도해주세요.'); return; }
        const newTown = _villageRowToTown(v, 'active', v.created_by);
        // create 직후 응답엔 member_count·parts 미포함 → 입력값으로 보정
        newTown.bookId = createBookId;
        newTown.myRole = 'admin';
        newTown.memberCount = 1;
        newTown.totalParts = partCount;
        newTown.currentPart = 1;
        newTown.milestones = Array.from({ length: partCount }).map((_, i) => ({ part: i + 1, dueDate: createPartDueDates[i] || null, completed: false }));
        setTowns(prev => [...prev, newTown]);
        setMyVillageIds(prev => [...prev, newTown.id]);
        showToast(`마을을 만들었어요: ${newTown.name}`);
        closeCreateTown();
        onSelectTown(newTown.id);
      }).catch(e => {
        setCreateError('마을 생성 중 오류가 발생했어요: ' + ((e && e.message) || ''));
      });
    } else {
      // 폴백: in-memory (데모 모드)
      const id = 'town_' + Math.random().toString(36).slice(2,9);
      const invite = createVisibility === 'private' ? Array.from({length:6}).map(()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join('') : null;
      const newTown = {
        id,
        bookId: createBookId,
        name: createTitle.trim(),
        collection: 'active',
        visibility: createVisibility,
        inviteCode: invite,
        capacity: normalizedCapacity,
        myRole: 'admin',
        coAdmins: [],
        memberCount: 1,
        currentPart: 1,
        totalParts: partCount,
        dday: 0,
        isOpen: true,
        leader: '@jerome',
        currentRange: '프롤로그',
        status: 'active',
        milestones: Array.from({ length: partCount }).map((_,i)=>({ part: i+1, dueDate: null, completed: false })),
        members: [ { name: 'jerome', nest: '🏠', avatar: '🐦', todayRecorded: false, quote: '', cumulativePage: state.book ? state.book.cur || 0 : 0, streak: 0, xp: state.xp || 0 } ],
      };
      setTowns(prev => [...prev, newTown]);
      showToast(`마을을 만들었어요: ${newTown.name}`);
      closeCreateTown();
      onSelectTown(newTown.id);
    }
  };

  const submitInviteCode = () => {
    const normalized = inviteCode.trim().toUpperCase();
    if (normalized.length < 6) {
      setFinderError('코드 6자리를 모두 입력해주세요.');
      return;
    }

    // 로컬 목록에서 먼저 찾기
    const localMatch = towns.find((town) => (town.inviteCode || '').toUpperCase() === normalized);
    if (localMatch) {
      setFinderError('');
      setPreviewTown(localMatch);
      return;
    }

    // Supabase에서 invite_code 직접 조회 (공개·비공개 모두)
    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.findByCode) {
      Promise.resolve(DS.villages.findByCode(normalized)).then(matched => {
        if (!matched) { setFinderError('마을을 찾을 수 없어요. 코드를 다시 확인해주세요.'); return; }
        setFinderError('');
        setPreviewTown(_villageRowToTown(matched, 'recommended', null));
      }).catch(() => {
        setFinderError('마을을 찾을 수 없어요. 코드를 다시 확인해주세요.');
      });
    } else {
      setFinderError('마을을 찾을 수 없어요. 코드를 다시 확인해주세요.');
    }
  };

  const openTownPreview = (town) => {
    setFinderError('');
    setPreviewTown(town);
  };

  const _isUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleJoinTown = () => {
    if (!previewTown) return;
    // edge checks: cannot join past/completed, cannot join if already member, capacity
    const town = previewTown;
    if (!_isUUID(town.id)) { setFinderError('데모 마을은 참여할 수 없어요. 직접 마을을 만들어보세요!'); return; }
    const isPast = (town.collection || '') === 'past' || town.status === 'completed';
    if (isPast) { setFinderError('이 마을은 완료되어 참여할 수 없습니다.'); return; }
    const alreadyMine = myVillageIds.includes(town.id);
    if (alreadyMine) { setFinderError('이미 참여 중인 마을입니다.'); return; }
    if (town.capacity && (town.memberCount || (town.members||[]).length) >= town.capacity) { setFinderError('정원이 마감되었습니다.'); return; }

    const DS = window.DataStore;
    if (DS && DS.villages && DS.villages.join) {
      // Supabase 연동: 실제 참여
      Promise.resolve(DS.villages.join(town.id)).then(() => {
        const joinedTown = { ...town, collection: 'active', myRole: 'member', memberCount: (town.memberCount || 0) + 1 };
        setTowns(prev => {
          const without = prev.filter(t => t.id !== town.id);
          return [...without, joinedTown];
        });
        setMyVillageIds(prev => [...prev, town.id]);
        showToast('마을에 참여했습니다');
        onSelectTown(town.id);
        closeFinder();
      }).catch(e => {
        setFinderError('참여 중 오류가 발생했어요: ' + ((e && e.message) || ''));
      });
    } else {
      // 폴백: in-memory (데모 모드)
      const joinedTown = { ...town, collection: 'active', myRole: 'member', memberCount: (town.memberCount || 0) + 1 };
      setTowns(prev => {
        const without = prev.filter(t => t.id !== town.id);
        return [...without, joinedTown];
      });
      showToast('마을에 참여했습니다');
      onSelectTown(town.id);
      closeFinder();
    }
  };

  return (
    <section className="view active">
      <div style={{padding:'14px 16px 6px'}}>
        <div style={{fontSize:24, fontWeight:900, letterSpacing:'-.4px'}}>🏘️ 마을</div>
        <div style={{fontSize:13, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
          함께 읽는 마을을 찾고, 참여하고, 다시 돌아볼 수 있어요
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.3fr .9fr', gap:10, padding:'10px 16px 18px'}}>
        <button
          onClick={openFinder}
          style={{
            padding:'14px 14px',
            border:'none',
            borderRadius:14,
            background:'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
            color:'white',
            fontWeight:800,
            fontSize:15,
            cursor:'pointer',
            boxShadow:'0 8px 18px rgba(34, 122, 83, 0.18)',
          }}
        >
          🔍 마을 찾기
        </button>
        <button
          onClick={handleCreateTown}
          style={{
            padding:'14px 12px',
            border:'1.5px solid var(--line-2)',
            borderRadius:14,
            background:'var(--card)',
            color:'var(--ink-1)',
            fontWeight:800,
            fontSize:14,
            cursor:'pointer',
          }}
        >
          + 만들기
        </button>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:18, padding:'0 16px 20px'}}>
        <TownSection
          title={`참여 중인 마을 (${activeTowns.length})`}
          towns={activeTowns}
          emptyText="참여 중인 마을이 없어요"
          renderTown={(town) => (
            <TownCard
              key={town.id}
              town={town}
              book={resolveBook(town)}
              onClick={() => onSelectTown(town.id)}
              dday={getDday(town.dday)}
              metaText={`${town.currentPart}/${town.totalParts} 파트 · ${getDday(town.dday)}`}
              progressLabel={`${getTodayDoneCount(town)}/${town.memberCount || (town.members || []).length}명 완료`}
              progressPercent={getTownProgress(town)}
              showCompletedBadge={town.status === 'completed' || town.collection === 'past'}
            />
          )}
        />

        <div>
          <button
            onClick={() => setIsPastOpen((value) => !value)}
            style={{
              width:'100%',
              display:'flex',
              alignItems:'center',
              justifyContent:'space-between',
              gap:10,
              padding:'0 2px',
              border:'none',
              background:'transparent',
              cursor:'pointer',
              marginBottom:10,
            }}
          >
            <div style={{fontSize:14, fontWeight:900, color:'var(--ink-1)'}}>지난 마을</div>
            <div style={{fontSize:14, color:'var(--ink-2)', fontWeight:800, transform:isPastOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s ease'}}>
              ▾
            </div>
          </button>
          {isPastOpen && (
            <TownSection
              title=""
              towns={pastTowns}
              emptyText="지난 마을이 없어요"
              renderTown={(town) => (
                <TownCard
                  key={town.id}
                  town={town}
                  book={resolveBook(town)}
                  onClick={() => onSelectTown(town.id)}
                  dday={town.completedLabel || getDday(town.dday)}
                  metaText={`${town.statusLabel || '완료'} · ${town.completedLabel || '최근'} · 책 ${town.completedBooks || 1}권`}
                  progressLabel="읽기 전용으로 다시 볼 수 있어요"
                  progressPercent={100}
                  showCompletedBadge
                  compact
                />
              )}
            />
          )}
        </div>

        {recommendedTowns.length > 0 && (
          <TownSection
            title="추천 공개 마을"
            towns={recommendedTowns}
            emptyText=""
            renderTown={(town) => {
              const book = resolveBook(town);
              return (
                <button
                  key={town.id}
                  onClick={() => openTownPreview(town)}
                  style={{
                    width:'100%',
                    textAlign:'left',
                    padding:'14px',
                    border:'1.5px solid var(--line)',
                    borderRadius:16,
                    background:'var(--card)',
                    cursor:'pointer',
                  }}
                >
                  <div style={{display:'flex', gap:12, alignItems:'center'}}>
                    <div style={{width:52, height:72, flexShrink:0, borderRadius:10, overflow:'hidden', background:'var(--line-2)'}}>
                      {book.cover ? (
                        <img src={book.cover} alt={book.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      ) : (
                        <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24}}>📘</div>
                      )}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:15, fontWeight:800, color:'var(--ink-1)', lineHeight:1.35}}>{town.name}</div>
                      <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:3}}>{book.title}</div>
                      <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:8}}>
                        <span>{town.memberCount}명</span>
                        <span>·</span>
                        <span>{town.currentPart}/{town.totalParts} 파트</span>
                        <span>·</span>
                        <span style={{color:'var(--accent)'}}>{getDday(town.dday)}</span>
                      </div>
                    </div>
                    <div style={{alignSelf:'center', color:'var(--brand-3)', fontWeight:800, fontSize:13}}>신청하기</div>
                  </div>
                </button>
              );
            }}
          />
        )}
      </div>

      {isFinderOpen && (
        <div
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(16, 24, 18, 0.52)',
            display:'flex',
            alignItems:'flex-end',
            zIndex:9999,
          }}
          onClick={closeFinder}
        >
          <div
            style={{
              width:'100%',
              background:'var(--paper)',
              borderRadius:'22px 22px 0 0',
              boxShadow:'0 -18px 40px rgba(0,0,0,0.16)',
              maxHeight:'88vh',
              overflow:'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--line)'}}>
              <div style={{fontSize:15, fontWeight:800}}>마을 찾기</div>
              <button onClick={closeFinder} style={{background:'transparent', border:'none', fontSize:20, cursor:'pointer', padding:4}}>×</button>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'12px 16px 0'}}>
              <button
                onClick={() => { setFinderTab('code'); setFinderError(''); }}
                style={{
                  padding:'10px 12px',
                  border:'1.5px solid ' + (finderTab === 'code' ? 'var(--brand)' : 'var(--line)'),
                  background: finderTab === 'code' ? 'var(--brand-tint)' : 'var(--card)',
                  borderRadius:12,
                  fontWeight:800,
                  cursor:'pointer',
                }}
              >
                🔐 코드 입력
              </button>
              <button
                onClick={() => { setFinderTab('search'); setFinderError(''); }}
                style={{
                  padding:'10px 12px',
                  border:'1.5px solid ' + (finderTab === 'search' ? 'var(--brand)' : 'var(--line)'),
                  background: finderTab === 'search' ? 'var(--brand-tint)' : 'var(--card)',
                  borderRadius:12,
                  fontWeight:800,
                  cursor:'pointer',
                }}
              >
                🌐 책으로 검색
              </button>
            </div>

            <div style={{padding:'16px', overflowY:'auto', maxHeight:'calc(88vh - 118px)'}}>
              {finderTab === 'code' ? (
                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:10}}>코드로 참여하기</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:8, marginBottom:14}}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        onClick={() => { if (codeInputRef && codeInputRef.current) codeInputRef.current.focus(); }}
                        style={{
                          height:48,
                          borderRadius:12,
                          border:'1.5px solid var(--line)',
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          fontSize:16,
                          fontWeight:900,
                          background:'var(--card)',
                          letterSpacing:'0.1em',
                          cursor:'text',
                        }}
                      >
                        {(inviteCode[index] || '·').toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <input
                    ref={codeInputRef}
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6));
                      setFinderError('');
                    }}
                    placeholder="코드 6자리 입력"
                    maxLength={6}
                    autoComplete="off"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      letterSpacing:'0.18em',
                      textAlign:'center',
                      boxSizing:'border-box',
                    }}
                  />
                  <button
                    onClick={submitInviteCode}
                    disabled={inviteCode.trim().length < 6}
                    style={{
                      width:'100%',
                      marginTop:12,
                      padding:'12px 14px',
                      border:'none',
                      borderRadius:12,
                      background: inviteCode.trim().length < 6 ? 'var(--line-2)' : 'var(--brand)',
                      color: inviteCode.trim().length < 6 ? 'var(--ink-3)' : 'white',
                      fontWeight:900,
                      cursor: inviteCode.trim().length < 6 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    코드로 참여하기
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFinderError('');
                    }}
                    placeholder="책 제목 · 저자로 검색..."
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      marginBottom:12,
                    }}
                  />

                  {searchResults.length > 0 ? (
                    searchResults.map((town) => {
                      const book = resolveBook(town);
                      return (
                        <button
                          key={town.id}
                          onClick={() => openTownPreview(town)}
                          style={{
                            width:'100%',
                            textAlign:'left',
                            padding:'12px 14px',
                            border:'1px solid var(--line)',
                            borderRadius:14,
                            background:'var(--card)',
                            marginBottom:10,
                            cursor:'pointer',
                          }}
                        >
                          <div style={{fontSize:14, fontWeight:900, lineHeight:1.35}}>{town.name}</div>
                          <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:4}}>{book.title}</div>
                          <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:8}}>
                            <span>{town.memberCount}명</span>
                            <span>·</span>
                            <span>{town.currentPart}/{town.totalParts} 파트</span>
                            <span>·</span>
                            <span style={{color:'var(--accent)'}}>{getDday(town.dday)}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : searchQuery.trim() ? (
                    <div style={{padding:'28px 4px', textAlign:'center', color:'var(--ink-2)'}}>
                      <div style={{fontSize:18, marginBottom:8}}>이 책을 읽는 공개 마을이 없어요.</div>
                      <div style={{fontSize:13}}>직접 만들어볼까요? <span style={{fontWeight:900, color:'var(--brand-3)'}}>마을 만들기 →</span></div>
                    </div>
                  ) : (
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700}}>
                      현재 읽는 책과 참여자 수가 많은 공개 마을을 먼저 보여줘요.
                    </div>
                  )}
                </div>
              )}

              {finderError && (
                <div style={{marginTop:12, padding:'12px 14px', borderRadius:12, background:'var(--rose-soft)', color:'var(--rose)', fontSize:13, fontWeight:700}}>
                  {finderError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(16, 24, 18, 0.52)',
            display:'flex',
            alignItems:'flex-end',
            zIndex:10001,
          }}
          onClick={closeCreateTown}
        >
          <div
            style={{
              width:'100%',
              background:'var(--paper)',
              borderRadius:'22px 22px 0 0',
              boxShadow:'0 -18px 40px rgba(0,0,0,0.16)',
              maxHeight:'90vh',
              overflow:'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--line)'}}>
              <div style={{fontSize:15, fontWeight:800}}>마을 개설</div>
              <button onClick={closeCreateTown} style={{background:'transparent', border:'none', fontSize:20, cursor:'pointer', padding:4}}>×</button>
            </div>

            <div style={{padding:16, overflowY:'auto', maxHeight:'calc(90vh - 58px)'}}>
              <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:10}}>책 선택</div>
              <input
                value={createBookQuery}
                onChange={(e) => setCreateBookQuery(e.target.value)}
                placeholder="내서재 또는 책 제목 검색"
                style={{
                  width:'100%',
                  padding:'12px 14px',
                  borderRadius:12,
                  border:'1.5px solid var(--line)',
                  background:'var(--paper)',
                  fontSize:14,
                  fontWeight:700,
                  boxSizing:'border-box',
                  marginBottom:10,
                }}
              />
              <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:16}}>
                {createBookOptions.map((book) => (
                  <button
                    key={book.book_id}
                    onClick={() => setCreateBookId(book.book_id)}
                    style={{
                      width:'100%',
                      textAlign:'left',
                      padding:'12px 14px',
                      border:'1.5px solid ' + (createBookId === book.book_id ? 'var(--brand)' : 'var(--line)'),
                      borderRadius:14,
                      background: createBookId === book.book_id ? 'var(--brand-tint)' : 'var(--card)',
                      cursor:'pointer',
                    }}
                  >
                    <div style={{fontSize:14, fontWeight:900, lineHeight:1.35}}>{book.title}</div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:600, marginTop:4}}>{book.author}</div>
                  </button>
                ))}
              </div>

              <div style={{display:'grid', gap:12}}>
                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>마을 정보</div>
                  <input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="마을 이름"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      marginBottom:8,
                    }}
                  />
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="소개 (선택)"
                    rows={3}
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                      resize:'vertical',
                    }}
                  />
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>공개 설정</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                    {[
                      { value: 'public', label: '공개' },
                      { value: 'private', label: '비공개' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setCreateVisibility(option.value)}
                        style={{
                          padding:'11px 12px',
                          border:'1.5px solid ' + (createVisibility === option.value ? 'var(--brand)' : 'var(--line)'),
                          background: createVisibility === option.value ? 'var(--brand-tint)' : 'var(--card)',
                          borderRadius:12,
                          fontWeight:800,
                          cursor:'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>정원 설정</div>
                  <input
                    value={createCapacity}
                    onChange={(e) => setCreateCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="기본값: 제한 없음"
                    inputMode="numeric"
                    style={{
                      width:'100%',
                      padding:'12px 14px',
                      borderRadius:12,
                      border:'1.5px solid var(--line)',
                      background:'var(--paper)',
                      fontSize:14,
                      fontWeight:700,
                      boxSizing:'border-box',
                    }}
                  />
                  <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, marginTop:6}}>직접 설정 시 최소 2명 이상</div>
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>마일스톤</div>
                  <div style={{display:'flex', gap:8, marginBottom:8}}>
                    <input
                      value={createPartCount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setCreatePartCount(val);
                        const count = Math.max(1, parseInt(val, 10) || 1);
                        setCreatePartDueDates(prev => {
                          const next = Array.from({ length: count }).map((_, i) => prev[i] || '');
                          return next;
                        });
                      }}
                      placeholder="파트 수"
                      inputMode="numeric"
                      style={{
                        flex:1,
                        padding:'12px 14px',
                        borderRadius:12,
                        border:'1.5px solid var(--line)',
                        background:'var(--paper)',
                        fontSize:14,
                        fontWeight:700,
                        boxSizing:'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const count = Math.max(1, parseInt(createPartCount, 10) || 1);
                        const today = new Date();
                        const totalDays = 28;
                        const newDates = Array.from({ length: count }).map((_, i) => {
                          const d = new Date(today);
                          d.setDate(d.getDate() + Math.round((i + 1) * totalDays / count));
                          return d.toISOString().split('T')[0];
                        });
                        setCreatePartDueDates(newDates);
                      }}
                      style={{
                        padding:'10px 12px',
                        border:'1.5px solid var(--line)',
                        borderRadius:12,
                        background:'var(--card)',
                        fontWeight:800,
                        fontSize:12,
                        color:'var(--ink-2)',
                        cursor:'pointer',
                        whiteSpace:'nowrap',
                      }}
                    >
                      균등 자동 분할
                    </button>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    {Array.from({ length: Math.max(1, parseInt(createPartCount, 10) || 1) }).map((_, index) => (
                      <div key={index} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:12, background:'var(--card)', border:'1px solid var(--line)'}}>
                        <span style={{fontSize:12, fontWeight:800, color:'var(--ink-2)', minWidth:44, flexShrink:0}}>파트 {index + 1}</span>
                        <span style={{fontSize:11, color:'var(--ink-3)', flexShrink:0}}>마감</span>
                        <input
                          type="date"
                          value={createPartDueDates[index] || ''}
                          onChange={(e) => {
                            setCreatePartDueDates(prev => {
                              const next = [...prev];
                              next[index] = e.target.value;
                              return next;
                            });
                          }}
                          style={{
                            flex:1,
                            padding:'6px 10px',
                            borderRadius:8,
                            border:'1.5px solid var(--line)',
                            background:'var(--paper)',
                            fontSize:13,
                            fontWeight:700,
                            boxSizing:'border-box',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {createDescription.trim() && (
                  <div style={{padding:'12px 14px', borderRadius:14, background:'var(--brand-tint)', color:'var(--brand-3)', fontSize:13, fontWeight:800}}>
                    {createDescription.trim()}
                  </div>
                )}

                {createError && (
                  <div style={{padding:'12px 14px', borderRadius:12, background:'var(--rose-soft)', color:'var(--rose)', fontSize:13, fontWeight:700}}>
                    {createError}
                  </div>
                )}

                <button
                  onClick={submitCreateTown}
                  style={{
                    width:'100%',
                    padding:'13px 14px',
                    border:'none',
                    borderRadius:14,
                    background:'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
                    color:'white',
                    fontWeight:900,
                    fontSize:14,
                    cursor:'pointer',
                    boxShadow:'0 8px 18px rgba(34, 122, 83, 0.18)',
                  }}
                >
                  마을 개설하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewTown && (() => {
        const book = resolveBook(previewTown);
        const currentMilestone = (previewTown.milestones || []).find((milestone) => milestone.part === previewTown.currentPart);
        return (
          <div
            style={{
              position:'fixed',
              inset:0,
              background:'rgba(0,0,0,0.5)',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              zIndex:10000,
              padding:16,
            }}
            onClick={() => setPreviewTown(null)}
          >
            <div
              style={{
                width:'100%',
                maxWidth:420,
                background:'var(--paper)',
                borderRadius:20,
                overflow:'hidden',
                boxShadow:'0 24px 60px rgba(0,0,0,0.24)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{padding:'16px 16px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--line)'}}>
                <div style={{fontSize:15, fontWeight:900}}>마을 발견!</div>
                <button onClick={() => setPreviewTown(null)} style={{background:'transparent', border:'none', fontSize:20, cursor:'pointer'}}>×</button>
              </div>

              <div style={{padding:16}}>
                <div style={{display:'flex', gap:12, alignItems:'flex-start', marginBottom:14}}>
                  <div style={{width:68, height:94, flexShrink:0, borderRadius:14, overflow:'hidden', background:'var(--line-2)'}}>
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    ) : (
                      <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28}}>📘</div>
                    )}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:16, fontWeight:900, lineHeight:1.35}}>{previewTown.name}</div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      관리자: {previewTown.leader} {previewTown.visibility === 'private' ? '👑' : ''}
                    </div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      인원: {previewTown.memberCount} / {previewTown.capacity || 10}명
                    </div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      현재: {previewTown.currentPart}/{previewTown.totalParts} 파트 · {getDday(previewTown.dday)}
                    </div>
                    <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>
                      이번 파트: {previewTown.currentRange || currentMilestone?.title || '마일스톤 확인'}
                    </div>
                  </div>
                </div>

                <div style={{padding:'12px 14px', borderRadius:14, background:'var(--brand-tint)', color:'var(--brand-3)', fontSize:13, fontWeight:800, marginBottom:14}}>
                  🐦 파트 {previewTown.currentPart} 진행 중! 지금 참여하면 바로 달릴 수 있어요.
                </div>

                {(() => {
                  const isSeed = !_isUUID(previewTown.id);
                  const isMember = myVillageIds.includes(previewTown.id);
                  const isFull = previewTown.capacity && (previewTown.memberCount || (previewTown.members||[]).length) >= previewTown.capacity;
                  const isPast = (previewTown.collection || '') === 'past' || previewTown.status === 'completed';
                  let label = '참여하기';
                  if (isSeed) label = '데모 마을';
                  else if (isPast) label = '완료된 마을';
                  else if (isMember) label = '참여 중';
                  else if (isFull) label = '정원 마감';
                  const disabled = isSeed || isPast || isMember || isFull;

                  return (
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                      <button
                        onClick={() => setPreviewTown(null)}
                        style={{
                          padding:'12px 14px',
                          border:'1.5px solid var(--line-2)',
                          borderRadius:12,
                          background:'var(--card)',
                          fontWeight:900,
                          cursor:'pointer',
                        }}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleJoinTown}
                        disabled={disabled}
                        style={{
                          padding:'12px 14px',
                          border:'none',
                          borderRadius:12,
                          background: disabled ? 'var(--line-2)' : 'var(--brand)',
                          color: disabled ? 'var(--ink-3)' : 'white',
                          fontWeight:900,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

function TownSection({ title, towns, renderTown, emptyText }) {
  if (!title) {
    return towns.length > 0 ? (
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {towns.map((town) => renderTown(town))}
      </div>
    ) : emptyText ? (
      <div style={{padding:'18px 14px', borderRadius:14, border:'1px dashed var(--line-2)', color:'var(--ink-2)', fontSize:13, fontWeight:700}}>{emptyText}</div>
    ) : null;
  }

  return (
    <div>
      <div style={{fontSize:14, fontWeight:900, color:'var(--ink-1)', marginBottom:10}}>{title}</div>
      {towns.length > 0 ? (
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {towns.map((town) => renderTown(town))}
        </div>
      ) : emptyText ? (
        <div style={{padding:'18px 14px', borderRadius:14, border:'1px dashed var(--line-2)', color:'var(--ink-2)', fontSize:13, fontWeight:700}}>{emptyText}</div>
      ) : null}
    </div>
  );
}

function TownCard({ town, book, onClick, dday, metaText, progressLabel, progressPercent, showCompletedBadge, compact }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%',
        textAlign:'left',
        border:'1.5px solid var(--line)',
        borderRadius:18,
        background:'var(--card)',
        padding:14,
        cursor:'pointer',
        boxShadow: compact ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{display:'flex', gap:12}}>
        <div style={{width:62, height:86, flexShrink:0, borderRadius:12, overflow:'hidden', background:`linear-gradient(135deg, ${book.fb[0]} 0%, ${book.fb[1]} 100%)`, boxShadow:'0 4px 12px rgba(0,0,0,0.14)'}}>
          {book.cover ? (
            <img src={book.cover} alt={book.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
          ) : (
            <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28}}>📘</div>
          )}
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:15, fontWeight:900, color:'var(--ink-1)', lineHeight:1.35}}>{town.name}</div>
              <div style={{fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:4}}>{book.title}</div>
            </div>
            {showCompletedBadge ? <div style={{fontSize:13, fontWeight:900, color:'var(--brand-3)'}}>✅ 완료</div> : null}
          </div>

          <div style={{display:'flex', gap:8, flexWrap:'wrap', fontSize:12, color:'var(--ink-2)', fontWeight:700, marginTop:10}}>
            <span>{metaText}</span>
          </div>

          <div style={{marginTop:10}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:8, fontSize:12, fontWeight:800, color:'var(--ink-2)', marginBottom:6}}>
              <span>{progressLabel}</span>
              <span style={{color:'var(--accent)'}}>{dday}</span>
            </div>
            <div style={{height:8, borderRadius:999, background:'var(--line-2)', overflow:'hidden'}}>
              <div style={{width:`${progressPercent}%`, height:'100%', borderRadius:999, background:'linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%)'}} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

window.VillageView = VillageView;
