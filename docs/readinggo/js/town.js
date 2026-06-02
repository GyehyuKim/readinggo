/* =========================================================
   ReadingGo — town.js (clean)
   마을 내부: 멤버 / 한 문장 / 게시판 + 설정 시트 (Phase0: 로컬 모의)
   ========================================================= */

function TownDetailView({ state, townId, onBack }) {
  const { useState } = React;
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeSubtab, setActiveSubtab] = useState('members');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const town = state.towns.find(t => t.id === townId);
  const book = town ? getBook(town.bookId) : null;
  if (!town || !book) return (<section className="view active"><div>마을을 찾을 수 없습니다</div></section>);

  // Local board data (Phase0 in-memory). Seed per-town if absent.
  if (!town._topics) {
    const sampleAuthor = (town.members && town.members[1] && town.members[1].name) || (town.members && town.members[0] && town.members[0].name) || 'anonymous';
    town._topics = [
      { id: 't1', title: '1부에서 인상 깊었던 문장', desc: '', status: 'open', due: 2, createdBy: town.leader, opinions: [
        { id: 'o1', author: sampleAuthor, text: '저는 p.87의 문장이 인상 깊었습니다.', createdAt: '1일 전' }
      ]},
    ];
  }

  const isAdmin = (town.myRole === 'admin' || (town.coAdmins || []).includes('jerome')) && town.collection !== 'past';

  // Ranking
  const ranking = [...town.members].sort((a,b)=>b.cumulativePage-a.cumulativePage).map((m,i)=>({...m,rank:i+1}));

  // Board handlers (in-memory)
  const [renderKey, setRenderKey] = useState(0);
  const addTopic = (title, desc, days) => {
    if (!title || title.trim().length===0) { showToast('주제는 필수입니다'); return; }
    const id = 't' + Math.random().toString(36).slice(2,8);
    town._topics.unshift({ id, title: title.slice(0,100), desc: desc ? desc.slice(0,200):'', status:'open', due: days, createdBy: 'jerome', opinions: [] });
    showToast('주제가 등록되었습니다');
    setRenderKey(k=>k+1);
  };
  const addOpinion = (topicId, text, author) => {
    if (!text || text.trim().length===0) { showToast('의견을 입력하세요'); return; }
    const t = town._topics.find(x=>x.id===topicId); if(!t) return;
    t.opinions.push({ id: 'o'+Math.random().toString(36).slice(2,8), author: author||'jerome', text: text.slice(0,300), createdAt: '방금' });
    showToast('의견이 등록되었습니다'); setRenderKey(k=>k+1);
  };
  const deleteTopic = (topicId) => { town._topics = town._topics.filter(t=>t.id!==topicId); showToast('주제를 삭제했습니다'); setRenderKey(k=>k+1); };
  const deleteOpinion = (topicId, opinionId) => { const t=town._topics.find(x=>x.id===topicId); if(!t) return; t.opinions = t.opinions.filter(o=>o.id!==opinionId); showToast('의견이 삭제되었습니다'); setRenderKey(k=>k+1); };

  // Topic editor control (parent-controlled)
  const [topicEditorOpen, setTopicEditorOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState(null);

  const openNewTopic = () => { setTopicDraft({title:'',desc:'',due:3}); setTopicEditorOpen(true); };

  return (
    <section className="view active">
      <div style={{padding:'12px 16px', borderBottom:'1.5px solid var(--line)', display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
        <button onClick={onBack} style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',padding:4}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800}}>{town.name}</div>
          <div style={{fontSize:12,color:'var(--ink-2)',fontWeight:600,marginTop:2}}>{book.title}</div>
        </div>
        <button onClick={()=>setIsSettingsOpen(true)} style={{background:'transparent',border:'none',fontSize:18,cursor:'pointer'}}>⚙️</button>
      </div>

      {/* Milestone + tabs */}
      <div style={{padding:'16px',marginBottom:8}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700}}>{town.currentPart} / {town.totalParts} 파트 · {town.currentRange}</div>
          <div style={{fontSize:12,color:'var(--ink-3)'}}>리더: {town.leader}</div>
        </div>
        <div style={{height:8,background:'var(--line)',borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${((town.currentPart-1)/town.totalParts)*100}%`,background:'var(--brand)'}}/></div>
      </div>

      <div style={{padding:'0 16px',position:'sticky',top:0,zIndex:20,background:'var(--paper)',borderBottom:'1px solid var(--line)',marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,paddingBottom:10}}>
          {['members','sentence','board'].map(id=> (
            <button key={id} onClick={()=>setActiveSubtab(id)} style={{padding:'10px 8px',border:'1.5px solid '+(activeSubtab===id?'var(--brand)':'var(--line)'),borderRadius:12,background:activeSubtab===id?'var(--brand-tint)':'var(--card)',fontWeight:900,fontSize:13,color:activeSubtab===id?'var(--brand-3)':'var(--ink-2)'}}>{id==='members'?'👥 멤버':id==='sentence'?'📖 한 문장':'💬 게시판'}</button>
          ))}
        </div>
      </div>

      {activeSubtab==='members' && (
        <div style={{padding:'0 16px 40px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)',marginBottom:12}}>👥 참여자 둥지 ({town.members.length}명)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
            {town.members.map(m=> <div key={m.name} onClick={()=>setSelectedMember(m)} style={{cursor:'pointer',textAlign:'center',padding:10,borderRadius:10,background:m.todayRecorded?'var(--brand-tint)':'var(--line-2)'}}><div style={{fontSize:28}}>{m.nest}</div><div style={{fontSize:11,fontWeight:700,color:'var(--ink-2)'}}>@{m.name}</div></div>)}
          </div>

          <div style={{marginTop:20}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)',marginBottom:8}}>🏆 파트별 랭킹</div>
            <div style={{background:'var(--card)',borderRadius:12,border:'1.5px solid var(--line)'}}>
              {ranking.map((member,idx)=> (
                <div key={member.name} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:idx<ranking.length-1?'1px solid var(--line-2)':'none'}}>
                  <div style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900}}>{member.rank<=3?['🥇','🥈','🥉'][member.rank-1]:member.rank}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>@{member.name}</div><div style={{fontSize:11,color:'var(--ink-2)'}}>{member.nest} · 🔥 {member.streak}</div></div>
                  <div style={{textAlign:'right'}}><div style={{fontSize:15,fontWeight:900}}>{member.cumulativePage}</div><div style={{fontSize:10,color:'var(--ink-3)'}}>페이지</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubtab==='sentence' && (
        <div style={{padding:'0 16px 40px'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)',marginBottom:12}}>📖 마을 지정 책 한 문장</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {(town.members||[]).filter(m=>m.quote).map(m=> (<div key={m.name} style={{padding:14,borderRadius:14,background:'var(--card)',border:'1.5px solid var(--line)'}}><div style={{fontSize:12,fontWeight:800,color:'var(--ink-2)',marginBottom:6}}>@{m.name} · {m.todayRecorded?'오늘 기록':'기록 있음'}</div><div style={{fontSize:14,fontWeight:700,lineHeight:1.5}}>{m.quote}</div></div>))}
          </div>
        </div>
      )}

      {activeSubtab==='board' && (
        <div style={{padding:'0 16px 80px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--ink-2)'}}>💬 게시판</div>
            {isAdmin && (<button onClick={openNewTopic} style={{background:'var(--brand)',color:'white',padding:'8px 10px',borderRadius:10,border:'none',fontWeight:800}}>+ 주제 등록</button>)}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {(town._topics||[]).map(topic=> (
              <div key={topic.id} style={{padding:12,borderRadius:12,background:'var(--card)',border:'1.5px solid var(--line)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div><div style={{fontSize:13,fontWeight:900}}>{topic.title}</div><div style={{fontSize:12,color:'var(--ink-3)'}}>{topic.desc}</div></div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <div style={{fontSize:12,color:'var(--ink-3)'}}>의견 {topic.opinions.length}개</div>
                    {isAdmin && (<>
                      <button onClick={()=>{/* edit */}} style={{background:'transparent',border:'none',cursor:'pointer'}}>수정</button>
                      <button onClick={()=>deleteTopic(topic.id)} style={{background:'transparent',border:'none',color:'var(--danger)'}}>삭제</button>
                    </>)}
                  </div>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {topic.opinions.slice(0,3).map(op=> (
                    <div key={op.id} style={{padding:8,borderRadius:8,background:'white',border:'1px solid var(--line-2)'}}><div style={{fontSize:12,fontWeight:700}}>@{op.author}</div><div style={{fontSize:13}}>{op.text}</div><div style={{fontSize:11,color:'var(--ink-3)'}}>{op.createdAt} {op.author==='jerome' && (<button onClick={()=>deleteOpinion(topic.id,op.id)} style={{background:'transparent',border:'none',color:'var(--ink-3)'}}>삭제</button>)}</div></div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <input placeholder="의견 쓰기..." style={{flex:1,padding:8,borderRadius:8,border:'1px solid var(--line)'}} id={`op_input_${topic.id}`} />
                    <button onClick={()=>{ const el=document.getElementById(`op_input_${topic.id}`); if(el) { addOpinion(topic.id, el.value, 'jerome'); el.value=''; } }} style={{padding:'8px 10px',borderRadius:8,background:'var(--brand)',color:'white',border:'none'}}>등록</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Topic editor sheet (controlled) */}
          <TopicEditor open={topicEditorOpen} onClose={()=>setTopicEditorOpen(false)} initial={topicDraft} onSave={(title,desc,due)=>{ addTopic(title,desc,due); setTopicEditorOpen(false); }} />
        </div>
      )}

      {/* Settings sheet */}
      {isSettingsOpen && (
        <div className="modal-backdrop show" onClick={()=>setIsSettingsOpen(false)}>
          <div className="sheet" role="dialog" aria-label="설정" onClick={(e)=>e.stopPropagation()}>
            <div className="sheet-grip" />
            <div style={{padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}> <div style={{fontSize:16,fontWeight:900}}>설정</div> <button onClick={()=>setIsSettingsOpen(false)} style={{background:'transparent',border:'none'}}>✕</button></div>
              <div style={{display:'grid',gap:10}}>
                <div style={{padding:10,background:'var(--card)',borderRadius:10}}>초대 링크: <strong>rgo.app/v/{town.inviteCode||'-----'}</strong> <button onClick={()=>{ navigator.clipboard && navigator.clipboard.writeText(`https://rgo.app/v/${town.inviteCode||''}`); showToast('초대 링크 복사됨'); }} style={{marginLeft:8}}>복사</button></div>
                <div style={{padding:10,background:'var(--card)',borderRadius:10}}>초대 코드: <strong>{town.inviteCode||'없음'}</strong> <button onClick={()=>{ navigator.clipboard && navigator.clipboard.writeText(town.inviteCode||''); showToast('초대 코드 복사됨'); }} style={{marginLeft:8}}>복사</button></div>
                <div style={{padding:10,background:'var(--card)',borderRadius:10}}>알림 설정: <div style={{marginTop:8,display:'flex',gap:8}}><label><input type="checkbox" defaultChecked={town.notificationPrefs && town.notificationPrefs.poke}/> 콕찌르기</label><label><input type="checkbox" defaultChecked={town.notificationPrefs && town.notificationPrefs.board}/> 게시판</label></div></div>
                <div style={{padding:10,background:'var(--card)',borderRadius:10}}><button onClick={()=>{ if(isAdmin){ showToast('관리자 권한을 이양하세요 (시뮬레이션)'); } else { showToast('관리자에게 요청하세요'); } }} style={{padding:8}}>나가기</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

function TopicEditor({ open, onClose, initial, onSave }) {
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
            <div style={{fontSize:15,fontWeight:900}}>주제 등록</div>
            <button onClick={onClose} style={{background:'transparent',border:'none'}}>✕</button>
          </div>
          <input placeholder="주제 (최대 100자)" value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%',padding:8,borderRadius:8,border:'1px solid var(--line)',marginBottom:8}} />
          <textarea placeholder="설명 (선택, 최대 200자)" value={desc} onChange={e=>setDesc(e.target.value)} style={{width:'100%',padding:8,borderRadius:8,border:'1px solid var(--line)',marginBottom:8}} />
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select value={due} onChange={e=>setDue(Number(e.target.value))}><option value={1}>1일</option><option value={3}>3일</option><option value={5}>5일</option><option value={7}>7일</option></select>
            <button onClick={()=>{ if(onSave) onSave(title,desc,due); }} style={{marginLeft:'auto',background:'var(--brand)',color:'white',padding:8,borderRadius:8}}>등록</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.TownDetailView = TownDetailView;
