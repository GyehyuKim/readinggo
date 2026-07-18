/* =========================================================
   ReadingGo Prompt Lab (#1304)
   합성 fixture 전용. 모든 읽기/쓰기는 Worker의 서버 역할 검사를 통과한다.
   ========================================================= */
const { useState: _plUseState, useEffect: _plUseEffect } = React;

async function promptLabRequest(action, payload) {
  const token = window.RG_SB && window.RG_SB.accessToken ? await window.RG_SB.accessToken() : null;
  if (!token) throw new Error('로그인이 필요해요.');
  const base = (window.RG_CONFIG && window.RG_CONFIG.API_ORIGIN) || '';
  const response = await fetch(base + '/api/prompt-lab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(Object.assign({ action }, payload || {})),
  });
  let data = {};
  try { data = await response.json(); } catch (e) {}
  if (!response.ok) {
    const error = new Error(data.error || 'Prompt Lab 요청을 처리하지 못했어요.');
    error.status = response.status;
    throw error;
  }
  return data;
}
window.RG_promptLab = promptLabRequest;

const PL_CARD = { background:'var(--card)', border:'1px solid var(--line)', borderRadius:16, padding:16 };
const PL_INPUT = { width:'100%', boxSizing:'border-box', background:'var(--paper)', color:'var(--ink)', border:'1px solid var(--line)', borderRadius:12, padding:'10px 12px', fontSize:13, lineHeight:1.5 };
const PL_PRIMARY = { border:'none', borderRadius:12, padding:'10px 14px', background:'var(--brand)', color:'#fff', fontWeight:800, cursor:'pointer' };
const PL_SECONDARY = { border:'1px solid var(--brand-soft)', borderRadius:12, padding:'9px 13px', background:'var(--brand-soft)', color:'var(--brand-3)', fontWeight:800, cursor:'pointer' };
const PL_TERTIARY = { border:'none', borderRadius:12, padding:'9px 12px', background:'var(--card-soft)', color:'var(--ink-2)', fontWeight:800, cursor:'pointer' };

function PromptLabModal({ onClose }) {
  const [lab, setLab] = _plUseState(null);
  const [selectedId, setSelectedId] = _plUseState('');
  const [candidateText, setCandidateText] = _plUseState('');
  const [changeReason, setChangeReason] = _plUseState('');
  const [promotionReason, setPromotionReason] = _plUseState('');
  const [draft, setDraft] = _plUseState(null);
  const [currentRun, setCurrentRun] = _plUseState(null);
  const [rubric, setRubric] = _plUseState({});
  const [busy, setBusy] = _plUseState('');
  const [message, setMessage] = _plUseState('');

  const load = async (keepSelected) => {
    setBusy('load'); setMessage('');
    try {
      const next = await promptLabRequest('bootstrap');
      setLab(next);
      const candidate = (next.versions || []).find((v) => v.status === 'candidate');
      setCandidateText(candidate ? candidate.prompt_body : '');
      const fixtures = next.fixtures || [];
      const wanted = keepSelected && fixtures.some((f) => f.id === keepSelected) ? keepSelected : (fixtures[0] && fixtures[0].id) || '';
      setSelectedId(wanted);
    } catch (e) { setMessage(e.status === 403 ? 'Prompt Lab 권한이 없어요.' : e.message); }
    finally { setBusy(''); }
  };
  _plUseEffect(() => { load(''); }, []);

  const selected = lab && (lab.fixtures || []).find((f) => f.id === selectedId);
  _plUseEffect(() => {
    if (!selected) { setDraft(null); return; }
    const input = selected.input || {};
    setDraft({
      id: selected.id, title: selected.title || '', bookTitle: input.bookTitle || '', author: input.author || '',
      sentence: input.sentence || '', comment: input.comment || '', kind: input.kind === 'thought' ? 'thought' : 'quote',
      userStyle: input.userStyle || '', exchanges: JSON.stringify(input.exchanges || [], null, 2),
      expectedDirection: selected.expected_direction || '', forbiddenResponse: selected.forbidden_response || '',
    });
    const recent = (lab.runs || []).find((r) => r.fixture_id === selected.id);
    setCurrentRun(recent || null); setRubric({});
  }, [selectedId, lab && lab.fixtures]);

  const actor = (lab && lab.actor) || {};
  const versions = (lab && lab.versions) || [];
  const active = versions.find((v) => v.status === 'active');
  const candidate = versions.find((v) => v.status === 'candidate');
  const call = async (name, action, payload, after) => {
    setBusy(name); setMessage('');
    try {
      const result = await promptLabRequest(action, payload);
      setMessage('저장했어요.');
      if (after) after(result);
      await load(selectedId);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(''); }
  };

  const saveCandidate = () => call('candidate', 'candidate_save', { prompt:candidateText, reason:changeReason }, () => setChangeReason(''));
  const saveSandbox = () => {
    if (!draft) return;
    let exchanges;
    try { exchanges = JSON.parse(draft.exchanges || '[]'); if (!Array.isArray(exchanges)) throw new Error(); }
    catch (e) { setMessage('직전 대화는 JSON 배열이어야 해요.'); return; }
    call('sandbox', 'sandbox_save', {
      id: selected && selected.fixture_type === 'sandbox' ? selected.id : null,
      sourceFixtureId: selected && selected.fixture_type === 'baseline' ? selected.id : null,
      title: selected && selected.fixture_type === 'baseline' ? draft.title + ' — sandbox' : draft.title,
      input: { bookTitle:draft.bookTitle, author:draft.author, sentence:draft.sentence, comment:draft.comment, kind:draft.kind, exchanges, userStyle:draft.userStyle },
      expectedDirection:draft.expectedDirection, forbiddenResponse:draft.forbiddenResponse,
    }, (r) => { if (r.fixture && r.fixture.id) setSelectedId(r.fixture.id); });
  };
  const runFixture = async () => {
    if (!selected) return;
    setBusy('run'); setMessage('');
    try {
      const result = await promptLabRequest('run', { fixtureId:selected.id });
      setCurrentRun(result.run); setRubric({}); setMessage('같은 입력으로 두 버전을 실행했어요.');
      setLab((prev) => Object.assign({}, prev, { runs:[result.run].concat((prev.runs || []).filter((r) => r.id !== result.run.id)) }));
    } catch (e) { setMessage(e.status === 502 || e.status === 503 ? '실행 서비스가 잠시 불안정해요.' : e.message); }
    finally { setBusy(''); }
  };
  const setRubricField = (key, field, value) => setRubric((prev) => Object.assign({}, prev, { [key]:Object.assign({}, prev[key] || {}, { [field]:value }) }));
  const saveEvaluation = () => call('evaluate', 'evaluate', { runId:currentRun && currentRun.id, rubric }, () => setRubric({}));
  const versionAction = (action, version) => {
    const reason = promotionReason.trim();
    if (!reason) { setMessage('승격 또는 rollback 이유를 먼저 적어주세요.'); return; }
    call(action, action, { versionId:version.id, reason }, () => setPromotionReason(''));
  };

  const rubricRows = [
    ['context','맥락 이해'], ['depth','후속 질문 깊이'], ['personalization_off','개인화 off 기준선'], ['safety','안전성'], ['tone','말투'],
  ];
  const disabled = !!busy;
  const field = (key, label, rows) => (
    <label style={{display:'block',fontSize:12,fontWeight:800,color:'var(--ink-2)'}}>{label}
      <textarea rows={rows || 2} value={(draft && draft[key]) || ''} readOnly={selected && selected.fixture_type === 'baseline'}
        onChange={(e) => setDraft(Object.assign({}, draft, { [key]:e.target.value }))} style={Object.assign({}, PL_INPUT, {marginTop:6,resize:'vertical'})} />
    </label>
  );

  return (
    <div className="ph-no-capture" style={{position:'fixed',inset:0,zIndex:80,background:'var(--paper)',overflowY:'auto'}} role="dialog" aria-label="Prompt Lab">
      <div style={{maxWidth:980,margin:'0 auto',padding:'calc(16px + var(--safe-top, 0px)) 16px calc(48px + var(--safe-bottom, 0px))'}}>
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:16}}>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:'var(--ink)'}}>Prompt Lab</div>
            <div style={{fontSize:12,color:'var(--ink-3)',marginTop:3}}>합성 fixture만 사용 · candidate는 명시적 테스트에서만 실행</div>
          </div>
          <button onClick={onClose} style={PL_TERTIARY} aria-label="Prompt Lab 닫기">닫기</button>
        </header>
        {message && <div role="status" style={{...PL_CARD,marginBottom:12,padding:12,fontSize:13,color:'var(--ink-2)'}}>{message}</div>}
        {!lab ? <div style={{...PL_CARD,textAlign:'center',color:'var(--ink-3)'}}>{busy ? '불러오는 중…' : 'Prompt Lab을 열 수 없어요.'}</div> : <>
          <section style={{...PL_CARD,marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:12}}>
              <div style={{fontWeight:900}}>Prompt 버전</div>
              <div style={{fontSize:12,color:'var(--ink-3)'}}>@{actor.handle} · {actor.canPromote ? 'promoter' : 'editor / evaluator'}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
              <label style={{fontSize:12,fontWeight:800,color:'var(--ink-2)'}}>Active v{active ? active.version_no : '—'}
                <textarea readOnly rows="12" value={(active && active.prompt_body) || ''} style={{...PL_INPUT,marginTop:6,resize:'vertical'}} />
              </label>
              <label style={{fontSize:12,fontWeight:800,color:'var(--ink-2)'}}>Candidate v{candidate ? candidate.version_no : '—'}
                <textarea readOnly={!actor.canEdit} rows="12" value={candidateText} onChange={(e) => setCandidateText(e.target.value)} style={{...PL_INPUT,marginTop:6,resize:'vertical'}} />
              </label>
            </div>
            {actor.canEdit && <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
              <input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="변경 이유" style={{...PL_INPUT,flex:'1 1 260px'}} />
              <button disabled={disabled} onClick={saveCandidate} style={PL_PRIMARY}>Candidate 새 버전 저장</button>
            </div>}
            {actor.canPromote && <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
              <input value={promotionReason} onChange={(e) => setPromotionReason(e.target.value)} placeholder="승격 또는 rollback 이유" style={{...PL_INPUT,flex:'1 1 260px'}} />
            </div>}
            {actor.canPromote && candidate && <div style={{marginTop:10}}>
              <button disabled={disabled} onClick={() => versionAction('promote', candidate)} style={PL_PRIMARY}>Candidate를 active로 승격</button>
            </div>}
          </section>

          <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,marginBottom:16}}>
            <div style={PL_CARD}>
              <div style={{fontWeight:900,marginBottom:10}}>합성 fixture</div>
              {['baseline','sandbox'].map((type) => <div key={type} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:900,color:'var(--ink-3)',marginBottom:6}}>{type === 'baseline' ? 'IMMUTABLE BASELINE' : 'EDITABLE SANDBOX'}</div>
                {(lab.fixtures || []).filter((f) => f.fixture_type === type).map((f) => <button key={f.id} onClick={() => setSelectedId(f.id)}
                  style={{display:'block',width:'100%',textAlign:'left',marginBottom:6,border:'1px solid var(--line)',borderRadius:12,padding:'9px 10px',background:f.id === selectedId ? 'var(--brand-soft)' : 'var(--card-soft)',color:f.id === selectedId ? 'var(--brand-3)' : 'var(--ink-2)',fontWeight:800,cursor:'pointer'}}>{f.title}</button>)}
              </div>)}
            </div>
            <div style={PL_CARD}>
              {!draft || !selected ? <div style={{color:'var(--ink-3)'}}>fixture를 선택하세요.</div> : <>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:12}}>
                  <div><div style={{fontWeight:900}}>{selected.fixture_type === 'baseline' ? 'Baseline 상세' : 'Sandbox 편집'}</div><div style={{fontSize:11,color:'var(--ink-3)',marginTop:2}}>실제 사용자 기록·대화·개인정보 입력 금지</div></div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
                    {actor.canEdit && <button disabled={disabled} onClick={saveSandbox} style={PL_SECONDARY}>{selected.fixture_type === 'baseline' ? 'Sandbox로 복제' : 'Sandbox 저장'}</button>}
                    {actor.canEdit && selected.fixture_type === 'sandbox' && <button disabled={disabled} onClick={() => call('delete','sandbox_delete',{id:selected.id})} style={PL_TERTIARY}>삭제</button>}
                    {actor.canPromote && selected.fixture_type === 'sandbox' && <button disabled={disabled} onClick={() => call('baseline','baseline_promote',{id:selected.id})} style={PL_PRIMARY}>Baseline으로 승격</button>}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                  {field('title','이름',1)} {field('bookTitle','가상 책 제목',1)} {field('author','가상 저자',1)}
                  <label style={{fontSize:12,fontWeight:800,color:'var(--ink-2)'}}>입력 종류
                    <select disabled={selected.fixture_type === 'baseline'} value={draft.kind} onChange={(e) => setDraft({...draft,kind:e.target.value})} style={{...PL_INPUT,marginTop:6}}><option value="quote">인용</option><option value="thought">생각</option></select>
                  </label>
                </div>
                <div style={{display:'grid',gap:10,marginTop:10}}>
                  {field('sentence','합성 한 문장',3)} {field('comment','합성 메모',3)} {field('userStyle','합성 사용자 스타일',2)}
                  {field('exchanges','직전 합성 대화 JSON 배열',4)} {field('expectedDirection','기대 방향',3)} {field('forbiddenResponse','금지 반응',3)}
                </div>
                {actor.canEdit && <button disabled={disabled} onClick={runFixture} style={{...PL_PRIMARY,marginTop:12,width:'100%'}}>{busy === 'run' ? '같은 입력 실행 중…' : 'Active vs Candidate 같은 입력 실행'}</button>}
              </>}
            </div>
          </section>

          {currentRun && <section style={{...PL_CARD,marginBottom:16}}>
            <div style={{fontWeight:900,marginBottom:10}}>Side-by-side 결과</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
              <div style={{...PL_CARD,background:'var(--card-soft)'}}><div style={{fontSize:11,fontWeight:900,color:'var(--ink-3)',marginBottom:8}}>ACTIVE</div><div style={{whiteSpace:'pre-wrap',lineHeight:1.65}}>{currentRun.active_output}</div></div>
              <div style={{...PL_CARD,background:'var(--brand-tint)'}}><div style={{fontSize:11,fontWeight:900,color:'var(--brand-3)',marginBottom:8}}>CANDIDATE</div><div style={{whiteSpace:'pre-wrap',lineHeight:1.65}}>{currentRun.candidate_output}</div></div>
            </div>
            {actor.canEdit && <div style={{marginTop:14}}>
              <div style={{fontWeight:900,marginBottom:8}}>Rubric 평가</div>
              {rubricRows.map(([key,label]) => <div key={key} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,alignItems:'center',marginBottom:8}}>
                <label style={{fontSize:12,fontWeight:800}}>{label}</label>
                <select value={(rubric[key] && rubric[key].score) || ''} onChange={(e) => setRubricField(key,'score',Number(e.target.value))} style={PL_INPUT}><option value="">점수</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                <input value={(rubric[key] && rubric[key].comment) || ''} onChange={(e) => setRubricField(key,'comment',e.target.value)} placeholder="근거 코멘트" style={PL_INPUT} />
              </div>)}
              <button disabled={disabled} onClick={saveEvaluation} style={PL_SECONDARY}>평가 저장</button>
            </div>}
          </section>}

          <section style={{...PL_CARD,marginBottom:16}}>
            <div style={{fontWeight:900,marginBottom:10}}>버전 기록</div>
            {versions.map((v) => <div key={v.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:'1px solid var(--line-2)'}}>
              <div><span style={{fontWeight:900}}>v{v.version_no}</span> <span style={{fontSize:11,color:'var(--ink-3)'}}>{v.status}</span><div style={{fontSize:12,color:'var(--ink-2)',marginTop:2}}>{v.change_reason || '변경 이유 없음'}</div></div>
              {actor.canPromote && v.status === 'archived' && <button disabled={disabled} onClick={() => versionAction('rollback',v)} style={PL_SECONDARY}>이 버전으로 rollback</button>}
            </div>)}
          </section>

          <section style={PL_CARD}>
            <div style={{fontWeight:900,marginBottom:10}}>Audit trail</div>
            {(lab.audit || []).length === 0 ? <div style={{fontSize:12,color:'var(--ink-3)'}}>아직 기록이 없어요.</div> : (lab.audit || []).map((a) => <div key={a.id} style={{fontSize:12,color:'var(--ink-2)',padding:'6px 0',borderBottom:'1px solid var(--line-2)'}}><b>{a.action}</b> · {String(a.created_at || '').replace('T',' ').slice(0,16)}</div>)}
          </section>
        </>}
      </div>
    </div>
  );
}
window.PromptLabModal = PromptLabModal;
