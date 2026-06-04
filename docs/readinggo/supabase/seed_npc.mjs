/* =====================================================================
   ReadingGo — seed_npc.mjs  (#1 Part B: NPC 같은-책 피드 시드)

   민음사 전집(books.tsv ~492권)에 NPC 30명이 권당 2명씩 한 문장을 남긴다.
   → 둥지 "같은 책 읽는 사람들"(sentences.byBook)에 실제로 표시됨.

   실행 (★ 사용자가 service_role 로):
     cd docs/readinggo/supabase
     npm i @supabase/supabase-js
     SUPABASE_URL="https://cttllwwkaddghqttyhkg.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="sb_secret_...(절대 커밋/공유 금지)" \
     node seed_npc.mjs

   ⚠️ service_role 키는 서버 전용 — 채팅/깃에 절대 노출 금지.
   재실행 안전: 이미 시드된 (NPC,책) 조합은 skip(user_books unique).
   콘텐츠 확장: CURATED 에 isbn13→명문장 추가, 없으면 TEMPLATES 변주가 채움.
   ===================================================================== */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// env 미지정 시 레포 루트 .env 폴백 — 시크릿을 CLI 인자로 노출하지 않기 위함.
function _loadEnv(p) { const o = {}; try { for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i > 0) o[t.slice(0, i).trim()] = t.slice(i + 1).trim(); } } catch {} return o; }
const _env = _loadEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'));
const URL = process.env.SUPABASE_URL || _env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || _env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env 또는 .env) 필요'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const __dir = path.dirname(fileURLToPath(import.meta.url));
const TSV = path.join(__dir, '..', 'data', 'books.tsv');

const PUBLISHER = '민음사';        // 시드 대상 출판사
const NPCS_PER_BOOK = 2;           // 권당 NPC 수
const NPC_TOTAL = 30;

// 30 NPC (handle = @표시). display_name 은 사람스럽게.
const NPC_NAMES = [
  'quiet_rabbit', 'page_turner', 'midnight_reader', 'book_sparrow', 'ink_and_tea',
  'slow_pages', 'margin_notes', 'rainy_chapter', 'lamp_light', 'one_sentence',
  'paper_boat', 'dusty_shelf', 'morning_lines', 'late_night_owl', 'quiet_margin',
  'green_bookmark', 'autumn_reader', 'soft_spine', 'wandering_word', 'tea_break',
  'starry_page', 'old_library', 'first_line', 'last_line', 'between_lines',
  'whisper_read', 'deep_dive', 'gentle_reader', 'snowy_chapter', 'open_book',
];

// ⓐ 유명작 큐레이션 (isbn13 → 명문장 후보). 없는 책은 ⓑ 템플릿이 채움.
const CURATED = {
  '9788937460449': ['새는 알에서 나오려고 투쟁한다. 알은 세계다.', '내 안에서 솟아 나오려는 것, 그것을 살아보려 했을 뿐.'],
  '9788937460777': ['전쟁은 평화, 자유는 예속, 무지는 힘.', '빅 브라더가 당신을 보고 있다.'],
  '9788937462788': ['인간은 패배하도록 만들어지지 않았다.', '희망을 버리는 건 어리석은 일이야.'],
  '9788937460043': ['어느 날 아침 그레고르 잠자는 흉측한 벌레로 변해 있었다.'],
  '9788937460050': ['모든 동물은 평등하다. 그러나 어떤 동물은 더 평등하다.'],
  '9788937460471': ['나는 그저 호밀밭의 파수꾼이 되고 싶을 뿐이야.'],
  '9788937460753': ['그래서 우리는 물결을 거스르면서도 끝없이 앞으로 나아간다.'],
  '9788937460036': ['사느냐 죽느냐, 그것이 문제로다.'],
  '9788937443848': ['오늘 엄마가 죽었다. 아니 어쩌면 어제.'],
  '9788937460883': ['재산깨나 있는 독신 남자에게 아내가 필요하다는 건 보편적 진리다.'],
};

// ⓑ 템플릿 변주 ({t}=제목). 큐레이션 없는 책에 사용.
const TEMPLATES = [
  '{t}, 이 페이지에서 한참 멈췄다.', '{t}를 읽으며 오래 밑줄을 그었다.',
  '문장 하나에 하루가 환해졌다 — {t}.', '{t}, 다시 펼쳐도 새롭다.',
  '이 대목을 누군가와 나누고 싶었다.', '{t}, 밤을 잊게 한 페이지.',
  '천천히 읽기를 잘했다, {t}.', '{t}—마음이 오래 머문 줄.',
  '여기서 숨을 한 번 골랐다.', '{t}, 곁에 두고 또 읽고 싶다.',
  '이 한 줄이 오늘을 버티게 했다.', '{t}의 이 장면이 자꾸 떠오른다.',
];

const rint = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rint(arr.length)];

function readMinumsa() {
  const lines = fs.readFileSync(TSV, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const [, isbn, title, author, publisher, total_pages] = line.split('\t');
    if ((publisher || '').trim() === PUBLISHER && isbn) {
      out.push({ isbn13: isbn.trim(), title: (title || '').trim(), author: (author || '').trim(), publisher: PUBLISHER, total_pages: parseInt(total_pages, 10) || 200 });
    }
  }
  return out;
}

async function ensureNpcs() {
  // 이미 있는 NPC 재사용 + 부족분 생성
  const { data: existing } = await sb.from('users').select('id, handle').eq('is_npc', true);
  const byHandle = new Map((existing || []).map((u) => [u.handle, u.id]));
  const ids = [];
  for (let i = 0; i < NPC_TOTAL; i++) {
    const handle = NPC_NAMES[i] || ('npc_' + i);
    if (byHandle.has(handle)) { ids.push(byHandle.get(handle)); continue; }
    const email = `npc${String(i + 1).padStart(2, '0')}@readinggo.local`;
    const { data, error } = await sb.auth.admin.createUser({ email, password: 'Npc!' + Math.random().toString(36).slice(2, 10), email_confirm: true });
    if (error || !data?.user) { console.warn('createUser skip', email, error?.message); continue; }
    const uid = data.user.id;
    // 트리거가 public.users 생성 → is_npc/handle/display_name 갱신
    await sb.from('users').update({ is_npc: true, handle, display_name: handle.replace(/_/g, ' ') }).eq('id', uid);
    ids.push(uid);
    console.log('NPC 생성:', handle);
  }
  return ids;
}

async function upsertBook(b) {
  const { data } = await sb.from('books').upsert({ isbn13: b.isbn13, title: b.title, author: b.author, publisher: b.publisher, total_pages: b.total_pages }, { onConflict: 'isbn13' }).select('id').single();
  return data?.id;
}

async function seed() {
  const books = readMinumsa();
  console.log(`민음사 ${books.length}권, NPC ${NPC_TOTAL}명, 권당 ${NPCS_PER_BOOK}명 시드 시작…`);
  const npcIds = await ensureNpcs();
  if (npcIds.length < NPCS_PER_BOOK) { console.error('NPC 부족'); return; }

  let bi = 0, made = 0, done = 0;
  for (const b of books) {
    const bookId = await upsertBook(b);
    if (!bookId) continue;
    const quotes = CURATED[b.isbn13];
    // 책마다 NPC 2명 (순환 배정으로 고르게)
    for (let k = 0; k < NPCS_PER_BOOK; k++) {
      const uid = npcIds[(bi + k) % npcIds.length];
      // 이미 이 NPC가 이 책을 등록했으면 skip(재실행 안전)
      const { data: ex } = await sb.from('user_books').select('id').eq('user_id', uid).eq('book_id', bookId).maybeSingle();
      let ubId = ex?.id;
      if (!ubId) {
        const { data: ub } = await sb.from('user_books').insert({ user_id: uid, book_id: bookId, status: 'reading', current_page: 20 + rint(Math.max(1, (b.total_pages || 200) - 40)) }).select('id').single();
        ubId = ub?.id;
      }
      if (!ubId) continue;
      // 문장: ⓐ 큐레이션 우선, 없으면 ⓑ 템플릿 변주
      const text = quotes ? quotes[k % quotes.length] : pick(TEMPLATES).replace('{t}', b.title);
      const page = 10 + rint(Math.max(1, (b.total_pages || 200) - 20));
      // 같은 user_book 에 문장 이미 있으면 skip
      const { data: hasS } = await sb.from('sentences').select('id').eq('user_book_id', ubId).limit(1).maybeSingle();
      if (!hasS) { await sb.from('sentences').insert({ user_id: uid, user_book_id: ubId, page, text }); made++; }
    }
    bi += NPCS_PER_BOOK;
    if (++done % 50 === 0) console.log(`… ${done}권 처리`);
  }
  console.log(`✅ 시드 완료: 문장 ${made}개 생성 (민음사 ${books.length}권 × ${NPCS_PER_BOOK}명)`);
}

seed().catch((e) => { console.error('시드 실패:', e); process.exit(1); });
