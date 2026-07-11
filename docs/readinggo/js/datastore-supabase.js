/* =========================================================
   ReadingGo — datastore-supabase.js  (Phase 1, B3)
   backend.md §7.2 DataStore 계약을 supabase-js 로 구현 (schema.sql 위).

   로드 순서: supabase-js CDN → config.js → supabase-client.js → 이 파일.
   전환(B4/통합): 로그인+설정 시  window.DataStore = window.SupabaseDataStore
   → localStorageAdapter 와 같은 메서드 표면이되 **async(Promise)**. UI 는 await 필요.

   ⚠️ 브라우저 런타임 미검증 (JSX 데모를 헤드리스로 못 돌림). schema/contract 기준 작성.
      특히 FK embed(중첩 join)·RLS 상호작용은 브라우저 QA 에서 확인.
   ========================================================= */
(function () {
  function sb() {
    const c = window.RG_SB && window.RG_SB.client && window.RG_SB.client();
    if (!c) throw new Error('Supabase 클라이언트 미초기화 (RG_SB/config 로드 확인)');
    return c;
  }
  function unwrap(res) { if (res && res.error) throw res.error; return res ? res.data : null; }

  let _uid = null;
  async function uid() {
    if (_uid) return _uid;
    // getSession()(로컬, 무네트워크) — getUser()는 네트워크 검증이라 모바일에서 쿼리 user-id가
    // null로 떨어져 RLS 빈 결과/게스트 고착의 원인이 됨 (#646). onAuthChange 가 _uid 동기 유지.
    const { data } = await sb().auth.getSession();
    _uid = (data && data.session && data.session.user) ? data.session.user.id : null;
    return _uid;
  }
  if (window.RG_SB && window.RG_SB.onAuthChange) {
    window.RG_SB.onAuthChange(u => { _uid = u ? u.id : null; });
  }

  function _today() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function _dayDiff(from, to) {
    return Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000);
  }
  // 방 초대 토큰 (co-reading.md §6.4) — 추측 불가한 충분 길이(≈26자) 랜덤. URL-safe(영숫자).
  // crypto.getRandomValues 우선, 미지원 시 Math.random 폴백. UNIQUE 충돌은 create 가 재시도.
  function _roomToken() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const len = 26;
    let out = '';
    try {
      const buf = new Uint8Array(len);
      (window.crypto || window.msCrypto).getRandomValues(buf);
      for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
    } catch (e) {
      for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }
  // 추천 점수 (#787) — claps 임베드 count 추출 + 신선도 감쇠 + 좋아요 가중.
  // 데이터가 적으면 clap=0 → log항=0 → freshness(최신순)로 수렴 → 저트래픽서도 안전.
  function _clapCount(r) { return (r && r.clap_count && r.clap_count[0] && r.clap_count[0].count) || 0; }
  function _recScore(r) {
    const W = (window.RG_CONFIG && window.RG_CONFIG.FEED_RECOMMEND) || {};
    const halfLife = W.halfLifeDays || 10, clapW = (W.clapWeight == null ? 1.2 : W.clapWeight);
    const t = typeof r.created_at === 'number' ? r.created_at : (Date.parse(r.created_at) || 0);
    const ageDays = Math.max(0, (Date.now() - t) / 86400000);
    const freshness = Math.pow(0.5, ageDays / halfLife);   // 1(방금)→0.5(반감기)→…
    return freshness + Math.log1p(_clapCount(r)) * clapW;
  }
  // 책 정보 수정(#410/#431) — user_books.publisher_override/total_pages_override를
  // ub.book.publisher/total_pages에 병합. books(공유 카탈로그)는 그대로 유지.
  function _applyBookOverrides(ub) {
    if (!ub || !ub.book) return ub;
    if (ub.publisher_override == null && ub.total_pages_override == null) return ub;
    return {
      ...ub,
      book: {
        ...ub.book,
        publisher: ub.publisher_override != null ? ub.publisher_override : ub.book.publisher,
        total_pages: ub.total_pages_override != null ? ub.total_pages_override : ub.book.total_pages,
      },
    };
  }

  const A = {
    /* 인증 — supabase-client.js(RG_SB) 위임 */
    auth: {
      currentUser() { return window.RG_SB.currentUser(); },
      signInWithOAuth(provider) { return window.RG_SB.signInWithOAuth(provider); }, // #937 provider 일반화
      signInWithGoogle() { return window.RG_SB.signInWithGoogle(); },
      signInWithKakao() { return window.RG_SB.signInWithKakao(); },   // #937
      signInWithApple() { return window.RG_SB.signInWithApple(); },   // #937
      signOut() { return window.RG_SB.signOut(); },
    },

    /* 프로필 / 설정 (public.users) */
    profile: {
      async get(userId) {
        const id = userId || await uid();
        if (!id) return null;
        return unwrap(await sb().from('users').select('*').eq('id', id).maybeSingle());
      },
      async update(fields) {
        const id = await uid();
        return unwrap(await sb().from('users').update(fields).eq('id', id).select().single());
      },
    },
    settings: {
      async get() { const u = await A.profile.get(); return (u && u.settings) || {}; },
      async update(patch) {
        const cur = await A.settings.get();
        return A.profile.update({ settings: { ...cur, ...patch } });
      },
    },

    /* 책 / 검색 / 완독 */
    books: {
      async search(query) {
        if (!query) return [];
        return unwrap(await sb().from('books').select('*').ilike('title', '%' + query + '%').limit(20));
      },
      async getById(id) {
        if (!id) return null;
        return unwrap(await sb().from('books').select('*').eq('id', id).maybeSingle());
      },
      async get(bookId) {
        return unwrap(await sb().from('books').select('*').eq('id', bookId).single());
      },
      // 알라딘 결과 등 외부 책을 books 에 upsert (isbn13 기준) → 등록 흐름.
      // #1191: 옛 클라 직접 RLS write(books_ins/upd = auth.uid() is not null)는 로그인만 하면
      //   누구나 카탈로그를 오염시킬 수 있었다. 이제 워커 /api/book-upsert(service_role, 입력검증·캡·
      //   레이트리밋) 경유. 반환 shape(캐노니컬 books 행 전체 + id)은 동일 — 호출부 4곳 무변경.
      async upsert(book) {
        const res = await fetch('/api/book-upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isbn13: book.isbn13, title: book.title, author: book.author,
            publisher: book.publisher, total_pages: book.total_pages, cover_url: book.cover_url,
          }),
        });
        if (!res.ok) throw new Error('book-upsert 실패: ' + res.status);
        return await res.json();
      },
      // 완독 → status='completed' (+rating/review_text). 성 직접 지급 없음 — 성(🏰)은 XP 주기 파생(castles.list, #520/#521).
      async complete(userBookId, opts) {
        opts = opts || {};
        const patch = { status: 'completed', completed_at: new Date().toISOString() };
        if (typeof opts.rating !== 'undefined') patch.rating = opts.rating;
        if (typeof opts.review_text !== 'undefined') patch.review_text = opts.review_text;
        return unwrap(await sb().from('user_books').update(patch).eq('id', userBookId).select().single());
      },
      // 참새 완독 회고 캐시 (#352) — user_books.companion_recap. 본인 행만(RLS ub_mod).
      async saveRecap(userBookId, recap) {
        const id = await uid();
        return unwrap(await sb().from('user_books').update({ companion_recap: recap || null })
          .eq('id', userBookId).eq('user_id', id).select().single());
      },
      // social.md §5.7 "이번 주 신규 시작러 Top3" — 공개 집계 RPC(17_social_newcomers.sql).
      async startedThisWeek(lim = 3) {
        const rows = unwrap(await sb().rpc('social_newcomers_weekly', { lim }));
        return (rows || []).map((x) => ({ bookId: x.book_id, title: x.title, author: x.author, cover_url: x.cover_url, starters: Number(x.starters) || 0 }));
      },
      // 관련 도서 추천 (#496) — localStorage 어댑터와 표면 일치(§7.2).
      // Phase 0: LLM 추천(worker /api/related) + 실존 매칭. data.js recommendRelated 위임.
      // TODO(Phase 1): user_books 공동독서 집계 RPC(예: books_also_read)로 '함께 읽은 사람들' 강화.
      related(book, limit) {
        return window.recommendRelated ? window.recommendRelated(book, limit) : Promise.resolve([]);
      },
    },

    /* 내 책 / 활성 책 */
    myBooks: {
      async list() {
        const id = await uid();
        const rows = unwrap(await sb().from('user_books').select('*, book:books(*)')
          .eq('user_id', id).order('started_at', { ascending: false }));
        return (rows || []).map(_applyBookOverrides);
      },
      async add({ book, current_page, status, rating, activate }) {
        const id = await uid();
        const bk = book && book.id ? book : await A.books.upsert(book);
        // #772 서가 복원: status='completed'면 완독으로(completed_at·진척 100%). 기본 'reading'.
        const st = (status === 'completed') ? 'completed' : 'reading';
        const tp = (bk && bk.total_pages) || (book && book.total_pages) || 0;
        const ins = {
          user_id: id, book_id: bk.id, status: st,
          current_page: st === 'completed' ? (tp || current_page || 0) : (current_page || 0),
        };
        if (st === 'completed') ins.completed_at = new Date().toISOString();
        // 별점(#1042 스샷 비전 추출) — 0.5~5.0, 0.5 단위로 스냅(ub_rating_range CHECK 준수). local 어댑터와 표면 일치.
        const rn = Number(rating);
        if (Number.isFinite(rn) && rn > 0) ins.rating = Math.min(5, Math.max(0.5, Math.round(rn * 2) / 2));
        const row = unwrap(await sb().from('user_books').insert(ins).select('*, book:books(*)').single());
        // 새 '읽기 시작' 책은 자동으로 활성 책 전환 (#1196, Edgar 피드백) — resume 처럼 profile.update.
        // status='reading' 만(완독 담기·찜 제외). addBatch 는 activate:false 로 대량복원 하이재킹 방지.
        // active-set 실패가 등록 자체를 되돌리지 않게 방어(책은 이미 저장됨).
        if (st === 'reading' && activate !== false) {
          try { await A.profile.update({ active_user_book_id: row.id }); } catch (e) {}
        }
        return _applyBookOverrides(row);
      },
      // 스샷 서가 복원 (#772·#1038·#1042) — 책 목록 일괄 등록. items: [{book, status, rating?}]. 개별 실패는 스킵(무중단).
      // status 라우팅: 'wish' → books.upsert 로 캐노니컬 id 확보 후 wish_books(위시 UX 일치),
      //   그 외('completed'/'reading') → user_books(add 재사용). local 어댑터와 표면 일치.
      // rating(#1042): user_books 경로만 별점 보존(wish_books 엔 별점 컬럼 없음 → 무시).
      async addBatch(items) {
        const list = Array.isArray(items) ? items : [];
        const out = [];
        for (const it of list) {
          if (!it || !it.book) continue;
          try {
            if (it.status === 'wish') {
              // 검색 raw id(b001/외서)는 books 행이 없어 wish_books FK 위반 → upsert 로 캐노니컬 id 확보(#552 선례).
              const isUuid = it.book.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(it.book.id));
              const bk = isUuid ? it.book : await A.books.upsert(it.book);
              if (bk && bk.id) { await A.wishBooks.add(bk.id); out.push({ book_id: bk.id, book: bk }); }
            } else {
              out.push(await this.add({ book: it.book, status: it.status, rating: it.rating, activate: false }));
            }
          } catch (e) { /* 개별 실패 스킵 */ }
        }
        return out;
      },
      // 책 메타 수정 (출판사·페이지수, #410/#431) — user_books override 컬럼에 저장.
      // books(공유 카탈로그)는 수정하지 않음 — 다른 유저에게 전파되면 안 됨.
      async updateBook(userBookId, fields) {
        fields = fields || {};
        const patch = {};
        if (fields.publisher !== undefined) patch.publisher_override = fields.publisher;
        if (fields.total_pages !== undefined) patch.total_pages_override = Number(fields.total_pages) || 0;
        const row = unwrap(await sb().from('user_books').update(patch).eq('id', userBookId)
          .select('*, book:books(*)').maybeSingle());
        return row ? _applyBookOverrides(row) : null;
      },
      // 읽던 책 중단 (#593) — status='aborted'. current_page 보존(되돌리기 가능),
      // 활성 책이면 active 해제 → "중단" 탭으로 이동.
      // 활성 책 중단 시 남은 '읽는 중' 책으로 active 승계 (#643) — 홈이 빈 상태로 떨어지지 않게.
      // 승계 대상은 가장 최근 시작한 reading 책(started_at desc, 캐러셀 순서와 일치). 없으면 null.
      async abort(userBookId) {
        const u = await A.profile.get();
        const row = unwrap(await sb().from('user_books').update({ status: 'aborted' }).eq('id', userBookId)
          .select('*, book:books(*)').maybeSingle());
        if (u && u.active_user_book_id === userBookId) {
          const id = await uid();
          const next = unwrap(await sb().from('user_books').select('id')
            .eq('user_id', id).eq('status', 'reading').neq('id', userBookId)
            .order('started_at', { ascending: false }).limit(1).maybeSingle());
          await A.profile.update({ active_user_book_id: next ? next.id : null });
        }
        return row ? _applyBookOverrides(row) : null;
      },
      // 중단 책 다시 읽기 (#593) — 'aborted' → 'reading'. completed_at 미설정(완독과 무관).
      async resume(userBookId) {
        const row = unwrap(await sb().from('user_books').update({ status: 'reading' }).eq('id', userBookId)
          .select('*, book:books(*)').maybeSingle());
        // #1203: 다시 읽기 = 이 책을 활성으로 승계 — 홈이 즉시 이 책을 띄우고 새로고침 후에도 유지(중단 탭에 남지 않음).
        if (row) { try { await A.profile.update({ active_user_book_id: userBookId }); } catch (e) {} }
        return row ? _applyBookOverrides(row) : null;
      },
      // 잘못 담은 책 완전 삭제 (#1195, Edgar 피드백) — abort(중단, 되돌리기)와 달리 user_books 행 영구 삭제.
      // 문장(sentences)·세션(reading_sessions)은 FK on delete cascade 로 함께 제거된다(schema.sql).
      // 활성 책이면 **삭제 전에** 남은 '읽는 중' 책으로 active 승계(#643 abort 동일) —
      // 그냥 지우면 active_user_book_id FK 가 set null 로 떨어져 홈이 빈 상태가 된다.
      async remove(userBookId) {
        const u = await A.profile.get();
        if (u && u.active_user_book_id === userBookId) {
          const id = await uid();
          const next = unwrap(await sb().from('user_books').select('id')
            .eq('user_id', id).eq('status', 'reading').neq('id', userBookId)
            .order('started_at', { ascending: false }).limit(1).maybeSingle());
          await A.profile.update({ active_user_book_id: next ? next.id : null });
        }
        await sb().from('user_books').delete().eq('id', userBookId);
        return { id: userBookId };
      },
    },
    activeBook: {
      async get() {
        const u = await A.profile.get();
        if (!u || !u.active_user_book_id) return null;
        const row = unwrap(await sb().from('user_books').select('*, book:books(*)').eq('id', u.active_user_book_id).maybeSingle());
        return row ? _applyBookOverrides(row) : null;
      },
      async set(userBookId) { await A.profile.update({ active_user_book_id: userBookId }); return userBookId; },
    },

    /* 일일 기록 (세션) — 그날 1행 upsert + 스트릭 bump */
    sessions: {
      async addToday({ userBookId, page, duration_sec }) {
        const id = await uid();
        const today = _today();
        // 활동 히트맵(#195)용 일별 읽은 쪽수: 직전 current_page 대비 증분을 그날 누적.
        // #1203 재독: 입력 page 가 현재 진도보다 낮아도 current_page 를 그 값으로 덮어씀(아래).
        //   증분(delta)은 0으로 클램프해 히트맵에 음수가 들어가지 않게 한다(재독은 쪽수 추가 아님).
        let pagesToday = 0;
        let durationToday = (typeof duration_sec === 'number' && duration_sec > 0) ? duration_sec : 0;
        if (typeof page === 'number') {
          try {
            const ub = unwrap(await sb().from('user_books').select('current_page').eq('id', userBookId).maybeSingle());
            const delta = Math.max(0, page - ((ub && ub.current_page) || 0));
            const prev = unwrap(await sb().from('reading_sessions').select('pages_read_today, duration_sec').eq('user_book_id', userBookId).eq('session_date', today).maybeSingle());
            pagesToday = ((prev && prev.pages_read_today) || 0) + delta;
            durationToday += (prev && prev.duration_sec) || 0;
          } catch (e) {}
          await sb().from('user_books').update({ current_page: page }).eq('id', userBookId);
        }
        const row = unwrap(await sb().from('reading_sessions').upsert({
          user_book_id: userBookId, user_id: id, session_date: today, current_page: page, pages_read_today: pagesToday, duration_sec: durationToday,
        }, { onConflict: 'user_book_id,session_date' }).select().single());
        await A.streak.bumpOnCheckIn();
        return row;
      },
      async list(userBookId) {
        return unwrap(await sb().from('reading_sessions').select('*').eq('user_book_id', userBookId)
          .order('session_date', { ascending: false }));
      },
      // 스트릭 캘린더용 — 최근 days 일의 읽은 날짜 + 방패 쓴 날짜 (#173)
      async calendar(days) {
        const id = await uid();
        const since = new Date(Date.now() - (days || 35) * 86400 * 1000).toISOString().slice(0, 10);
        let readDates = [], shieldDates = [];
        try {
          const sess = unwrap(await sb().from('reading_sessions').select('session_date').eq('user_id', id).gte('session_date', since));
          readDates = (sess || []).map(r => r.session_date);
        } catch (e) {}
        try {
          const sh = unwrap(await sb().from('shield_log').select('consumed_at').eq('user_id', id).gte('consumed_at', since));
          shieldDates = (sh || []).map(r => String(r.consumed_at).slice(0, 10));
        } catch (e) {}
        return { readDates, shieldDates };
      },
      // 활동 히트맵(#195) — 최근 days 일, 날짜별 읽은 쪽수 합계. [{date, pages}]
      async heatmap(days) {
        const id = await uid();
        const since = new Date(Date.now() - (days || 180) * 86400 * 1000).toISOString().slice(0, 10);
        const rows = unwrap(await sb().from('reading_sessions').select('session_date, pages_read_today')
          .eq('user_id', id).gte('session_date', since)) || [];
        const byDate = {};
        rows.forEach((r) => { byDate[r.session_date] = (byDate[r.session_date] || 0) + (r.pages_read_today || 0); });
        return Object.keys(byDate).map((date) => ({ date, pages: byDate[date] }));
      },
    },

    /* 한 문장 (sentences) */
    sentences: {
      async add({ userBookId, sessionId, page, text, my_note, kind }) {
        // #565: userBookId 없이는 insert 금지 — 무효/누락 ID 로 조용히 잘못 저장하지 않는다(명확히 실패).
        if (!userBookId) throw new Error('sentences.add: userBookId 필요 (#565)');
        const id = await uid();
        return unwrap(await sb().from('sentences').insert({
          user_id: id, user_book_id: userBookId, session_id: sessionId || null,
          page: (typeof page === 'number') ? page : null, text: text || '', my_note: my_note || null,
          kind: 'quote',   // '내 생각'(thought) 폐기 — 항상 인용(quote) (#596)
        }).select().single());
      },
      // 사후 감상 추가·편집 (작성 시점 무관) — profile §5.8.4
      async setNote(sentenceId, my_note) {
        return unwrap(await sb().from('sentences').update({ my_note }).eq('id', sentenceId).select().single());
      },
      // 한 문장 본문 편집 (오타 수정, #325) — 본인 행만(RLS)
      async updateText(sentenceId, text) {
        return unwrap(await sb().from('sentences').update({ text: text || '' }).eq('id', sentenceId).eq('user_id', await uid()).select().single());
      },
      // 한 문장 페이지 번호 편집 (#683) — 본인 행만(RLS). null = 페이지 미상.
      async setPage(sentenceId, page) {
        const p = (typeof page === 'number' && isFinite(page)) ? page : null;
        return unwrap(await sb().from('sentences').update({ page: p }).eq('id', sentenceId).eq('user_id', await uid()).select().single());
      },
      // 종류 변경 인용↔내 의견 (#381) — 본인 행만(RLS)
      async setKind(sentenceId, kind) {
        const k = kind === 'thought' ? 'thought' : 'quote';
        return unwrap(await sb().from('sentences').update({ kind: k }).eq('id', sentenceId).eq('user_id', await uid()).select().single());
      },
      // 한 문장 삭제 — 본인 행만(RLS). 연결된 companion_sessions 는 FK 정리 정책에 위임.
      async remove(sentenceId) {
        unwrap(await sb().from('sentences').delete().eq('id', sentenceId).eq('user_id', await uid()));
        return true;
      },
      // 한 문장/감상 공개·비공개 토글 (QA #12).
      // patch: { visibility?: 'public'|'followers'|'private', note_private?: boolean }
      // note_private(감상 비공개)는 유지. is_private는 deprecated — visibility로 대체(v7.2).
      async setVisibility(sentenceId, patch) {
        // patch: { visibility?: 'public'|'followers'|'private', note_private?: boolean }
        return unwrap(await sb().from('sentences').update(patch).eq('id', sentenceId).eq('user_id', await uid()).select().single());
      },
      async listByBook(userBookId) {
        return unwrap(await sb().from('sentences').select('*').eq('user_book_id', userBookId)
          .order('created_at', { ascending: false }));
      },
      async listMine() {
        const id = await uid();
        // book_id 는 sentences 에 없음 → user_book 임베드로 해소(무작위회상·책상세 타임라인용).
        return unwrap(await sb().from('sentences').select('*, user_book:user_books(book_id, book:books(title))').eq('user_id', id)
          .order('created_at', { ascending: false }));
      },
      // 시간차 되감기 후보 (#346, resurface.md §2) — Q/A 저장 문장, 14일+ 경과, 재소환 14일+ 미경과 제외.
      // 우선순위: 가장 긴 내 답변 → 동률 랜덤. (책 단위 7일 조건은 후속)
      async resurfaceCandidate() {
        const id = await uid();
        const now = Date.now(), TH = 14 * 86400000;
        const since = new Date(now - TH).toISOString();
        const rows = unwrap(await sb().from('sentences')
          .select('*, user_book:user_books(book_id, book:books(title))')
          .eq('user_id', id).not('my_note', 'is', null).lte('created_at', since)
          .or(`last_resurfaced_at.is.null,last_resurfaced_at.lte.${since}`)
          .limit(100));
        const cands = [];
        (rows || []).forEach(se => {
          const note = se.my_note || '';
          if (!/(^|\n)Q\.\s/.test(note) || !/(^|\n)A\.\s/.test(note)) return; // 답변 없는 문장 제외
          const answers = [...note.matchAll(/(^|\n)A\.\s([\s\S]*?)(?=\nQ\.|\n\n|$)/g)].map(m => (m[2] || '').trim());
          cands.push({
            id: se.id, text: se.text,
            bookId: (se.user_book && se.user_book.book_id) || '',
            bookTitle: (se.user_book && se.user_book.book && se.user_book.book.title) || '',
            page: se.page, note, kind: se.kind || 'quote',
            daysAgo: Math.floor((now - Date.parse(se.created_at)) / 86400000),
            lastAnswer: answers[answers.length - 1] || '',
            _longest: Math.max(0, ...answers.map(a => a.length)),
          });
        });
        if (!cands.length) return null;
        const best = Math.max(...cands.map(c => c._longest));
        const top = cands.filter(c => c._longest === best);
        return top[Math.floor(Math.random() * top.length)];
      },
      async markResurfaced(sentenceId) {
        unwrap(await sb().from('sentences').update({ last_resurfaced_at: new Date().toISOString() })
          .eq('id', sentenceId).eq('user_id', await uid()));
        return true;
      },
      // 전체 공개 피드 (§social). 책 제목은 user_books→books 중첩 embed.
      async feed({ cursor, limit } = {}) {
        let q = sb().from('sentences_public')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books(book:books(id,title,cover_url,author))')
          .order('created_at', { ascending: false }).limit(limit || 30);
        if (cursor) q = q.lt('created_at', cursor);
        return unwrap(await q);
      },
      // 팔로우 피드 — 내가 팔로우한 사용자들의 한 문장만 (#7)
      async feedFollowing({ limit } = {}) {
        const id = await uid();
        const f = unwrap(await sb().from('follows').select('following_id').eq('follower_id', id)) || [];
        const ids = f.map(x => x.following_id);
        if (!ids.length) return [];
        return unwrap(await sb().from('sentences_public')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books(book:books(id,title,cover_url,author))')
          .in('user_id', ids).order('created_at', { ascending: false }).limit(limit || 30));
      },
      // 같은 책 피드 — 특정 책의 *다른* 사용자 한 문장 (둥지 '같은 책 읽는 사람들', NPC 포함, #1)
      async byBook(bookId, { limit, sort } = {}) {
        // 데모 book id('b008' 등) 비-UUID 방어 — uuid 컬럼 질의 400 방지.
        if (!bookId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId)) return [];
        const me = await uid();
        // sort='likes'(#594): 짹 많은 순. PostgREST 임베드 집계(claps(count))를 받아 클라에서 정렬·슬라이스
        // (임베드 aggregate 정렬은 PostgREST에서 불안정 → 후보 풀을 넉넉히 받아 JS 정렬). 기본 'recent'(최신순).
        const likes = sort === 'likes';
        const pool = likes ? 50 : (limit || 10);
        let q = sb().from('sentences_public')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books!inner(book_id, book:books(id,title,cover_url,author)), clap_count:claps(count)')
          .eq('user_book.book_id', bookId)
          .order('created_at', { ascending: false }).limit(pool);
        if (me) q = q.neq('user_id', me);
        let rows = unwrap(await q) || [];
        rows = rows.map(r => ({ ...r, clapCount: (r.clap_count && r.clap_count[0] && r.clap_count[0].count) || 0 }));
        if (likes) { rows.sort((a, b) => b.clapCount - a.clapCount); rows = rows.slice(0, limit || 5); }
        return rows;
      },
      // 무작위 회상 — 내 과거 한 문장 1개 (profile §5.8.7)
      // 추천 (#787, v9) — 좋아요·신선도 점수 랭킹 + 계층 충전(backfill). 항상 N개를 채워 빈 화면을 막는다.
      //   Tier1 같은 책 읽는 타인(점수 랭킹) → Tier2 인기 문장(좋아요순) → Tier3 최근 피드.
      //   7일 하드컷 폐기(신선도 감쇠로 대체) + NPC/시드 문장 풀 포함(sentences 전체 조회). feed.md §추천 알고리즘.
      async feedRecommended({ limit } = {}) {
        const N = limit || 50;
        const W = (window.RG_CONFIG && window.RG_CONFIG.FEED_RECOMMEND) || {};
        const pool = W.poolSize || 120;
        const me = await uid();
        const seen = new Set(), out = [];
        // Tier1: 같은 책(!inner) + 좋아요 임베드. Tier2: 전체 공개(outer join) + 좋아요 임베드.
        const SEL_CORE = '*, user:users(handle,display_name,avatar_url), user_book:user_books!inner(book_id, book:books(id,title,cover_url,author)), clap_count:claps(count)';
        const SEL_POP = '*, user:users(handle,display_name,avatar_url), user_book:user_books(book:books(id,title,cover_url,author)), clap_count:claps(count)';
        const take = (rows) => {
          for (const r of (rows || [])) {
            if (!r || seen.has(r.id)) continue;
            seen.add(r.id); out.push(r);
            if (out.length >= N) break;
          }
        };
        // Tier 1 — 추천 코어: 내 서재 책을 읽는 타인 문장, 좋아요+신선도 점수 랭킹
        const mine = unwrap(await sb().from('user_books').select('book_id').eq('user_id', me));
        const bookIds = [...new Set((mine || []).map(r => r.book_id).filter(Boolean))];
        if (bookIds.length) {
          let q = sb().from('sentences_public').select(SEL_CORE)
            .in('user_book.book_id', bookIds)
            .order('created_at', { ascending: false }).limit(pool);
          if (me) q = q.neq('user_id', me);
          const rows = (unwrap(await q) || []).slice().sort((a, b) => _recScore(b) - _recScore(a));
          take(rows);
        }
        // Tier 2 — 부족분 충전: 전체 공개 문장 중 좋아요 많은 순(동률 최신). RLS가 공개범위 필터.
        if (out.length < N) {
          let q = sb().from('sentences_public').select(SEL_POP)
            .order('created_at', { ascending: false }).limit(pool);
          if (me) q = q.neq('user_id', me);
          const rows = (unwrap(await q) || []).slice()
            .sort((a, b) => (_clapCount(b) - _clapCount(a)) || (String(b.created_at) > String(a.created_at) ? 1 : -1));
          take(rows);
        }
        // Tier 3 — 그래도 부족: 최근 전체 피드(내 문장 포함 가능)
        if (out.length < N) take(await A.sentences.feed({ limit: N }));
        return out.slice(0, N);
      },
      async random() {
        const mine = await A.sentences.listMine();
        if (!mine || !mine.length) return null;
        return mine[Math.floor(Math.random() * mine.length)];
      },
    },

    /* 시간차 되감기 노출 게이트 (#346, resurface.md §2.1·§4.2) — 1일 1회.
       기기 로컬 넛지 억제라 localStorage 키 rg_resurface_last 사용(서버 저장 불필요). */
    resurface: {
      shownToday() { try { return localStorage.getItem('rg_resurface_last') === _today(); } catch (e) { return false; } },
      markToday() { try { localStorage.setItem('rg_resurface_last', _today()); } catch (e) {} },
    },

    /* 마일스톤 회고 노출 게이트 (#938, A2) — localStorage 어댑터와 표면 일치. 기기 로컬 빈도 가드(서버 저장 불필요).
       ① 같은 key 1회만 ② 하루 1회. rg_milestone_seen(JSON) + rg_milestone_last(YYYY-MM-DD). */
    milestone: {
      _seen() { try { return JSON.parse(localStorage.getItem('rg_milestone_seen') || '{}') || {}; } catch (e) { return {}; } },
      shouldShow(key) {
        if (!key) return false;
        try {
          if (this._seen()[key]) return false;
          if (localStorage.getItem('rg_milestone_last') === _today()) return false;
          return true;
        } catch (e) { return false; }
      },
      markShown(key) {
        try {
          const seen = this._seen(); if (key) seen[key] = _today();
          localStorage.setItem('rg_milestone_seen', JSON.stringify(seen));
          localStorage.setItem('rg_milestone_last', _today());
        } catch (e) {}
      },
    },

    /* 스트릭 (클라 날짜 로직) / XP */
    streak: {
      async get() {
        const id = await uid();
        return unwrap(await sb().from('streak').select('*').eq('user_id', id).maybeSingle());
      },
      async bumpOnCheckIn() {
        const id = await uid();
        const today = _today();
        const st = await A.streak.get();
        if (!st) return null;
        if (st.last_check_in_date === today) return st;
        let cur = 1;
        if (st.last_check_in_date && _dayDiff(st.last_check_in_date, today) === 1) cur = (st.current || 0) + 1;
        const longest = Math.max(st.longest || 0, cur);
        return unwrap(await sb().from('streak').update({ current: cur, longest, last_check_in_date: today })
          .eq('user_id', id).select().single());
      },
      // 스트릭 복구 가능 여부 (#938) — localStorage 어댑터와 표면 일치. 정책은 _streakRepairStatus SSOT(datastore.js, 런타임 로드됨) 재사용.
      async repairStatus() {
        const st = await A.streak.get();
        const today = _today();
        const fn = (typeof window !== 'undefined') && window._streakRepairStatus;
        if (fn) return fn(st, today);
        // 폴백(헬퍼 미로드) — 보수적으로 불가 처리.
        return { canRepair: false, lostStreak: (st && st.current) || 0, brokenDays: 0, cooldownDays: 0, reason: 'no_helper' };
      },
      // '하루 만회' (#938, systems.md §6.1) — 깨진 스트릭을 끊김 직전 값으로 되살리고 last_check_in_date 를 '어제'로,
      // last_repair_date 에 오늘을 기록(주 1회 쿨다운). 35_streak_repair.sql 로 last_repair_date 컬럼 추가.
      async repair() {
        const id = await uid();
        const today = _today();
        const st = await A.streak.get();
        const fn = (typeof window !== 'undefined') && window._streakRepairStatus;
        const status = fn ? fn(st, today) : { canRepair: false, reason: 'no_helper' };
        if (!status.canRepair) return { ok: false, reason: status.reason, cooldownDays: status.cooldownDays || 0, streak: st };
        const cur = Math.max(1, status.lostStreak);
        const longest = Math.max((st && st.longest) || 0, cur);
        const yest = (typeof window !== 'undefined' && window._todayMinus) ? window._todayMinus(1)
          : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const out = unwrap(await sb().from('streak')
          .update({ current: cur, longest, last_check_in_date: yest, last_repair_date: today })
          .eq('user_id', id).select().single());
        return { ok: true, reason: 'repaired', lostStreak: cur, streak: out };
      },
    },
    xp: {
      async get() { const u = await A.profile.get(); return (u && u.xp) || 0; },
      async add(amount) {
        // 원자 increment RPC(#1161) — 구 read-modify-write(cur+amount)는 두 탭/경로 경쟁 시 증가분 유실.
        const out = unwrap(await sb().rpc('increment_xp', { p_amount: amount || 0 }));
        return typeof out === 'number' ? out : null;
      },
    },

    /* 성(🏰) 컬렉션 — 완독 파생 */
    castles: {
      // 성(🏰) = XP 주기 완료 수 (#520/#521, backend.md §7.2). length = floor(totalXp / 1600).
      // DB 조회 없이 users.xp 파생 — 완독(status='completed')과 분리.
      async list() {
        const u = await A.profile.get();
        const xp = (u && u.xp) || 0;
        const n = (typeof window.nestCastleCount === 'function')
          ? window.nestCastleCount(xp)
          : Math.floor(Math.max(0, xp) / 1600);
        return Array.from({ length: n }, (_, i) => ({ index: i + 1, earnedAtXp: (i + 1) * 1600 }));
      },
    },

    /* 소셜 — 좋아요(claps) / 관심책 / 콕찌르기 / 팔로우
       #641: 짹+저장(구 bookmark) → claps 단일. 자기 문장 좋아요(저장) 허용 — RLS claps_mod(from_user_id=auth.uid())가 작성자 여부와 무관하게 insert 허용. */
    claps: {
      async toggle(sentenceId) {
        const id = await uid();
        const ex = unwrap(await sb().from('claps').select('id').eq('from_user_id', id).eq('to_sentence_id', sentenceId).maybeSingle());
        if (ex) { await sb().from('claps').delete().eq('id', ex.id); return false; }
        await sb().from('claps').insert({ from_user_id: id, to_sentence_id: sentenceId });
        return true;
      },
      async countFor(sentenceId) {
        const { count } = await sb().from('claps').select('*', { count: 'exact', head: true }).eq('to_sentence_id', sentenceId);
        return count || 0;
      },
      async isMine(sentenceId) {
        const id = await uid();
        const ex = unwrap(await sb().from('claps').select('id').eq('from_user_id', id).eq('to_sentence_id', sentenceId).maybeSingle());
        return !!ex;
      },
      // #641: 내가 좋아요한 문장 목록(sentence 임베드) — '좋아요한 문장 모아보기'. 구 bookmarks.list 대체.
      // {sentence_id, sentence} 표면 유지(SentenceCollectionModal 호환). to_sentence_id → sentence_id 별칭.
      async list() {
        const id = await uid();
        return unwrap(await sb().from('claps').select('sentence_id:to_sentence_id, sentence:sentences(*, user_book:user_books(book_id, book:books(title)))')
          .eq('from_user_id', id).order('created_at', { ascending: false }));
      },
    },
    wishBooks: {
      async add(bookId) {
        const id = await uid();
        await sb().from('wish_books').upsert({ user_id: id, book_id: bookId }, { onConflict: 'user_id,book_id' });
        return A.wishBooks.list();
      },
      async list() {
        const id = await uid();
        return unwrap(await sb().from('wish_books').select('*, book:books(*)')
          .eq('user_id', id).order('created_at', { ascending: false }));
      },
      async remove(bookId) {
        const id = await uid();
        await sb().from('wish_books').delete().eq('user_id', id).eq('book_id', bookId);
        return A.wishBooks.list();
      },
    },

    /* 스샷 서가 복원 검토함 (#1048, integrated-shelf.md §4.7) — 로그인 전용 임포트 스테이징.
       shelf-import 검수 "등록"이 책장 직행(myBooks.addBatch) 대신 여기로 적재 → 서재 "검토함" 뷰가
       항목별/일괄로 책장 이동(commit)·제외(remove). 영속(import_staging, 37_import_staging.sql).
       local 어댑터(datastore.js)는 게이트라 no-op — 게스트는 RG_openShelfImport 에서 차단(app.js). */
    importStaging: {
      // 검수분 적재. items: [{ book|null, status, rating? }] (addBatch 와 같은 표면).
      // 매칭/보강 메타(표지·쪽수·isbn)를 행으로 평탄화해 검토함 카드가 책장 없이도 표시 가능.
      async add(items) {
        const id = await uid();
        if (!id) return [];
        const list = Array.isArray(items) ? items : [];
        const rows = list.map((it) => {
          if (!it) return null;
          const b = it.book || {};
          const title = String((b.title || it.title || '')).trim();
          if (!title) return null;
          // canonical UUID(Supabase 카탈로그 매칭)만 book_id 로 보존. raw id(b001)·알라딘(id 없음)은 null.
          const isUuid = b.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(b.id));
          const rn = Number(it.rating);
          const rating = (Number.isFinite(rn) && rn > 0) ? Math.min(5, Math.max(0.5, Math.round(rn * 2) / 2)) : null;
          return {
            user_id: id,
            book_id: isUuid ? b.id : null,
            title,
            author: String((b.author || it.author || '')).trim() || null,
            cover_url: b.cover_url || null,
            isbn13: b.isbn13 || null,
            total_pages: Number(b.total_pages) || 0,
            suggested_status: it.status || 'completed',
            rating,
          };
        }).filter(Boolean);
        if (!rows.length) return [];
        return unwrap(await sb().from('import_staging').insert(rows).select()) || [];
      },
      async list() {
        const id = await uid();
        if (!id) return [];
        return unwrap(await sb().from('import_staging').select('*')
          .eq('user_id', id).order('created_at', { ascending: false })) || [];
      },
      async remove(stagingId) {
        const id = await uid();
        await sb().from('import_staging').delete().eq('id', stagingId).eq('user_id', id);
        return A.importStaging.list();
      },
      // 검토함 → 책장 이동. status(없으면 suggested_status) 로 myBooks.addBatch 라우팅(별점 보존) 후 행 삭제.
      // 반환: 등록된 UserBook|wish 표면(addBatch out[0]) | null(행 없음/실패).
      async commit(stagingId, status) {
        const id = await uid();
        const row = unwrap(await sb().from('import_staging').select('*')
          .eq('id', stagingId).eq('user_id', id).maybeSingle());
        if (!row) return null;
        // 미확인(book_id·isbn 없음) 행은 책장 삽입 직전 알라딘으로 한 번 더 해소 — "DB엔 ISBN" 보장 +
        //   기존 검토함 미확인 행도 [내 서재로] 이동 시점에 표지·ISBN·쪽수가 채워진다(#1052).
        let enriched = null;
        if (!row.book_id && !row.isbn13 && row.title && window.RG_shelfImport && window.RG_shelfImport.aladinLookup) {
          try { enriched = await window.RG_shelfImport.aladinLookup(row.title, row.author || ''); } catch (e) { enriched = null; }
        }
        // book_id 있으면 그대로(add 가 upsert 생략), 없으면 알라딘 보강분 → 메타 순으로 채워 upsert 재해소.
        const book = row.book_id
          ? { id: row.book_id, title: row.title, author: row.author || '', publisher: '', total_pages: row.total_pages || 0, cover_url: row.cover_url || '', isbn13: row.isbn13 || '' }
          : { title: (enriched && enriched.title) || row.title, author: (enriched && enriched.author) || row.author || '', publisher: (enriched && enriched.publisher) || '', total_pages: (enriched && enriched.total_pages) || row.total_pages || 0, cover_url: (enriched && enriched.cover_url) || row.cover_url || '', isbn13: (enriched && enriched.isbn13) || row.isbn13 || '' };
        const st = status || row.suggested_status || 'completed';
        const out = await A.myBooks.addBatch([{ book, status: st, rating: row.rating }]);
        // 책장 이동 성공 시에만 검토함에서 제거(실패면 보존해 재시도 가능).
        if (out && out.length) {
          await sb().from('import_staging').delete().eq('id', stagingId).eq('user_id', id);
        }
        return (out && out[0]) || null;
      },
    },

    pokes: {
      async send(toUserId) {
        const id = await uid();
        return unwrap(await sb().from('pokes').upsert(
          { from_user_id: id, to_user_id: toUserId, day: _today() },
          { onConflict: 'from_user_id,to_user_id,day' }).select().single());
      },
      async listReceived() {
        const id = await uid();
        // pokes→users FK 2개(from/to) → from_user_id 로 명시 disambiguate
        return unwrap(await sb().from('pokes')
          .select('*, sender:users!pokes_from_user_id_fkey(handle,display_name,avatar_url)')
          .eq('to_user_id', id).order('created_at', { ascending: false }));
      },
    },
    friends: {
      // 내가(또는 userId가) 팔로우하는 사람 목록 → [{following: {user}}]
      async list(userId) {
        const id = userId || await uid();
        if (!id) return [];
        return unwrap(await sb().from('follows')
          .select('following:users!follows_following_id_fkey(*)').eq('follower_id', id));
      },
      // 나를(또는 userId를) 팔로우하는 사람 목록 → [{follower: {user}}] (#509)
      async followers(userId) {
        const id = userId || await uid();
        if (!id) return [];
        return unwrap(await sb().from('follows')
          .select('follower:users!follows_follower_id_fkey(*)').eq('following_id', id));
      },
      async follow(userId) {
        const id = await uid();
        // error 체크 — RLS·FK 실패를 삼키지 않음(#516). upsert는 throw 대신 {error} 반환.
        const { error } = await sb().from('follows').upsert({ follower_id: id, following_id: userId }, { onConflict: 'follower_id,following_id' });
        if (error) throw error;
        return true;
      },
      async unfollow(userId) {
        const id = await uid();
        const { error } = await sb().from('follows').delete().eq('follower_id', id).eq('following_id', userId);
        if (error) throw error;
        return false;
      },
      // 팔로잉/팔로워 수 — userId 생략 시 본인(#516). count head 질의(행 미전송).
      async counts(userId) {
        const id = userId || await uid();
        if (!id) return { following: 0, followers: 0 };
        const [fg, fr] = await Promise.all([
          sb().from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', id),
          sb().from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', id),
        ]);
        return { following: fg.count || 0, followers: fr.count || 0 };
      },
      async isFollowing(userId) {
        const id = await uid();
        if (!id || !userId) return false;
        const row = unwrap(await sb().from('follows').select('follower_id')
          .eq('follower_id', id).eq('following_id', userId).maybeSingle());
        return !!row;
      },
    },
    users: {
      async search(query) {
        if (!query) return [];
        return unwrap(await sb().from('users').select('id,handle,display_name,avatar_url')
          .ilike('handle', '%' + query + '%').limit(20));
      },
      // 타인 프로필(§5.8.2 전체 공개) — 핸들로 단건 + 공개 완독책/한문장 (RLS select using(true))
      async getByHandle(handle) {
        const h = (handle || '').replace(/^@/, '').trim();
        if (!h) return null;
        return unwrap(await sb().from('users').select('*').eq('handle', h).maybeSingle());
      },
      // 핸들(@아이디) 사용 가능 여부 — 중복검사. 본인이 이미 쓰는 핸들이면 사용 가능.
      async isHandleAvailable(handle) {
        const h = (handle || '').replace(/^@/, '').trim();
        if (!h) return false;
        const me = await uid();
        const rows = unwrap(await sb().from('users').select('id').eq('handle', h).limit(1));
        return !rows || rows.length === 0 || (!!me && rows[0] && rows[0].id === me);
      },
      async publicBooks(userId) {
        return unwrap(await sb().from('user_books').select('*, book:books(*)')
          .eq('user_id', userId).eq('status', 'completed').order('completed_at', { ascending: false }));
      },
      async publicSentences(userId) {
        return unwrap(await sb().from('sentences_public').select('*, user_book:user_books(book_id, book:books(title))')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(50));
      },
      // 공개 스트릭(streak 테이블 select using(true)) — 타인 프로필 표시용 (#10)
      async publicStreak(userId) {
        const row = unwrap(await sb().from('streak').select('current').eq('user_id', userId).maybeSingle());
        return row ? (row.current || 0) : 0;
      },
      // 타인 책장 전체 — 읽는 중 + 완독 (status 포함). 책장 필터용 (#4)
      async publicShelf(userId) {
        return unwrap(await sb().from('user_books').select('*, book:books(*)')
          .eq('user_id', userId).in('status', ['reading', 'completed'])
          .order('status', { ascending: true }).order('completed_at', { ascending: false }));
      },
      // 타인 위시리스트 — wishlist_public=true 인 경우만 반환, 아니면 [] (#558)
      async publicWishlist(userId) {
        if (!userId) return [];
        // users 행의 wishlist_public 을 먼저 확인. RLS도 동일 조건이지만 클라에서도 guard.
        const userRow = unwrap(await sb().from('users').select('wishlist_public').eq('id', userId).maybeSingle());
        if (!userRow || !userRow.wishlist_public) return [];
        return unwrap(await sb().from('wish_books').select('*, book:books(*)')
          .eq('user_id', userId).order('created_at', { ascending: false })) || [];
      },
      // 타인의 특정 책 기여 — 그 책 평점·후기 + 공개 한 문장 (#5)
      async bookContrib(userId, bookId) {
        const ub = unwrap(await sb().from('user_books').select('id, rating, review_text, status, current_page')
          .eq('user_id', userId).eq('book_id', bookId).maybeSingle());
        const sents = unwrap(await sb().from('sentences_public').select('id, text, page, created_at')
          .eq('user_id', userId).eq('user_book_id', ub ? ub.id : '00000000-0000-0000-0000-000000000000')
          .order('page', { ascending: true }));
        return { userBook: ub || null, sentences: sents || [] };
      },
    },

    /* 스포일러 (read-side) */
    spoiler: {
      async myCurrentPage(bookId) {
        const id = await uid();
        if (!bookId) return 0;
        const row = unwrap(await sb().from('user_books').select('current_page')
          .eq('user_id', id).eq('book_id', bookId).maybeSingle());
        return row ? (row.current_page || 0) : 0;
      },
    },

    /* 마을 (구 villages.* 어댑터) — 삭제됨(#1035 정리). 호출처 0(grep 확인: UI 는 전부 rooms.* 사용).
       비번/정원 서버검증 없는 직접 upsert(join)이라 재호출 시 #1022(입장 우회) 부활 위험이 있어 제거.
       co-reading 의 같이읽기 표면은 아래 rooms.* 가 단일 진실(SECURITY DEFINER RPC 경유). */

    /* 방(room) — 같이읽기 P1 (co-reading.md §6.2). 폐기 villages.* 어댑터를 rooms.* 로
       부활·rename + slim. 기존 villages/village_members 테이블·RLS 재사용(병렬 테이블 신설 X).
       create 에 password·invite_token 추가, join 에 password 검증 추가. local 어댑터와 표면 일치. */
    rooms: {
      // 공통 select 프로젝션 — 책·멤버수 임베드 (parts 는 P1 미사용이라 제외).
      // ⚠ '*' 금지 — password_hash 는 클라 read 차단(#996, REVOKE)이라 '*' 면 권한 에러.
      //   컬럼을 명시(password_hash 제외, has_password 만 노출 = 비번여부 플래그)한다.
      _SEL: 'id, book_id, name, description, visibility, invite_code, invite_token, has_password, capacity, status, created_by, created_at, book:books(id, isbn13, title, author, cover_url, total_pages), village_members(count)',
      async create({ bookId, name, visibility, capacity, password }) {
        const id = await uid();
        // bookId 가 로컬 카탈로그 ID("b104" 등)인 경우 Supabase books 테이블 UUID로 해소(기존 로직).
        let supaBookId = bookId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(bookId || ''));
        if (!isUuid) {
          const localBook = typeof window !== 'undefined' && window.getBook ? window.getBook(bookId) : null;
          if (localBook && localBook.isbn) {
            const sbBook = await A.books.upsert({
              isbn13: localBook.isbn, title: localBook.title, author: localBook.author,
              publisher: localBook.pub, total_pages: localBook.total, cover_url: localBook.cover,
            }).catch(() => null);
            if (sbBook && sbBook.id) supaBookId = sbBook.id;
          }
        }
        const vis = visibility === 'private' ? 'private' : 'public';
        // invite_code(6자리) + invite_token(22+자) 동시 생성. UNIQUE 충돌 시 최대 5회 재시도.
        // 비공개 숲은 비번 없이 토큰=초대장만으로 입장(#1094 후속, B안 — 비밀번호 기능 폐기).
        let v = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
          const inviteToken = _roomToken();
          const res = await sb().from('villages').insert({
            book_id: supaBookId, name, visibility: vis, created_by: id,
            invite_code: inviteCode, invite_token: inviteToken,
            ...(capacity != null && { capacity }),
          }).select().single();
          if (!res.error) { v = res.data; break; }
          if (res.error.code !== '23505') throw res.error; // UNIQUE 위반 외 에러는 즉시 throw
          // 23505 = unique_violation(code/token 충돌) → 새 값으로 재시도
        }
        if (!v) throw new Error('방 코드 생성 실패 (5회 시도 초과)');
        // 생성자 멤버 등록 — 직접 insert 금지(#1022, RLS vmembers_mod = delete 만). host(created_by=나)
        // 가드를 가진 SECURITY DEFINER RPC 로 등록(정의자 권한으로 RLS 우회).
        unwrap(await sb().rpc('room_create_membership', { p_room_id: v.id }));
        // book + member count 포함해 다시 조회 (insert 응답엔 임베드 미포함)
        return unwrap(await sb().from('villages').select(this._SEL).eq('id', v.id).single()) || v;
      },
      async join(roomId) {
        // 입장 권한 = **서버측 강제** (#1022, CSO HIGH). 멤버십은 SECURITY DEFINER RPC room_join 경유만:
        // 함수 안에서 서버가 (a)방 존재 (b)현재멤버<capacity 를 검증한 뒤에만 멤버 행을 만든다.
        // 비번 폐기(#1094 후속, B안) — room_join 시그니처는 유지하되 p_password 는 빈값(비번 없는 방은 통과).
        const res = await sb().rpc('room_join', { p_room_id: roomId, p_password: '' });
        if (res && res.error) {
          const e = res.error;
          if (e.code === '23505' || /full/i.test(e.message || '')) throw new Error('정원이 마감되었습니다.');
          if (e.code === 'P0002' || /not found/i.test(e.message || '')) throw new Error('방을 찾을 수 없어요.');
          throw e;
        }
        return true;
      },
      async leave(roomId) {
        const id = await uid();
        await sb().from('village_members').delete().eq('village_id', roomId).eq('user_id', id);
        return true;
      },
      // 책으로 공개 방 검색(§4.3 책으로 검색 · §4.4 badge 카운트 · §7.6 추천). bookId 지정 시 그 책 방만.
      // 정렬 = 멤버 인원수 내림차순, 동률은 최신순(자동합류·추천·badge 통일, §4.2·§7.6).
      //   village_members(count) 는 임베드 집계라 PostgREST .order() 불가 → created_at desc 로 받고 JS 재정렬.
      //   limit 은 JS 정렬 뒤 적용(DB created_at limit 으로 인기-구(old)숲이 잘리는 것 방지).
      async byBook(bookId, opts) {
        const limit = opts && opts.limit;
        let q = sb().from('villages').select(this._SEL)
          .eq('visibility', 'public').order('created_at', { ascending: false });
        if (bookId) {
          // 로컬 카탈로그 id → Supabase UUID 해소(임베드 책은 UUID 기준 매칭).
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(bookId || ''));
          let supaBookId = bookId;
          if (!isUuid && typeof window !== 'undefined' && window.getBook) {
            const lb = window.getBook(bookId);
            if (lb && lb.isbn) {
              const found = unwrap(await sb().from('books').select('id').eq('isbn13', lb.isbn).maybeSingle());
              if (found && found.id) supaBookId = found.id;
            }
          }
          q = q.eq('book_id', supaBookId);
        }
        const rows = unwrap(await q) || [];
        // 멤버 인원수 desc 정렬(동률은 위 created_at desc 보존 — 안정 정렬). limit 은 정렬 후.
        const cnt = (r) => (r.village_members && r.village_members[0] && r.village_members[0].count) || 0;
        const sorted = rows.slice().sort((a, b) => cnt(b) - cnt(a));
        return limit ? sorted.slice(0, limit) : sorted;
      },
      // 참여 중인 방 (구 listMine)
      async myRooms() {
        const id = await uid();
        const rows = unwrap(await sb().from('village_members')
          .select(`village:villages(${this._SEL})`)
          .eq('user_id', id));
        return (rows || []).map(r => r.village).filter(Boolean);
      },
      async get(roomId) {
        return unwrap(await sb().from('villages').select(this._SEL).eq('id', roomId).single());
      },
      // 멤버 진척 그리드 — 진도·오늘불빛·최근 한 문장 (§5.3.1). villages.members 로직 재사용.
      async members(roomId) {
        const today = _today();
        const vRow = unwrap(await sb().from('villages').select('book_id').eq('id', roomId).maybeSingle());
        const bookId = vRow && vRow.book_id;
        const memberRows = unwrap(await sb().from('village_members')
          .select('joined_at, user:users(id, handle, display_name, nest_emoji, streak:streak(current))')
          .eq('village_id', roomId)) || [];
        if (!memberRows.length || !bookId) return memberRows;
        const memberIds = memberRows.map(r => r.user && r.user.id).filter(Boolean);
        if (!memberIds.length) return memberRows;
        const ubRows = unwrap(await sb().from('user_books')
          .select('id, user_id, current_page')
          .eq('book_id', bookId).in('user_id', memberIds)) || [];
        const userBookIds = ubRows.map(r => r.id);
        // 오늘 어떤 책이든 기록했는지(스트릭 동일 기준 — 방 책 한정 X)는 reading_sessions 전체로 판정.
        const todaySessions = memberIds.length
          ? unwrap(await sb().from('reading_sessions').select('user_id').in('user_id', memberIds).eq('session_date', today)) || []
          : [];
        const todayUserSet = new Set(todaySessions.map(s => s.user_id));
        const sentRows = userBookIds.length
          ? unwrap(await sb().from('sentences_public')
              .select('user_id, user_book_id, text, page')
              .in('user_book_id', userBookIds)
              .order('created_at', { ascending: false })
              .limit(userBookIds.length * 5)) || []
          : [];
        const sentByUbId = {};
        for (const s of sentRows) { if (!sentByUbId[s.user_book_id]) sentByUbId[s.user_book_id] = s; }
        return memberRows.map(r => {
          const u = r.user || {};
          const ub = ubRows.find(x => x.user_id === u.id);
          const sent = ub ? sentByUbId[ub.id] : null;
          return {
            ...r,
            user: {
              ...u,
              cumulativePage: (ub && ub.current_page) || 0,
              todayRecorded: todayUserSet.has(u.id),   // 오늘 어떤 책이든 기록 = ● (§5.3.1)
              todaySentence: sent ? { text: sent.text, page: sent.page } : null,
            },
          };
        });
      },
      // 토큰 URL 입장 미리보기 (§5.2) — invite_token 직접 조회(전체 스캔 없음).
      async findByToken(token) {
        if (!token) return null;
        // 비공개 숲도 토큰=초대장으로 조회 (villages_sel RLS 가 비멤버를 막으므로 SECURITY DEFINER
        // RPC find_room_by_token 경유 — password_hash 제외, book+멤버수 임베드. 36_find_room_by_token.sql).
        return unwrap(await sb().rpc('find_room_by_token', { p_token: String(token).trim() })) || null;
      },
      // 6자리 코드 입장 미리보기 — invite_code 직접 조회.
      async findByCode(code) {
        if (!code) return null;
        return unwrap(await sb().from('villages').select(this._SEL)
          .eq('invite_code', String(code).toUpperCase().trim()).maybeSingle());
      },
      /* ── 마일스톤(함께 읽기 일정/구간) — village_parts (co-reading.md §6, P2 마일스톤) ──
         읽기 = 멤버 누구나(vparts_sel: 공개/멤버/host), 쓰기 = host(created_by)만(vparts_mod RLS).
         새 테이블 없음 — 마을 유산 village_parts 재사용. local 어댑터와 표면 일치. */
      async listParts(roomId) {
        if (!roomId) return [];
        return unwrap(await sb().from('village_parts')
          .select('id, village_id, part_order, title, end_page, due_date')
          .eq('village_id', roomId)
          .order('part_order', { ascending: true })) || [];
      },
      // host 가 구간 목록 전체 교체(set) — 기존 parts 삭제 후 새로 insert. RLS(vparts_mod)가 host 가드.
      // parts = [{title,end_page,due_date}] 순서대로 part_order(1..N) 부여. 빈 배열이면 전부 삭제.
      async setParts(roomId, parts) {
        if (!roomId) return [];
        await sb().from('village_parts').delete().eq('village_id', roomId);
        const rows = (Array.isArray(parts) ? parts : [])
          .filter(p => p && ((p.title && p.title.trim()) || p.end_page != null || p.due_date))
          .map((p, i) => ({
            village_id: roomId,
            part_order: i + 1,
            title: (p.title || '').trim() || null,
            end_page: (p.end_page != null && p.end_page !== '') ? Number(p.end_page) : null,
            due_date: p.due_date || null,
          }));
        if (!rows.length) return [];
        return unwrap(await sb().from('village_parts').insert(rows)
          .select('id, village_id, part_order, title, end_page, due_date')) || [];
      },
    },

    /* 운영 대시보드 집계 — is_admin=true 전용 (#161) */
    admin: {
      // 집계 단일 RPC(#256) — SECURITY DEFINER + is_admin() 가드(13_admin_stats.sql). 비admin은 {}.
      async stats() {
        const r = unwrap(await sb().rpc('admin_stats'));
        return r || {};
      },
      // 문의 목록 (admin 전용, RLS는 is_admin) (#문의)
      async inquiries() {
        return unwrap(await sb().from('inquiries').select('*, user:users(handle)').order('created_at', { ascending: false }).limit(100));
      },
      // 문의 상태 변경 (open→answered→closed). RLS는 is_admin update
      async inquirySetStatus(id, status) {
        return unwrap(await sb().from('inquiries').update({ status }).eq('id', id).select().single());
      },
      // 인기책 TOP / 활성 사용자(리텐션 프록시) — RPC(SECURITY DEFINER + is_admin 가드) (#190, 12_admin_insights.sql)
      async popularBooks(lim = 5) {
        const rows = unwrap(await sb().rpc('admin_popular_books', { lim }));
        return (rows || []).map((x) => ({ bookId: x.book_id, title: x.title, registered: x.registered, completed: x.completed }));
      },
      async activeUsers() {
        const rows = unwrap(await sb().rpc('admin_active_users'));
        const r = (rows && rows[0]) || {};
        return { d7: r.d7 || 0, d30: r.d30 || 0 };
      },
      // 고도화(#744 ③) — 완독률·코호트 리텐션·콘텐츠 공명 (29_admin_insights_v2.sql)
      async completionStats() {
        const rows = unwrap(await sb().rpc('admin_completion_stats'));
        const r = (rows && rows[0]) || {};
        return { total: r.total || 0, completed: r.completed || 0, reading: r.reading || 0, aborted: r.aborted || 0, rate: r.completion_rate || 0 };
      },
      async cohortRetention(weeks = 8) {
        const rows = unwrap(await sb().rpc('admin_cohort_retention', { weeks }));
        return (rows || []).map((x) => ({ cohort: x.cohort_week, size: x.cohort_size, week: x.week_offset, retained: x.retained }));
      },
      async contentResonance(lim = 10) {
        const rows = unwrap(await sb().rpc('admin_content_resonance', { lim }));
        return (rows || []).map((x) => ({ id: x.sentence_id, text: x.sentence_text, bookTitle: x.book_title, claps: x.claps }));
      },
    },

    /* 문의 — 누구나(로그인) 작성 → admin이 대시보드에서 확인 */
    inquiries: {
      async create({ message, email }) {
        const id = await uid();
        // 답변 메일 대상 = 가입(인증) 이메일. 닉네임 변경과 무관하게 user_id로 앵커되지만,
        // admin이 회신할 수 있도록 작성 시점의 auth 이메일을 함께 박아둔다.
        let authEmail = email || null;
        if (!authEmail) {
          try { const { data } = await sb().auth.getSession(); authEmail = (data && data.session && data.session.user && data.session.user.email) || null; } catch (e) {} // #646: getSession(로컬)
        }
        return unwrap(await sb().from('inquiries').insert({ user_id: id, message: message || '', email: authEmail }).select().single());
      },
    },

    /* AI 완독 후 카드 (§5.8.6) — Phase 0 하드코딩 시뮬(실 LLM 없음). data.js 헬퍼에 위임해
       localStorage 어댑터와 표면 일치. Phase 1+ 는 §7.9 Gemini Flash 프록시로 교체. */
    ai: {
      // 다음 책 추천 — [{ id, title, author, cover, isbn, reason }] (최대 3).
      recommendBooks(book) {
        return window.recommendNextBooks ? window.recommendNextBooks(book) : Promise.resolve([]);
      },
      // 추출 책 — { topics, topQuote, summary, quotes } | null(한 문장 없음).
      extractBook(book, quotes) {
        return window.extractBookSummary ? window.extractBookSummary(book, quotes) : Promise.resolve(null);
      },
    },

    /* 가입 전 임시 (localStorage; OAuth 후 동기화 §7.7) */
    pending: {
      get(key) { try { return JSON.parse(localStorage.getItem('rg_pending_' + key) || 'null'); } catch (e) { return null; } },
      set(key, value) { localStorage.setItem('rg_pending_' + key, JSON.stringify(value)); return value; },
    },

    /* 데이터 활용 동의 (#294) — 클라 측 플래그(디바이스 설정). Phase 1 profiles.data_consent 승격 후속. */
    consent: {
      get() { try { return localStorage.getItem('rg_data_consent'); } catch (e) { return null; } },
      set(v) { try { localStorage.setItem('rg_data_consent', v); } catch (e) {} return v; },
    },

    /* 같이읽기 기본 모드 (co-reading.md §7.5, P2) — 클라 측 플래그(디바이스 설정, consent 선례).
       'together'(기본=같이+공개) | 'solo'(혼자). 책 등록 시 자동합류 여부를 가른다. */
    coReadMode: {
      get() { try { return localStorage.getItem('rg_coread_mode') === 'solo' ? 'solo' : 'together'; } catch (e) { return 'together'; } },
      set(v) { const m = v === 'solo' ? 'solo' : 'together'; try { localStorage.setItem('rg_coread_mode', m); } catch (e) {} return m; },
    },

    /* 독서 파트너 대화 아카이브 (#295, 18_companion_sessions.sql) — 동의 유저의 Q/A를 익명 집계용 저장. */
    companionSessions: {
      async add({ bookId, sentence, comment, lens, question, answer, isResurface } = {}) {
        const id = await uid();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(bookId || ''));
        return unwrap(await sb().from('companion_sessions').insert({
          user_id: id, book_id: isUuid ? bookId : null,
          sentence: sentence || '', comment: comment || null, lens: lens || null,
          question: question || null, answer: answer || null,
          is_resurface: !!isResurface, consented: true,
        }).select().single());
      },
      // 내 대화 세션 수 (#394 backfill 가드) — 0이면 my_note backfill 1회 실행.
      async countMine() {
        const id = await uid();
        const { count } = await sb().from('companion_sessions').select('id', { count: 'exact', head: true }).eq('user_id', id);
        return count || 0;
      },
    },
    // 한 문장 초안 임시저장 (#1198) — 미확정 문장 뭉치. 로그인 모드에서도 커밋 전까지 로컬 전용
    //   (서버 미기록). 피처 파일이 localStorage 를 직접 만지지 않도록 계약 도메인으로 노출.
    drafts: {
      _key(bookId) { return 'rg_sentence_drafts:' + (bookId || '_'); },
      load(bookId) {
        try { const r = JSON.parse(localStorage.getItem(this._key(bookId)) || '[]'); return (Array.isArray(r) && r.length) ? r.map(x => String(x || '')) : ['']; } catch (e) { return ['']; }
      },
      save(bookId, arr) {
        try { const k = this._key(bookId); if ((arr || []).some(x => x && x.trim())) localStorage.setItem(k, JSON.stringify(arr)); else localStorage.removeItem(k); } catch (e) { /* 초안 저장 실패 무해 */ }
      },
    },
  };

  window.SupabaseDataStore = A;
})();
