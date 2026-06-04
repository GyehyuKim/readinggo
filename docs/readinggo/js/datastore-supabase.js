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
    const { data } = await sb().auth.getUser();
    _uid = (data && data.user) ? data.user.id : null;
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

  const A = {
    /* 인증 — supabase-client.js(RG_SB) 위임 */
    auth: {
      currentUser() { return window.RG_SB.currentUser(); },
      signInWithGoogle() { return window.RG_SB.signInWithGoogle(); },
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
      // 알라딘 결과 등 외부 책을 books 에 upsert (isbn13 기준) → 등록 흐름
      async upsert(book) {
        // isbn13 없으면 제목으로 기존 책 매칭 (null isbn 은 conflict 안 되어 중복 생성됨, architect H1).
        if (!book.isbn13) {
          const found = unwrap(await sb().from('books').select('*').eq('title', book.title).limit(1).maybeSingle());
          if (found) return found;
        }
        return unwrap(await sb().from('books').upsert({
          isbn13: book.isbn13, title: book.title, author: book.author,
          publisher: book.publisher, total_pages: book.total_pages, cover_url: book.cover_url,
        }, { onConflict: 'isbn13' }).select().single());
      },
      // 완독 → status='completed' (+rating/review_text). 성(🏰) = castles.list 파생.
      async complete(userBookId, opts) {
        opts = opts || {};
        const patch = { status: 'completed', completed_at: new Date().toISOString() };
        if (typeof opts.rating !== 'undefined') patch.rating = opts.rating;
        if (typeof opts.review_text !== 'undefined') patch.review_text = opts.review_text;
        return unwrap(await sb().from('user_books').update(patch).eq('id', userBookId).select().single());
      },
    },

    /* 내 책 / 활성 책 */
    myBooks: {
      async list() {
        const id = await uid();
        return unwrap(await sb().from('user_books').select('*, book:books(*)')
          .eq('user_id', id).order('started_at', { ascending: false }));
      },
      async add({ book, current_page }) {
        const id = await uid();
        const bk = book && book.id ? book : await A.books.upsert(book);
        return unwrap(await sb().from('user_books').insert({
          user_id: id, book_id: bk.id, status: 'reading', current_page: current_page || 0,
        }).select('*, book:books(*)').single());
      },
    },
    activeBook: {
      async get() {
        const u = await A.profile.get();
        if (!u || !u.active_user_book_id) return null;
        return unwrap(await sb().from('user_books').select('*, book:books(*)').eq('id', u.active_user_book_id).maybeSingle());
      },
      async set(userBookId) { await A.profile.update({ active_user_book_id: userBookId }); return userBookId; },
    },

    /* 일일 기록 (세션) — 그날 1행 upsert + 스트릭 bump */
    sessions: {
      async addToday({ userBookId, page }) {
        const id = await uid();
        const today = _today();
        if (typeof page === 'number') {
          await sb().from('user_books').update({ current_page: page }).eq('id', userBookId);
        }
        const row = unwrap(await sb().from('reading_sessions').upsert({
          user_book_id: userBookId, user_id: id, session_date: today, current_page: page,
        }, { onConflict: 'user_book_id,session_date' }).select().single());
        await A.streak.bumpOnCheckIn();
        return row;
      },
      async list(userBookId) {
        return unwrap(await sb().from('reading_sessions').select('*').eq('user_book_id', userBookId)
          .order('session_date', { ascending: false }));
      },
    },

    /* 한 문장 (sentences) */
    sentences: {
      async add({ userBookId, sessionId, page, text, my_note }) {
        const id = await uid();
        return unwrap(await sb().from('sentences').insert({
          user_id: id, user_book_id: userBookId, session_id: sessionId || null,
          page: (typeof page === 'number') ? page : null, text: text || '', my_note: my_note || null,
        }).select().single());
      },
      // 사후 감상 추가·편집 (작성 시점 무관) — profile §5.8.4
      async setNote(sentenceId, my_note) {
        return unwrap(await sb().from('sentences').update({ my_note }).eq('id', sentenceId).select().single());
      },
      // 한 문장/감상 공개·비공개 토글 (QA #12). patch = { is_private } 또는 { note_private }.
      async setVisibility(sentenceId, patch) {
        return unwrap(await sb().from('sentences').update(patch).eq('id', sentenceId).select().single());
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
      // 전체 공개 피드 (§social). 책 제목은 user_books→books 중첩 embed.
      async feed({ cursor, limit } = {}) {
        let q = sb().from('sentences')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books(book:books(id,title,cover_url))')
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
        return unwrap(await sb().from('sentences')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books(book:books(id,title,cover_url))')
          .in('user_id', ids).order('created_at', { ascending: false }).limit(limit || 30));
      },
      // 같은 책 피드 — 특정 책의 *다른* 사용자 한 문장 (둥지 '같은 책 읽는 사람들', NPC 포함, #1)
      async byBook(bookId, { limit } = {}) {
        // 데모 book id('b008' 등) 비-UUID 방어 — uuid 컬럼 질의 400 방지.
        if (!bookId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId)) return [];
        const me = await uid();
        let q = sb().from('sentences')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books!inner(book_id, book:books(id,title,cover_url))')
          .eq('user_book.book_id', bookId)
          .order('created_at', { ascending: false }).limit(limit || 10);
        if (me) q = q.neq('user_id', me);
        return unwrap(await q);
      },
      // 무작위 회상 — 내 과거 한 문장 1개 (profile §5.8.7)
      // 추천 — 내 서재의 책을 읽는 다른 사람들의 최근(1주) 한 문장 (유사도≈공유 책). 비면 최근 피드 폴백. (#8)
      async feedRecommended({ limit } = {}) {
        const me = await uid();
        const mine = unwrap(await sb().from('user_books').select('book_id').eq('user_id', me));
        const bookIds = [...new Set((mine || []).map(r => r.book_id).filter(Boolean))];
        if (!bookIds.length) return await A.sentences.feed({ limit });
        const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
        let q = sb().from('sentences')
          .select('*, user:users(handle,display_name,avatar_url), user_book:user_books!inner(book_id, book:books(id,title,cover_url))')
          .in('user_book.book_id', bookIds).gte('created_at', weekAgo)
          .order('created_at', { ascending: false }).limit(limit || 50);
        if (me) q = q.neq('user_id', me);
        const rows = unwrap(await q);
        return (rows && rows.length) ? rows : await A.sentences.feed({ limit });
      },
      async random() {
        const mine = await A.sentences.listMine();
        if (!mine || !mine.length) return null;
        return mine[Math.floor(Math.random() * mine.length)];
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
    },
    xp: {
      async get() { const u = await A.profile.get(); return (u && u.xp) || 0; },
      async add(amount) {
        const id = await uid();
        const cur = await A.xp.get();
        const out = unwrap(await sb().from('users').update({ xp: cur + (amount || 0) }).eq('id', id).select('xp').single());
        return out ? out.xp : null;   // 동시성 정확도 필요 시 RPC(원자 increment)로 교체
      },
    },

    /* 성(🏰) 컬렉션 — 완독 파생 */
    castles: {
      async list() {
        const id = await uid();
        return unwrap(await sb().from('user_books').select('*, book:books(*)')
          .eq('user_id', id).eq('status', 'completed').order('completed_at', { ascending: false }));
      },
    },

    /* 소셜 — 짹 / 책갈피 / 관심책 / 콕찌르기 / 팔로우 */
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
    },
    bookmarks: {
      async toggle(sentenceId) {
        const id = await uid();
        const ex = unwrap(await sb().from('sentence_bookmarks').select('id').eq('user_id', id).eq('sentence_id', sentenceId).maybeSingle());
        if (ex) { await sb().from('sentence_bookmarks').delete().eq('id', ex.id); return false; }
        await sb().from('sentence_bookmarks').insert({ user_id: id, sentence_id: sentenceId });
        return true;
      },
      async list() {
        const id = await uid();
        return unwrap(await sb().from('sentence_bookmarks').select('*, sentence:sentences(*, user_book:user_books(book_id, book:books(title)))')
          .eq('user_id', id).order('created_at', { ascending: false }));
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
      async list() {
        const id = await uid();
        return unwrap(await sb().from('follows')
          .select('following:users!follows_following_id_fkey(*)').eq('follower_id', id));
      },
      async follow(userId) {
        const id = await uid();
        await sb().from('follows').upsert({ follower_id: id, following_id: userId }, { onConflict: 'follower_id,following_id' });
        return true;
      },
      async unfollow(userId) {
        const id = await uid();
        await sb().from('follows').delete().eq('follower_id', id).eq('following_id', userId);
        return false;
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
        return unwrap(await sb().from('sentences').select('*, user_book:user_books(book_id, book:books(title))')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(50));
      },
      // 공개 스트릭(streak 테이블 select using(true)) — 타인 프로필 표시용 (#10)
      async publicStreak(userId) {
        const row = unwrap(await sb().from('streak').select('current').eq('user_id', userId).maybeSingle());
        return row ? (row.current || 0) : 0;
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

    /* 마을 (스키마=backend, 기능 UI=윤지). 계약 기본 구현. */
    villages: {
      async create({ bookId, name, visibility, parts }) {
        const id = await uid();
        const v = unwrap(await sb().from('villages').insert({
          book_id: bookId, name, visibility: visibility || 'public', created_by: id,
        }).select().single());
        if (Array.isArray(parts) && parts.length) {
          await sb().from('village_parts').insert(parts.map((p, i) => ({
            village_id: v.id, part_order: i + 1, title: p.title || null,
            end_page: p.end_page || null, due_date: p.due_date || null,
          })));
        }
        await sb().from('village_members').insert({ village_id: v.id, user_id: id });
        return v;
      },
      async join(villageId) {
        const id = await uid();
        await sb().from('village_members').upsert({ village_id: villageId, user_id: id }, { onConflict: 'village_id,user_id' });
        return true;
      },
      async listMine() {
        const id = await uid();
        const rows = unwrap(await sb().from('village_members').select('village:villages(*)').eq('user_id', id));
        return (rows || []).map(r => r.village);
      },
      async get(villageId) {
        return unwrap(await sb().from('villages').select('*, parts:village_parts(*)').eq('id', villageId).single());
      },
      async members(villageId) {
        return unwrap(await sb().from('village_members').select('joined_at, user:users(*)').eq('village_id', villageId));
      },
    },

    /* AI (Phase 1+ Gemini 프록시 §7.9) — 프록시 붙기 전 stub */
    ai: {
      async recommendBooks() { return []; },
      async extractBook() { return null; },
    },

    /* 가입 전 임시 (localStorage; OAuth 후 동기화 §7.7) */
    pending: {
      get(key) { try { return JSON.parse(localStorage.getItem('rg_pending_' + key) || 'null'); } catch (e) { return null; } },
      set(key, value) { localStorage.setItem('rg_pending_' + key, JSON.stringify(value)); return value; },
    },
  };

  window.SupabaseDataStore = A;
})();
