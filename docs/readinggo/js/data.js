/* =========================================================
   ReadingGo — data.js
   책 데이터, NEST_STAGES(진척률 5단계), 초기 상태, 헬퍼 함수
   window.* 으로 export → 다음 파일에서 참조 가능
   ========================================================= */

const RG_BOOKS = [
  {id:"b001",isbn:"9788934972464",title:"사피엔스",author:"유발 하라리",pub:"김영사",total:648,cover:"https://image.aladin.co.kr/product/31424/4/cover500/k482832219_1.jpg",fb:["#F4D9A8","#E8B473"],toc:[[1,"프롤로그",1,20],[2,"1부: 인지혁명",21,138],[3,"2부: 농업혁명",139,270],[4,"3부: 인류의 통합",271,444],[5,"4부: 과학혁명",445,630],[6,"에필로그",631,648]]},
  {id:"b002",isbn:"9788983711892",title:"코스모스",author:"칼 세이건",pub:"사이언스북스",total:719,cover:"https://image.aladin.co.kr/product/87/9/cover500/s412032094_1.jpg",fb:["#1A3A6E","#3A6FB0"],toc:[[1,"코스모스의 바닷가에서",1,54],[2,"우주 생명의 씨앗",55,108],[3,"지상과 천상의 조화",109,162],[4,"천국과 지옥",163,212],[5,"붉은 행성을 위한 블루스",213,262],[6,"여행자의 이야기",263,316],[7,"밤하늘의 등뼈",317,368],[8,"시간과 공간을 가르는 여행",369,428],[9,"별들의 삶과 죽음",429,484],[10,"영원의 벼랑 끝",485,540],[11,"미래로 가는 편지",541,592],[12,"은하 대백과사전",593,656],[13,"누가 우리 지구를 대변하는가",657,719]]},
  {id:"b008",isbn:"9788937460449",title:"데미안",author:"헤르만 헤세",pub:"민음사",total:248,cover:"https://image.aladin.co.kr/product/26/0/cover500/s742633278_2.jpg",fb:["#3A2E22","#7A5A38"],toc:[[1,"두 세계",1,24],[2,"카인",25,50],[3,"강도",51,76],[4,"베아트리체",77,100],[5,"새는 알에서 나오려고 투쟁한다",101,126],[6,"야콥 크노아워",127,150],[7,"에바 부인",151,176],[8,"최후",177,248]]},
  {id:"b010",isbn:"9788937460777",title:"1984",author:"조지 오웰",pub:"민음사",total:452,cover:"https://image.aladin.co.kr/product/41/89/cover500/s122531356_2.jpg",fb:["#C82F2F","#7E1A1A"],toc:[[1,"본문",1,452]]},
  {id:"b104",isbn:"9788937460043",title:"변신, 시골의사",author:"프란츠 카프카",pub:"민음사",total:288,cover:"https://image.aladin.co.kr/product/6/4/cover500/s972932230_1.jpg",fb:["#2A3F4F","#5A7388"],toc:[[1,"본문",1,288]]},
  {id:"b105",isbn:"9788937460050",title:"동물농장",author:"조지 오웰",pub:"민음사",total:184,cover:"https://image.aladin.co.kr/product/4/6/cover500/s93746005x_3.jpg",fb:["#E8B473","#A87844"],toc:[[1,"본문",1,184]]},
  {id:"b037",isbn:"9788937460471",title:"호밀밭의 파수꾼",author:"제롬 데이비드 샐린저",pub:"민음사",total:320,cover:"https://image.aladin.co.kr/product/30882/22/cover500/8937460475_2.jpg",fb:["#E8A53B","#B5722E"],toc:[[1,"본문",1,320]]},
  {id:"b093",isbn:"9788937460753",title:"위대한 개츠비",author:"프랜시스 스콧 피츠제럴드",pub:"민음사",total:308,cover:"https://image.aladin.co.kr/product/41/79/cover500/s582934787_1.jpg",fb:["#0B1F4D","#1E3A6F"],toc:[[1,"본문",1,308]]},
  {id:"b103",isbn:"9788937460036",title:"햄릿",author:"윌리엄 셰익스피어",pub:"민음사",total:248,cover:"https://image.aladin.co.kr/product/16/80/cover500/s962932230_1.jpg",fb:["#3A2E55","#6E5398"],toc:[[1,"본문",1,248]]},
  {id:"b325",isbn:"9788937443848",title:"이방인",author:"알베르 카뮈",pub:"민음사",total:280,cover:"https://image.aladin.co.kr/product/21224/66/cover500/8937443848_1.jpg",fb:["#E8E1C7","#B8AC7E"],toc:[[1,"본문",1,280]]},
  {id:"b337",isbn:"9788937462788",title:"노인과 바다",author:"어니스트 헤밍웨이",pub:"민음사",total:204,cover:"https://image.aladin.co.kr/product/1452/24/cover500/8937462788_3.jpg",fb:["#1E5C7B","#2F8AB5"],toc:[[1,"본문",1,204]]},
  {id:"b172",isbn:"9788937460883",title:"오만과 편견",author:"제인 오스틴",pub:"민음사",total:560,cover:"https://image.aladin.co.kr/product/43/68/cover500/s937460882_1.jpg",fb:["#8C2E48","#C45A77"],toc:[[1,"본문",1,560]]},
];

const BOOK_BY_ID = Object.fromEntries(RG_BOOKS.map(b => [b.id, b]));
function getBook(id){ return BOOK_BY_ID[id] || RG_BOOKS[0]; }

const INITIAL_PROGRESS = {
  "b008": { cur: 102, days: 12 },
  "b105": { cur: 88,  days: 5  },
  "b337": { cur: 64,  days: 3  },
  "b001": { cur: 21,  days: 8  },
};

/* ── 둥지 진화 5단계 — 1,600 XP 주기 (nest.md §5.2, #520 v8.1) ───────────────
   둥지는 책과 분리된 XP 시각화. 표시는 현재 주기 값(cycleXp = totalXp % 1600)으로 계산.
   주기 내 XP 임계값(상한, 이하 포함): 99 / 399 / 899 / 1599 / (1600=주기 완료). lv 1-based.
   Lv5(참새의 성)는 1,600 도달 순간의 주기 완료 단계 — 상시 표시는 Lv1-4, Lv5는 세리머니 전용.
   성 개수 = floor(totalXp / 1600). */
const NEST_CYCLE_XP = 1600;
const NEST_STAGES = [
  { lv: 1, minXp: 0,    maxXp: 99,   name: "나뭇가지 자리", short: "🌿", color: "#AFAFAF", bg: "#f3f4f6" },
  { lv: 2, minXp: 100,  maxXp: 399,  name: "빈 둥지",       short: "🪹", color: "#F59E0B", bg: "#FEF3C7" },
  { lv: 3, minXp: 400,  maxXp: 899,  name: "따뜻한 둥지",   short: "🪺", color: "#58CC02", bg: "#F0FDF4" },
  { lv: 4, minXp: 900,  maxXp: 1599, name: "다정한 집",     short: "🐣", color: "#1CB0F6", bg: "#EFF6FF" },
  { lv: 5, minXp: 1600, maxXp: null, name: "참새의 성",     short: "🏰", color: "#CE82FF", bg: "#FAF5FF" },
];
// 현재 1,600 XP 주기 내 누적 XP (0~1599).
function nestCycleXp(totalXp){ return Math.max(0, totalXp || 0) % NEST_CYCLE_XP; }
// 획득한 성 개수 = floor(totalXp / 1600). 완독 권수와 무관(#520).
function nestCastleCount(totalXp){ return Math.floor(Math.max(0, totalXp || 0) / NEST_CYCLE_XP); }
// 누적 XP → 둥지 단계 (#520). 현재 주기 XP(cycleXp)로 매핑 — 책 진척률 아님.
// cycleXp 는 0~1599 이므로 상시 반환은 Lv1-4. Lv5(성)는 1,600 경계 통과 세리머니 전용.
function getNestStageByXp(totalXp){
  const c = nestCycleXp(totalXp);
  return NEST_STAGES.find(s => s.maxXp == null || c <= s.maxXp) || NEST_STAGES[0];
}
// 현재 1,600 XP 주기 진행도 % (둥지 일러스트 트윅·세리머니). cycleXp / 1600.
function nestXpProgress(totalXp){
  return Math.max(0, Math.min(100, Math.round(nestCycleXp(totalXp) / NEST_CYCLE_XP * 100)));
}
// 현재 "단계 구간" 진척 (#682) — 현재 단계 시작 XP를 0, 다음 단계 임계값을 분모로.
// 예) 빈 둥지(100~399) 구간에서 cycleXp=342 → into=242, span=300, next.minXp=400.
// 반환: { stage, next, intoXp(현재 단계 진입 XP), spanXp(분모), pct, isMax }.
// isMax=true 면 최고 단계(다음 임계값 없음) — 분모 없음, "최고 단계"로 표기.
function nestStageProgress(totalXp){
  const c = nestCycleXp(totalXp);
  const stage = getNestStageByXp(totalXp);
  const { next } = nestInfo(stage.lv);
  if (!next) {
    // 최고 단계(참새의 성) — 주기 완료 직전. 다음 임계값 없음.
    return { stage, next: null, intoXp: c - stage.minXp, spanXp: 0, pct: 100, isMax: true };
  }
  const intoXp = Math.max(0, c - stage.minXp);
  const spanXp = Math.max(1, next.minXp - stage.minXp);
  const pct = Math.max(0, Math.min(100, Math.round(intoXp / spanXp * 100)));
  return { stage, next, intoXp, spanXp, pct, isMax: false };
}

/* ── 진화 마이크로카피 4종 (nest.md §5.2) ─────────
   단계 상승 시 toast. from/to 는 NEST_STAGES.lv (1-based). */
const NEST_STAGE_TRANSITIONS = [
  { from: 1, to: 2, text: "참새가 자리를 잡았어요!" },
  { from: 2, to: 3, text: "참새가 살림을 차렸어요!" },
  { from: 3, to: 4, text: "다정한 이웃이 되었어요!" },
  { from: 4, to: 5, text: "전설의 참새 성주!" },
];
// fromLv < toLv 일 때 가장 높은 도달 단계의 카피 반환(여러 단계 점프 시 최종 단계).
function getEvolutionCopy(fromLv, toLv){
  if (toLv <= fromLv) return null;
  const t = NEST_STAGE_TRANSITIONS.find(x => x.to === toLv) ||
            [...NEST_STAGE_TRANSITIONS].reverse().find(x => x.to > fromLv && x.to <= toLv);
  return t ? t.text : null;
}

/* ── XP 보상 — systems.md §6.3 SSOT (v7.1 행동 가중치) ──
   1) 위계: 핵심 기여(읽고 한 줄) > 반응(주는 짹) > 단순 방문. 방문도 0 아님.
   2) 레벨 곡선: 초반 쉽게, 후반 더디게(루트). 3) v7: XP 차감 없음. */
const XP_RULES = {
  dailyMission:     20,
  reaction:          5,
  reactionDailyMax: 20,
  visit:             2,
  bookComplete:    200,
  streak7:         100,
  streak30:        500,
};
function calcLevel(xp){ return Math.floor(Math.sqrt(Math.max(0, xp || 0) / 100)) + 1; }
function xpForLevel(level){ const l = Math.max(1, level); return Math.pow(l - 1, 2) * 100; }
function computeCheckinXp({ isNewDay, isComplete, newStreak }){
  const parts = [];
  if (isNewDay) parts.push({ key:'daily', label:'읽고 한 줄', xp: XP_RULES.dailyMission, ico:'📖' });
  if (isComplete) parts.push({ key:'complete', label:'책 완독', xp: XP_RULES.bookComplete, ico:'🏰' });
  if (newStreak === 7)  parts.push({ key:'streak7',  label:'7일 스트릭',  xp: XP_RULES.streak7,  ico:'🔥' });
  if (newStreak === 30) parts.push({ key:'streak30', label:'30일 스트릭', xp: XP_RULES.streak30, ico:'🔥' });
  return { total: parts.reduce((s,p)=>s+p.xp,0), parts };
}
function reactionXpFor(prevCount){
  const already = Math.max(0, prevCount || 0) * XP_RULES.reaction;
  if (already >= XP_RULES.reactionDailyMax) return 0;
  return Math.min(XP_RULES.reaction, XP_RULES.reactionDailyMax - already);
}
function grantXp(amount, reason){
  const amt = Math.max(0, amount || 0);
  if (!amt) return 0;
  try { if (window.DataStore && DataStore.xp && DataStore.xp.add) DataStore.xp.add(amt, reason || 'earn'); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('rg:xp', { detail: { amount: amt, reason } })); } catch (e) {}
  return amt;
}

const NPC_QUOTES = {
  "b008": [
    { nick:"@activist_raccoon", avatar:"🦝", page:120, q:"새는 알에서 나오려고 투쟁한다. 알은 세계다. 태어나려는 자는 한 세계를 깨뜨려야 한다.", time:"2시간 전", claps:34 },
    { nick:"@fox_c", avatar:"🦊", page:88, q:"우리가 한 인간을 미워한다면, 우리는 그의 모습 속에서 우리 자신 안에 들어앉아 있는 무엇인가를 보고 미워하는 것이다.", time:"어제", claps:18 },
    { nick:"@quiet_rabbit", avatar:"🐰", page:152, q:"운명과 마음은 같은 개념의 두 이름이다.", time:"이틀 전", claps:11 },
  ],
  "b001": [
    { nick:"@book_bear", avatar:"🐻", page:412, q:"역사는 한 가지 철칙을 따른다 — 사후에 보면 모든 것이 필연이지만, 그 순간에는 우연이었다.", time:"3시간 전", claps:21 },
  ],
  "b002": [
    { nick:"@owl_n", avatar:"🦉", page:540, q:"우리는 별의 먼지로 만들어져 있다. 우주가 자기 자신을 들여다보는 한 방식이다.", time:"5시간 전", claps:29 },
  ],
  "b010": [
    { nick:"@quiet_rabbit", avatar:"🐰", page:120, q:"누가 과거를 지배하는가가 미래를 지배한다. 누가 현재를 지배하는가가 과거를 지배한다.", time:"어제", claps:24 },
  ],
  "b105": [
    { nick:"@raccoon_a", avatar:"🦝", page:22, q:"모든 동물은 평등하다. 그러나 어떤 동물은 더 평등하다.", time:"이틀 전", claps:42 },
  ],
  "b093": [
    { nick:"@curious_fox", avatar:"🦊", page:156, q:"그래서 우리는 더 앞으로 나아간다, 흐름을 거슬러 끊임없이 과거로 떠밀려 가면서.", time:"4시간 전", claps:33 },
  ],
  "b337": [
    { nick:"@deer_s", avatar:"🦌", page:88, q:"인간은 파괴될 수는 있어도, 패배할 수는 없다.", time:"오늘 아침", claps:45 },
  ],
  "b325": [
    { nick:"@fox_c", avatar:"🦊", page:140, q:"오늘 엄마가 죽었다. 아니, 어쩌면 어제. 잘 모르겠다.", time:"3일 전", claps:19 },
  ],
  "b103": [
    { nick:"@book_bear", avatar:"🐻", page:88, q:"죽느냐 사느냐, 그것이 문제로다.", time:"오늘", claps:55 },
  ],
  "b104": [
    { nick:"@activist_raccoon", avatar:"🦝", page:42, q:"어느 날 아침 그레고르 잠자가 불안한 꿈에서 깨어났을 때, 자신이 침대에서 한 마리 거대한 해충으로 변해 있음을 발견했다.", time:"어제", claps:27 },
  ],
  "b037": [
    { nick:"@curious_fox", avatar:"🦊", page:198, q:"미성숙한 인간의 특징은 어떤 명분을 위해 고결하게 죽으려 하는 것이고, 성숙한 인간의 특징은 그 명분을 위해 비겁하게 살아가려 하는 것이다.", time:"이틀 전", claps:22 },
  ],
  "b172": [
    { nick:"@quiet_rabbit", avatar:"🐰", page:240, q:"나는 그 자존심을 미워할 정도로 마음에 두지 않았다. 그것은 또한 정당한 자존심이었으므로.", time:"3일 전", claps:14 },
  ],
};

const _ab = getBook("b008");
const _ap = INITIAL_PROGRESS["b008"];
const INITIAL_STATE = {
  book: {
    id: _ab.id, title: _ab.title, author: _ab.author, pub: _ab.pub,
    cur: _ap.cur, total: _ab.total, days: _ap.days,
    cover: _ab.cover, fb: _ab.fb, toc: _ab.toc,
  },
  streak: 12,
  xp: 340,
  shield: 2,
  // 둥지 단계는 누적 XP에서 파생 (#313, §5.2). xp(위 340)와 동일 값 사용.
  nest: { lv: getNestStageByXp(340).lv },
  myQuotes: [
    { text: "내가 갖고 싶었던 것은 사람이 아니라 진실이었다.", bookId: "b008", page: 87, when: "어제" },
    { text: "두 세계 사이의 경계는, 결국 내 안에 있었다.",       bookId: "b008", page: 22, when: "3일 전" },
  ],
};

/* ── 완독 기록 (책장) ─────────────────────────── */
// 완독 책(성 컬렉션). 활성 책(_ab=b008, 읽는 중)은 제외 — 같은 책이 읽는 중·완독 양쪽에 뜨지 않도록.
const INITIAL_BOOKSHELF = {
  "b105": { rating: 4, comment: "사회 비판의 대표작. 간결하면서도 강력한 메시지.", completedDate: "2026-05-18" },
  "b037": { rating: 5, comment: "청춘의 방황과 성장. 모든 세대의 공감을 받을 책.", completedDate: "2026-05-15" },
};

/* ── 찜 목록 (읽고 싶은 책) ──────────────────────── */
const WISHLIST = ["b002", "b010", "b093"];

/* ── NEST_TWIGS 사전 계산 ─────────────────────── */
const NEST_GEO = { cx: 110, cy: 132, rx: 60, ry: 22, irx: 44, iry: 13 };

const NEST_TWIGS = (function(){
  const G = NEST_GEO;
  const palette = ['#E6C49B','#D4A574','#C19660','#B0834E','#9D6D3C','#8C5E33','#7A4F2C','#6B4423','#A07043','#915E2D'];
  const phi = 137.508;
  function rimPt(a, rs){ const t=a*Math.PI/180; return {x:G.cx+G.rx*rs*Math.cos(t),y:G.cy+G.ry*rs*Math.sin(t)}; }
  const bases=[];
  for(let i=0;i<4;i++){
    const sa=200+i*30,sp=140-i*10,ea=sa+sp;
    const s=rimPt(sa,1.02),e=rimPt(ea,1.02),cp=rimPt(sa+sp/2,1.18);
    bases.push({type:'base',path:`M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`,col:['#4E3120','#5A3A1F','#6B4423','#7A4F2C'][i],sw:3.6-i*0.3,op:0.88,front:true});
  }
  const fibers=[];
  for(let i=0;i<130;i++){
    const sa=(i*phi)%360,sp=50+((i*23)%80),ea=sa+sp;
    const rs=0.92+((i*7)%6)*0.02,re=0.92+((i*5+3)%6)*0.02;
    const s=rimPt(sa,rs),e=rimPt(ea,re);
    const ar=sp*Math.PI/180,bulge=0.04+0.28*Math.sin(ar/2),ma=sa+sp/2;
    const cp=rimPt(ma,1.0+bulge);
    const front=Math.sin(ma*Math.PI/180)>-0.18;
    fibers.push({type:'fiber',path:`M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`,col:palette[i%palette.length],sw:front?(1.1+(i%4)*0.25):(0.85+(i%4)*0.18),op:front?(0.72+(i%3)*0.07):(0.42+(i%3)*0.05),front});
  }
  const tendrils=[];
  for(let i=0;i<30;i++){
    const sa=(i*17+5)%360,s=rimPt(sa,1.0);
    const tipR=1.20+((i*7)%6)*0.025,drift=((i*13)%40)-20;
    const tip=rimPt(sa+drift,tipR),cp=rimPt(sa+drift/2,1.10);
    const front=Math.sin(sa*Math.PI/180)>-0.18;
    tendrils.push({type:'tendril',path:`M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${cp.x.toFixed(1)} ${cp.y.toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`,col:palette[(i+3)%palette.length],sw:0.85+(i%3)*0.18,op:0.55+(i%3)*0.05,front});
  }
  function interleave(...arrays){const out=[];let idx=0,added=true;while(added){added=false;for(const a of arrays){if(idx<a.length){out.push(a[idx]);added=true;}}idx++;}return out;}
  return [...bases,...interleave(fibers,tendrils)];
})();

/* ── 헬퍼 함수 ──────────────────────────────── */
// 진척률(0~100) → 둥지 일러스트에 쌓을 가지 수. 단계가 오를수록 둥지가 자란다.
function twigsForProgress(progressPct){
  const p = Math.max(0, Math.min(100, progressPct || 0));
  return Math.round((p / 100) * NEST_TWIGS.length);
}
// 현재/다음 단계 객체 (다음 단계 없으면 next=null).
function nestInfo(lv){
  const i = Math.max(0, Math.min(NEST_STAGES.length - 1, lv - 1));
  const cur = NEST_STAGES[i];
  const next = lv < NEST_STAGES.length ? NEST_STAGES[i + 1] : null;
  return { cur, next };
}

function drawNest(twigs, nestLv, prevTwigs){
  prevTwigs = prevTwigs||0;
  twigs=Math.max(0,Math.min(NEST_TWIGS.length,twigs));
  const G=NEST_GEO, lvNow=nestLv;
  const visible=NEST_TWIGS.slice(0,twigs).map((t,i)=>({...t,_origIdx:i}));
  const backTwigs=visible.filter(t=>!t.front);
  const frontTwigs=visible.filter(t=>t.front);
  function rt(t){const isNew=t._origIdx>=prevTwigs,ni=isNew?(t._origIdx-prevTwigs):0,cls=isNew?'twig twig-new':'twig';return`<path class="${cls}" style="--i:${t._origIdx};--new-i:${ni}" d="${t.path}" stroke="${t.col}" stroke-width="${t.sw.toFixed(2)}" fill="none" stroke-linecap="round" opacity="${t.op.toFixed(2)}"/>`;}
  function rimPt(a,rs){const t=a*Math.PI/180;return{x:G.cx+G.rx*rs*Math.cos(t),y:G.cy+G.ry*rs*Math.sin(t)};}
  const defs=`<defs><radialGradient id="g_sun" cx="50%" cy="30%" r="55%"><stop offset="0%" stop-color="#FFE9A8"/><stop offset="100%" stop-color="#FFFCEF" stop-opacity="0"/></radialGradient><radialGradient id="g_inner" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="#1A0E06"/><stop offset="45%" stop-color="#3A2410"/><stop offset="100%" stop-color="#6B4423" stop-opacity="0"/></radialGradient></defs>`;
  const clouds=`<g fill="#FFFFFF" opacity="0.7"><ellipse cx="48" cy="34" rx="13" ry="6"/><ellipse cx="58" cy="30" rx="10" ry="6"/><ellipse cx="38" cy="31" rx="8" ry="5"/></g><g fill="#FFFFFF" opacity="0.5"><ellipse cx="178" cy="46" rx="11" ry="5"/><ellipse cx="186" cy="43" rx="8" ry="5"/></g>`;
  const sky=`<circle cx="110" cy="36" r="55" fill="url(#g_sun)"/>${clouds}`;
  const skyBirds=lvNow>=4?`<g stroke="#7A6A52" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.55"><path d="M 36 44 Q 40 40 44 44 Q 48 40 52 44"/><path d="M 168 34 Q 171 31 174 34 Q 177 31 180 34"/></g>`:'';
  const ground=`<ellipse cx="${G.cx}" cy="${G.cy+G.ry+18}" rx="${G.rx*1.1}" ry="7" fill="rgba(30,15,5,.32)"/>`;
  const bowlOutline=twigs>=8?`<ellipse cx="${G.cx}" cy="${G.cy+2}" rx="${G.rx+2}" ry="${G.ry+3}" fill="none" stroke="#3A2410" stroke-width="2.5" opacity="0.18"/>`:'';
  const cavity=twigs>=25?`<ellipse cx="${G.cx}" cy="${G.cy+2}" rx="${G.irx}" ry="${G.iry}" fill="url(#g_inner)"/>`:'';
  const rim=twigs>=30?`<ellipse cx="${G.cx}" cy="${G.cy}" rx="${G.rx}" ry="${G.ry}" fill="none" stroke="#2A1810" stroke-width="0.5" opacity="0.20"/>`:'';
  const holdingTwig=lvNow===2,winking=lvNow===5,cheekHi=lvNow>=3;
  const sparrowBody=`<g class="sparrow-body"><ellipse cx="110" cy="128" rx="24" ry="16" fill="#F3CD9E" stroke="#C49460" stroke-width="1.2"/><ellipse cx="110" cy="133" rx="15" ry="10" fill="#FBE7C8"/><ellipse cx="90" cy="128" rx="6.5" ry="9.5" fill="#A07043" transform="rotate(-14 90 128)"/><ellipse cx="130" cy="128" rx="6.5" ry="9.5" fill="#A07043" transform="rotate(14 130 128)"/></g>`;
  const leftEye=winking?`<path d="M 99 102 Q 103 100 105 102" stroke="#2A2D33" stroke-width="1.8" fill="none" stroke-linecap="round"/>`:`<circle cx="102" cy="101" r="2.6" fill="#2A2D33"/><circle cx="103" cy="100" r="0.9" fill="#FFF"/>`;
  const rightEye=`<circle cx="118" cy="101" r="2.6" fill="#2A2D33"/><circle cx="119" cy="100" r="0.9" fill="#FFF"/>`;
  const beak=`<polygon points="105,108 115,108 110,114" fill="#F4B400" stroke="#C8901C" stroke-width="0.6"/>`+(holdingTwig?`<path d="M 115 110 Q 132 100 158 92" stroke="#6B4423" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="138" cy="100" rx="4.2" ry="2.1" fill="#5FAB5C" transform="rotate(-22 138 100)"/><ellipse cx="150" cy="93" rx="4.5" ry="2.3" fill="#3E7C3B" transform="rotate(-30 150 93)"/><ellipse cx="160" cy="89" rx="3.5" ry="1.8" fill="#5FAB5C" transform="rotate(-18 160 89)"/>`:'');
  const sparrowHead=`<g class="sparrow-head"><circle cx="110" cy="100" r="22" fill="#F3CD9E" stroke="#C49460" stroke-width="1.2"/><path d="M 88 95 Q 88 78 110 76 Q 132 78 132 95 Q 110 88 88 95 Z" fill="#7A4F2C" stroke="#5A3A1F" stroke-width="0.9"/><path d="M 103 76 L 100 67 L 106 75 Z" fill="#5A3A1F"/><path d="M 110 76 L 108 64 L 112 64 L 113 76 Z" fill="#5A3A1F"/><path d="M 117 76 L 120 67 L 114 75 Z" fill="#5A3A1F"/>${leftEye}${rightEye}${beak}<ellipse cx="93" cy="108" rx="4.2" ry="3.2" fill="#FFA8B8" opacity="${cheekHi?'0.88':'0.7'}"/><ellipse cx="127" cy="108" rx="4.2" ry="3.2" fill="#FFA8B8" opacity="${cheekHi?'0.88':'0.7'}"/><g class="sparrow-blink"><ellipse cx="102" cy="101" rx="3" ry="3.2" fill="#F3CD9E"/><ellipse cx="118" cy="101" rx="3" ry="3.2" fill="#F3CD9E"/></g></g>`;
  const leafAccents=lvNow>=4?`<g><ellipse cx="56" cy="138" rx="4" ry="2" fill="#5FAB5C" transform="rotate(-30 56 138)"/><ellipse cx="68" cy="148" rx="3" ry="1.6" fill="#3E7C3B" transform="rotate(-15 68 148)"/><ellipse cx="164" cy="138" rx="4" ry="2" fill="#5FAB5C" transform="rotate(30 164 138)"/><ellipse cx="152" cy="148" rx="3" ry="1.6" fill="#3E7C3B" transform="rotate(15 152 148)"/></g>`:'';
  let sparkles='';
  if(lvNow>=4)sparkles+=`<g fill="#FFD66B"><polygon points="178,84 180,90 186,90 181,93 183,99 178,95 173,99 175,93 170,90 176,90"/></g>`;
  if(lvNow>=4)sparkles+=`<g fill="#FFD66B"><polygon points="40,90 42,96 48,96 43,99 45,105 40,101 35,105 37,99 32,96 38,96"/></g>`;
  if(lvNow>=5)sparkles+=`<g fill="#FFD66B" opacity="0.9"><polygon points="195,128 197,134 203,134 198,137 200,143 195,139 190,143 192,137 187,134 193,134"/><polygon points="22,128 24,134 30,134 25,137 27,143 22,139 17,143 19,137 14,134 20,134"/></g>`;
  const leafyRoof=lvNow>=4?`<g><path d="M 54 102 Q 76 60 110 54 Q 144 60 166 102 Q 110 92 54 102 Z" fill="#6BB562" stroke="#3E7C3B" stroke-width="1.5"/><ellipse cx="76" cy="92" rx="5" ry="3" fill="#7CBF7A" transform="rotate(-22 76 92)"/><ellipse cx="110" cy="68" rx="6" ry="3.5" fill="#7CBF7A"/><ellipse cx="144" cy="92" rx="5" ry="3" fill="#7CBF7A" transform="rotate(22 144 92)"/><g><circle cx="78" cy="80" r="2" fill="#fff" opacity="0.92"/><circle cx="74" cy="78" r="1.8" fill="#fff" opacity="0.92"/><circle cx="82" cy="78" r="1.8" fill="#fff" opacity="0.92"/><circle cx="74" cy="82" r="1.8" fill="#fff" opacity="0.92"/><circle cx="82" cy="82" r="1.8" fill="#fff" opacity="0.92"/><circle cx="78" cy="80" r="1.3" fill="#FFD66B"/></g></g>`:'';
  const chimney=lvNow===5?`<g><rect x="130" y="56" width="9" height="14" fill="#7A4F2C" stroke="#5A3A1F" stroke-width="0.8" rx="1"/><ellipse cx="134.5" cy="56" rx="5" ry="1.2" fill="#3E7C3B"/></g>`:'';
  const branchBase=lvNow===5?`<g><path d="M 28 174 Q 110 170 202 176" stroke="#6B4423" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M 30 172 Q 110 168 200 174" stroke="#A87544" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/></g>`:'';
  const standMode=lvNow<=2,birdY=lvNow===1?20:(lvNow===2?12:0),birdT=standMode?`transform="translate(0 ${birdY})"`:'';
  const feet=standMode?`<g ${birdT}><ellipse cx="102" cy="146" rx="2.6" ry="1.4" fill="#F4B400" stroke="#C8901C" stroke-width="0.5"/><ellipse cx="118" cy="146" rx="2.6" ry="1.4" fill="#F4B400" stroke="#C8901C" stroke-width="0.5"/><line x1="100" y1="146" x2="102" y2="148.5" stroke="#C8901C" stroke-width="0.6"/><line x1="104" y1="146" x2="102" y2="148.5" stroke="#C8901C" stroke-width="0.6"/><line x1="116" y1="146" x2="118" y2="148.5" stroke="#C8901C" stroke-width="0.6"/><line x1="120" y1="146" x2="118" y2="148.5" stroke="#C8901C" stroke-width="0.6"/></g>`:'';
  const motionMarks=lvNow===1?`<g stroke="#7A4F2C" stroke-width="2" stroke-linecap="round" fill="none"><line x1="48" y1="118" x2="40" y2="110"/><line x1="44" y1="126" x2="34" y2="124"/></g>`:'';
  const useTwigRing=lvNow===1;
  const twigRing=useTwigRing?`<g><ellipse cx="110" cy="186" rx="48" ry="5" fill="rgba(60,40,20,.22)"/><path d="M 64 170 Q 110 158 156 170" stroke="#6B4423" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/><path d="M 62 178 Q 110 186 158 178" stroke="#6B4423" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="62" cy="174" rx="4.5" ry="2.2" fill="#5FAB5C" transform="rotate(-30 62 174)"/><ellipse cx="158" cy="174" rx="4.5" ry="2.2" fill="#3E7C3B" transform="rotate(30 158 174)"/></g>`:'';
  const wrap=(c)=>standMode?`<g ${birdT}>${c}</g>`:c;
  const bodyLayer=wrap(sparrowBody);
  const headW=wrap(sparrowHead);
  let dec=lvNow>=4?(skyBirds+leafAccents+headW+leafyRoof+chimney+sparkles):(leafAccents+headW+sparkles+motionMarks);
  return `<svg class="nest-art" viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg">${defs}${sky}${ground}${branchBase}${useTwigRing?twigRing:`${bowlOutline}<g class="twig-layer back">${backTwigs.map(rt).join('')}</g>${cavity}`}${bodyLayer}${feet}${useTwigRing?'':`${rim}<g class="twig-layer front">${frontTwigs.map(rt).join('')}</g>`}${dec}</svg>`;
}

/* ── TSV 책 로더 ──────────────────────────────────── */
// 표지 그라데이션 팔레트 (TSV에 fb 없으므로 book_id 해시로 선택)
const _FB_PALETTE = [
  ['#F4D9A8','#E8B473'],['#1A3A6E','#3A6FB0'],['#3A2E22','#7A5A38'],
  ['#C82F2F','#7E1A1A'],['#2A3F4F','#5A7388'],['#E8B473','#A87844'],
  ['#E8A53B','#B5722E'],['#0B1F4D','#1E3A6F'],['#3A2E55','#6E5398'],
  ['#E8E1C7','#B8AC7E'],['#1E5C7B','#2F8AB5'],['#8C2E48','#C45A77'],
  ['#4A6741','#2D4A2A'],['#6B3A2A','#9E5C42'],['#2A4A6B','#4A7A9B'],
  ['#5A3A6B','#8B6B9B'],['#6B5A2A','#9B8542'],['#3A6B5A','#5A9B8B'],
];
function _fbForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return _FB_PALETTE[h % _FB_PALETTE.length];
}

// 인라인 12권의 fb/toc 오버라이드 맵 (id 기준)
const _SEED_META = Object.fromEntries(RG_BOOKS.map(b => [b.id, { fb: b.fb, toc: b.toc }]));
// #490(A): isbn13 매칭 — Supabase 책(uuid id)에도 인라인 12권의 fb/toc 시드를 isbn 으로 잇는다.
const _SEED_META_BY_ISBN = Object.fromEntries(RG_BOOKS.filter(b => b.isbn).map(b => [b.isbn, { fb: b.fb, toc: b.toc }]));

let _booksCache = null;

// 책 인덱스 — id + isbn13 양쪽 키로 BOOK_BY_ID 채움 (#490 A: isbn13 매칭으로 b001↔uuid 동일시).
function _indexBooks(list) {
  (list || []).forEach((b) => {
    if (b.id) window.BOOK_BY_ID[b.id] = b;
    if (b.isbn) window.BOOK_BY_ID[b.isbn] = b;
  });
}
// Supabase books 행 → data.js book 형태. fb/toc 는 isbn 시드(없으면 기본).
function _mapDbBook(b) {
  const id = String(b.id || '');
  const isbn = String(b.isbn13 || b.isbn || '').trim();
  const seed = _SEED_META[id] || (isbn ? _SEED_META_BY_ISBN[isbn] : null);
  return {
    id,
    isbn,
    title: (b.title || '').trim(),
    author: (b.author || '').trim(),
    pub: (b.publisher || '').trim(),
    total: parseInt(b.total_pages, 10) || 0,
    cover: (b.cover_url || '').trim(),
    description: (b.description || '').trim(),
    fb: seed ? seed.fb : _fbForId(id),
    toc: seed ? seed.toc : [],
  };
}

async function loadBooks() {
  if (_booksCache) return _booksCache;
  // #490(A): Supabase `books` 가 canonical. 게스트도 publishable key + anon RLS read 로 같은 카탈로그.
  // 책 식별은 isbn13 매칭(id 체계 b001↔uuid 무관). 실패/빈/미설정 → 정적 TSV 폴백(데모 무중단).
  try {
    const sb = (window.RG_SB && window.RG_SB.client) ? window.RG_SB.client() : null;
    if (sb) {
      const { data, error } = await sb.from('books')
        .select('id,isbn13,title,author,publisher,total_pages,cover_url,description')
        .limit(2000);
      if (!error && Array.isArray(data) && data.length) {
        _booksCache = data.map(_mapDbBook).filter(b => b.id && b.title);
        _indexBooks(_booksCache);
        return _booksCache;
      }
    }
  } catch (e) {
    console.warn('[ReadingGo] Supabase books 로드 실패, TSV 폴백:', e && e.message);
  }
  // 폴백: 정적 TSV (네트워크/부팅 실패·게스트 미설정 시 최소 보장)
  try {
    const res = await fetch('data/books.tsv?v=1');
    if (!res.ok) throw new Error('books.tsv HTTP ' + res.status);
    const text = await res.text();
    const lines = text.trim().split('\n');
    // 첫 줄 헤더 skip
    _booksCache = lines.slice(1).map(line => {
      const [book_id, isbn, title, author, publisher, total_pages, cover_url] = line.split('\t');
      const id = book_id.trim();
      const seed = _SEED_META[id];
      return {
        id,
        isbn: (isbn||'').trim(),
        title: (title||'').trim(),
        author: (author||'').trim(),
        pub: (publisher||'').trim(),
        total: parseInt(total_pages, 10) || 0,
        cover: (cover_url||'').trim(),
        fb: seed ? seed.fb : _fbForId(id),
        toc: seed ? seed.toc : [],
      };
    }).filter(b => b.id && b.title);
    _indexBooks(_booksCache);  // id + isbn13 인덱스 (#490 A)
    return _booksCache;
  } catch (e) {
    console.warn('[ReadingGo] books.tsv 로드 실패, 인라인 12권 사용:', e.message);
    _booksCache = RG_BOOKS;
    _indexBooks(_booksCache);
    return _booksCache;
  }
}

function fuzzySearch(books, query) {
  if (!query || !query.trim()) return books;
  const q = query.trim().toLowerCase();
  return books.filter(b =>
    b.title.toLowerCase().includes(q) ||
    b.author.toLowerCase().includes(q) ||
    b.pub.toLowerCase().includes(q)
  );
}

// 검색용 ALL_BOOKS: books.tsv 형식으로 변환
const ALL_BOOKS = RG_BOOKS.map(b => ({
  book_id: b.id,
  isbn: b.isbn,
  title: b.title,
  author: b.author,
  publisher: b.pub,
  total_pages: b.total,
  cover_url: b.cover,
}));

// ── 관련 도서 추천 (#496) ─────────────────────────────
// worker /api/related(LLM)가 {isbn, title, author} 후보를 주면, LLM이 준 ISBN을 신뢰하지 않고
// 실존 books DB의 ISBN과 정확 일치(+ 정규화 제목 일치)일 때만 실제 책 객체를 돌려준다(ISBN 환각 필터).
// 결과는 책 단위 메모리 캐시. Phase 0은 LLM 추천 기반. Supabase '함께 읽은 사람들' 집계는 Phase 1 (#496 결정).
const _relatedCache = {};
// ISBN-13 정규화 — 숫자만 남겨 정확히 13자리일 때만 반환, 아니면 '' (누락·형식 오류는 빈 문자열).
function normalizeIsbn13(s) {
  const d = String(s == null ? '' : s).replace(/[^0-9]/g, '');
  return d.length === 13 ? d : '';
}
function _normTitle(t) {
  return String(t || '').toLowerCase().replace(/[\s·,.:;!?'"“”‘’()\[\]<>「」『』、~\-_]/g, '').trim();
}
// 정규화 제목 완전 일치(부분/prefix 아님). ISBN이 정확히 일치한 DB 책의 제목이 후보 제목과 같은지 확인.
function _titleEq(a, b) {
  const x = _normTitle(a), y = _normTitle(b);
  return !!x && x === y;
}
// ISBN 환각 필터 (순수 함수 — 테스트 가능). LLM 후보 {isbn,title,author} 중 다음만 통과:
//  · ISBN-13 형식이 유효하고  · 현재 책 ISBN이 아니며  · 중복 ISBN이 아니고
//  · DB에 그 ISBN이 실재하며  · DB 책의 정규화 제목이 후보 제목과 일치.
// 반환은 매칭된 실제 DB 책 객체 배열. 제목 prefix/부분 매칭은 환각 필터로 쓰지 않는다.
function filterRelatedCandidates(candidates, dbBooks, selfIsbn, limit = 6) {
  const self = normalizeIsbn13(selfIsbn);
  const byIsbn = new Map();
  for (const b of (dbBooks || [])) {
    const bi = normalizeIsbn13(b && b.isbn);
    if (bi && !byIsbn.has(bi)) byIsbn.set(bi, b);
  }
  const out = [];
  const used = new Set();
  for (const c of (candidates || [])) {
    if (!c || typeof c !== 'object') continue;
    const ci = normalizeIsbn13(c.isbn);
    if (!ci) continue;                            // ISBN 누락/형식 오류
    if (self && ci === self) continue;            // 현재 책과 동일 ISBN
    if (used.has(ci)) continue;                   // 중복 ISBN
    const db = byIsbn.get(ci);
    if (!db) continue;                            // DB 미존재(지어낸 ISBN)
    if (!_titleEq(db.title, c.title)) continue;   // ISBN-제목 불일치
    used.add(ci);
    out.push(db);
    if (out.length >= limit) break;
  }
  return out;
}
async function recommendRelated(book, limit = 6) {
  if (!book || !book.title) return [];
  const ck = book.id || book.isbn || book.title;
  if (_relatedCache[ck]) return _relatedCache[ck];
  let suggestions = [];
  try {
    const res = await fetch('/api/related', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: book.title, author: book.author || '', isbn: book.isbn || '' }),
    });
    if (res.ok) { const d = await res.json(); suggestions = (d && d.books) || []; }
  } catch (e) { suggestions = []; }
  if (!suggestions.length) { _relatedCache[ck] = []; return []; }
  // ISBN 환각 필터 — 실존 books DB의 ISBN과 정확 일치(+제목 일치) 시만 통과.
  const all = await loadBooks();
  const out = filterRelatedCandidates(suggestions, all, book.isbn, limit);
  _relatedCache[ck] = out;
  return out;
}

/* 공유 OCR 헬퍼 (#939) — 책 사진 한 장 → worker /api/ocr(Upstage Document OCR + solar-pro3 보정)
   → 한 문장 텍스트. 읽기모드 빠른입력(#498 nest.js runOcrQuick)과 온보딩 '사진으로 시작'(SearchModal)이
   같은 호출을 쓰도록 단일화(중복 구현 금지). 게스트도 호출 가능 — ocrProxy 는 동일출처만 요구, 인증 없음.
   반환: { text, empty, error } (배타). 호출측이 토스트·busy·tracking 을 담당. 키 미설정/네트워크 실패는 error. */
const OCR_MAX_BYTES = 8 * 1024 * 1024;   // 8MB — ocrProxy OCR_MAX_BYTES 와 동일
function ocrExtractSentence(file) {
  if (!file) return Promise.resolve({ text: '', empty: true });
  if (file.size && file.size > OCR_MAX_BYTES) return Promise.resolve({ text: '', error: 'too_large' });
  const fd = new FormData();
  fd.append('document', file, file.name || 'page.jpg');
  return fetch('/api/ocr', { method: 'POST', body: fd })
    .then((r) => r.json().catch(() => ({})))
    .then((d) => {
      if (d && d.text) return { text: String(d.text).slice(0, 1000) };
      if (d && d.empty) return { text: '', empty: true };
      return { text: '', error: (d && d.error) || 'failed' };
    })
    .catch(() => ({ text: '', error: 'network' }));
}

window.RG_BOOKS=RG_BOOKS; window.BOOK_BY_ID=BOOK_BY_ID; window.getBook=getBook;
window.INITIAL_PROGRESS=INITIAL_PROGRESS;
window.NEST_STAGES=NEST_STAGES; window.NEST_CYCLE_XP=NEST_CYCLE_XP;
window.getNestStageByXp=getNestStageByXp; window.nestXpProgress=nestXpProgress;
window.nestCycleXp=nestCycleXp; window.nestCastleCount=nestCastleCount;
window.nestStageProgress=nestStageProgress;
window.NEST_STAGE_TRANSITIONS=NEST_STAGE_TRANSITIONS; window.getEvolutionCopy=getEvolutionCopy;
window.XP_RULES=XP_RULES; window.calcLevel=calcLevel; window.xpForLevel=xpForLevel; window.computeCheckinXp=computeCheckinXp;
window.reactionXpFor=reactionXpFor; window.grantXp=grantXp;
window.NPC_QUOTES=NPC_QUOTES; window.INITIAL_STATE=INITIAL_STATE;
window.INITIAL_BOOKSHELF=INITIAL_BOOKSHELF; window.WISHLIST=WISHLIST;
window.ALL_BOOKS=ALL_BOOKS;
window.NEST_TWIGS=NEST_TWIGS; window.NEST_GEO=NEST_GEO;
window.twigsForProgress=twigsForProgress; window.nestInfo=nestInfo; window.drawNest=drawNest;
window.loadBooks=loadBooks; window.fuzzySearch=fuzzySearch; window.recommendRelated=recommendRelated;
window.ocrExtractSentence=ocrExtractSentence;
window.normalizeIsbn13=normalizeIsbn13; window.filterRelatedCandidates=filterRelatedCandidates;
