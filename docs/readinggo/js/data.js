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

/* ── 둥지 진화 5단계 (nest.md §5.2) ───────────────
   단계 = 활성 책 진척률(current_page/total_pages*100), XP·스트릭 무관.
   진척률 임계값(상한, 이하 포함): 20 / 50 / 80 / 99 / 100. lv 1-based. */
const NEST_STAGES = [
  { lv: 1, max: 20,  name: "나뭇가지 자리", short: "🪵", color: "#AFAFAF", bg: "#f3f4f6" },
  { lv: 2, max: 50,  name: "빈 둥지",       short: "🪹", color: "#F59E0B", bg: "#FEF3C7" },
  { lv: 3, max: 80,  name: "따뜻한 둥지",   short: "🏠", color: "#58CC02", bg: "#F0FDF4" },
  { lv: 4, max: 99,  name: "다정한 집",     short: "🏡", color: "#1CB0F6", bg: "#EFF6FF" },
  { lv: 5, max: 100, name: "참새의 성",     short: "🏰", color: "#CE82FF", bg: "#FAF5FF" },
];
// 진척률(0~100) → 단계 객체. 경계 포함(<=).
function getNestStage(progressPct){
  const p = Math.max(0, Math.min(100, progressPct || 0));
  return NEST_STAGES.find(s => p <= s.max) || NEST_STAGES[NEST_STAGES.length - 1];
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
    id: _ab.id, title: _ab.title,
    author: _ab.author + " · " + _ab.pub,
    cur: _ap.cur, total: _ab.total, days: _ap.days,
    cover: _ab.cover, fb: _ab.fb, toc: _ab.toc,
  },
  streak: 12,
  xp: 340,
  shield: 2,
  // 둥지 단계는 활성 책 진척률에서 파생 (§5.2). cur/total 로 초기 단계 계산.
  nest: { lv: getNestStage(Math.round(_ap.cur / _ab.total * 100)).lv },
  myQuotes: [
    { text: "내가 갖고 싶었던 것은 사람이 아니라 진실이었다.", bookId: "b008", page: 87, when: "어제", isSpoiler: false },
    { text: "두 세계 사이의 경계는, 결국 내 안에 있었다.",       bookId: "b008", page: 22, when: "3일 전", isSpoiler: false },
  ],
  village: [
    { name: "book_bear", nest: "🏰", on: true,  streak: 64, sent: false, bookId: "b001", page: 412 },
    { name: "rabbit_q",  nest: "🏡", on: true,  streak: 21, sent: false, bookId: "b093", page: 156 },
    { name: "fox_c",     nest: "🏠", on: true,  streak: 9,  sent: false, bookId: "b008", page: 88  },
    { name: "raccoon_a", nest: "🪹", on: false, streak: 0,  sent: false, bookId: "b105", page: 22  },
    { name: "owl_n",     nest: "🏰", on: true,  streak: 88, sent: true,  bookId: "b002", page: 540 },
    { name: "deer_s",    nest: "🪵", on: false, streak: 0,  sent: false, bookId: "b337", page: 12  },
  ],
  towns: [
    {
      id: "town_001",
      bookId: "b001",
      name: "사피엔스 읽고 생각하기",
      memberCount: 7,
      currentPart: 2,
      totalParts: 5,
      dday: -4,
      isOpen: true,
      leader: "@book_bear",
      milestones: [
        { part: 1, dueDate: "5/15", completed: true },
        { part: 2, dueDate: "5/28", completed: false },
        { part: 3, dueDate: "6/10", completed: false },
        { part: 4, dueDate: "6/22", completed: false },
        { part: 5, dueDate: "7/5", completed: false },
      ],
      members: [
        { name: "book_bear",      nest: "🏰", avatar: "🐻", todayRecorded: true,  quote: "역사의 진실을 아는 것의 중요성", cumulativePage: 412, streak: 64, xp: 920 },
        { name: "jerome",         nest: "🏠", avatar: "🐦", todayRecorded: true,  quote: "인간이 정말 이렇게 변했나?", cumulativePage: 87, streak: 12, xp: 340 },
        { name: "quiet_rabbit",   nest: "🏡", avatar: "🐰", todayRecorded: false, quote: "", cumulativePage: 245, streak: 21, xp: 740 },
        { name: "curious_fox",    nest: "🏠", avatar: "🦊", todayRecorded: true,  quote: "문명의 발전 과정이 흥미로워", cumulativePage: 198, streak: 9, xp: 510 },
        { name: "owl_n",          nest: "🏰", avatar: "🦉", todayRecorded: true,  quote: "과학혁명이 정말 인상적이었다", cumulativePage: 340, streak: 88, xp: 620 },
        { name: "deer_s",         nest: "🪵", avatar: "🦌", todayRecorded: false, quote: "", cumulativePage: 45, streak: 0, xp: 120 },
        { name: "raccoon_a",      nest: "🪹", avatar: "🦝", todayRecorded: true,  quote: "인지혁명 부분이 제일 좋아", cumulativePage: 156, streak: 15, xp: 380 },
      ],
    },
    {
      id: "town_002",
      bookId: "b010",
      name: "1984 북클럽",
      memberCount: 12,
      currentPart: 3,
      totalParts: 4,
      dday: 1,
      isOpen: true,
      leader: "@quiet_rabbit",
      milestones: [
        { part: 1, dueDate: "5/10", completed: true },
        { part: 2, dueDate: "5/20", completed: true },
        { part: 3, dueDate: "5/30", completed: false },
        { part: 4, dueDate: "6/8", completed: false },
      ],
      members: [
        { name: "quiet_rabbit",   nest: "🏡", avatar: "🐰", todayRecorded: true,  quote: "빅브라더의 감시 시스템이 소름끼쳤다", cumulativePage: 310, streak: 21, xp: 740 },
        { name: "book_bear",      nest: "🏰", avatar: "🐻", todayRecorded: true,  quote: "미래는 이렇지 않길 바란다", cumulativePage: 298, streak: 64, xp: 920 },
        { name: "curious_fox",    nest: "🏠", avatar: "🦊", todayRecorded: false, quote: "", cumulativePage: 201, streak: 9, xp: 510 },
        { name: "owl_n",          nest: "🏰", avatar: "🦉", todayRecorded: true,  quote: "인간의 자유란 무엇인가 생각해보게 된다", cumulativePage: 280, streak: 88, xp: 620 },
        { name: "activist_raccoon", nest: "🪹", avatar: "🦝", todayRecorded: true, quote: "독재체제에 대한 경고", cumulativePage: 215, streak: 10, xp: 280 },
        { name: "deer_s",         nest: "🪵", avatar: "🦌", todayRecorded: false, quote: "", cumulativePage: 78, streak: 0, xp: 140 },
        { name: "fox_c",          nest: "🏠", avatar: "🦊", todayRecorded: true,  quote: "이야기 속 세계가 너무 압박감 있어", cumulativePage: 190, streak: 9, xp: 420 },
      ],
    },
    {
      id: "town_003",
      bookId: "b008",
      name: "데미안으로 알아가기",
      memberCount: 5,
      currentPart: 1,
      totalParts: 8,
      dday: -10,
      isOpen: false,
      leader: "@fox_c",
      milestones: [
        { part: 1, dueDate: "5/15", completed: true },
        { part: 2, dueDate: "5/22", completed: true },
        { part: 3, dueDate: "5/29", completed: false },
        { part: 4, dueDate: "6/5", completed: false },
        { part: 5, dueDate: "6/12", completed: false },
        { part: 6, dueDate: "6/19", completed: false },
        { part: 7, dueDate: "6/26", completed: false },
        { part: 8, dueDate: "7/3", completed: false },
      ],
      members: [
        { name: "fox_c",          nest: "🏠", avatar: "🦊", todayRecorded: true,  quote: "진정한 자아를 찾는 여정이 시작된다", cumulativePage: 88, streak: 9, xp: 510 },
        { name: "jerome",         nest: "🏠", avatar: "🐦", todayRecorded: true,  quote: "두 세계의 경계를 느낀다", cumulativePage: 102, streak: 12, xp: 340 },
        { name: "activist_raccoon", nest: "🪹", avatar: "🦝", todayRecorded: true, quote: "새는 알에서 나오려고 투쟁한다", cumulativePage: 120, streak: 15, xp: 380 },
        { name: "quiet_rabbit",   nest: "🏡", avatar: "🐰", todayRecorded: false, quote: "", cumulativePage: 72, streak: 21, xp: 740 },
        { name: "owl_n",          nest: "🏰", avatar: "🦉", todayRecorded: true,  quote: "흥미롭고 깊이 있는 소설이다", cumulativePage: 95, streak: 88, xp: 620 },
      ],
    },
  ],
};

/* ── 완독 기록 (책장) ─────────────────────────── */
const INITIAL_BOOKSHELF = {
  "b008": { rating: 5, comment: "나의 성장을 보는 듯한 경험. 삶의 의미를 생각하게 해준 책.", completedDate: "2026-05-20" },
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
  const sky=`<circle cx="110" cy="36" r="55" fill="url(#g_sun)"/>`;
  const ground=`<ellipse cx="${G.cx}" cy="${G.cy+G.ry+18}" rx="${G.rx*1.1}" ry="7" fill="rgba(30,15,5,.32)"/>`;
  const bowlOutline=twigs>=8?`<ellipse cx="${G.cx}" cy="${G.cy+2}" rx="${G.rx+2}" ry="${G.ry+3}" fill="none" stroke="#3A2410" stroke-width="2.5" opacity="0.18"/>`:'';
  const cavity=twigs>=25?`<ellipse cx="${G.cx}" cy="${G.cy+2}" rx="${G.irx}" ry="${G.iry}" fill="url(#g_inner)"/>`:'';
  const rim=twigs>=30?`<ellipse cx="${G.cx}" cy="${G.cy}" rx="${G.rx}" ry="${G.ry}" fill="none" stroke="#2A1810" stroke-width="0.5" opacity="0.20"/>`:'';
  const holdingTwig=lvNow===2,winking=lvNow===5,cheekHi=lvNow>=3;
  const sparrowBody=`<g class="sparrow-body"><ellipse cx="110" cy="128" rx="24" ry="16" fill="#F3CD9E" stroke="#C49460" stroke-width="1.2"/><ellipse cx="110" cy="133" rx="15" ry="10" fill="#FBE7C8"/><ellipse cx="90" cy="128" rx="6.5" ry="9.5" fill="#A07043" transform="rotate(-14 90 128)"/><ellipse cx="130" cy="128" rx="6.5" ry="9.5" fill="#A07043" transform="rotate(14 130 128)"/></g>`;
  const leftEye=winking?`<path d="M 99 102 Q 103 100 105 102" stroke="#2A2D33" stroke-width="1.8" fill="none" stroke-linecap="round"/>`:`<circle cx="102" cy="101" r="2.6" fill="#2A2D33"/><circle cx="103" cy="100" r="0.9" fill="#FFF"/>`;
  const rightEye=`<circle cx="118" cy="101" r="2.6" fill="#2A2D33"/><circle cx="119" cy="100" r="0.9" fill="#FFF"/>`;
  const beak=`<polygon points="105,108 115,108 110,114" fill="#F4B400" stroke="#C8901C" stroke-width="0.6"/>`+(holdingTwig?`<path d="M 115 110 Q 132 100 158 92" stroke="#6B4423" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="138" cy="100" rx="4.2" ry="2.1" fill="#5FAB5C" transform="rotate(-22 138 100)"/><ellipse cx="150" cy="93" rx="4.5" ry="2.3" fill="#3E7C3B" transform="rotate(-30 150 93)"/><ellipse cx="160" cy="89" rx="3.5" ry="1.8" fill="#5FAB5C" transform="rotate(-18 160 89)"/>`:'');
  const sparrowHead=`<g class="sparrow-head"><circle cx="110" cy="100" r="22" fill="#F3CD9E" stroke="#C49460" stroke-width="1.2"/><path d="M 88 95 Q 88 78 110 76 Q 132 78 132 95 Q 110 88 88 95 Z" fill="#7A4F2C" stroke="#5A3A1F" stroke-width="0.9"/><path d="M 103 76 L 100 67 L 106 75 Z" fill="#5A3A1F"/><path d="M 110 76 L 108 64 L 112 64 L 113 76 Z" fill="#5A3A1F"/><path d="M 117 76 L 120 67 L 114 75 Z" fill="#5A3A1F"/>${leftEye}${rightEye}${beak}<ellipse cx="93" cy="108" rx="4.2" ry="3.2" fill="#FFA8B8" opacity="${cheekHi?'0.88':'0.7'}"/><ellipse cx="127" cy="108" rx="4.2" ry="3.2" fill="#FFA8B8" opacity="${cheekHi?'0.88':'0.7'}"/></g>`;
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
  let dec=lvNow>=4?(leafAccents+headW+leafyRoof+chimney+sparkles):(leafAccents+headW+sparkles+motionMarks);
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

// 인라인 12권의 fb/toc 오버라이드 맵
const _SEED_META = Object.fromEntries(RG_BOOKS.map(b => [b.id, { fb: b.fb, toc: b.toc }]));

let _booksCache = null;

async function loadBooks() {
  if (_booksCache) return _booksCache;
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
    // BOOK_BY_ID 갱신 (TSV 로드 후 전체 목록 참조 가능)
    _booksCache.forEach(b => { window.BOOK_BY_ID[b.id] = b; });
    return _booksCache;
  } catch (e) {
    console.warn('[ReadingGo] books.tsv 로드 실패, 인라인 12권 사용:', e.message);
    _booksCache = RG_BOOKS;
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

window.RG_BOOKS=RG_BOOKS; window.BOOK_BY_ID=BOOK_BY_ID; window.getBook=getBook;
window.INITIAL_PROGRESS=INITIAL_PROGRESS;
window.NEST_STAGES=NEST_STAGES; window.getNestStage=getNestStage;
window.NEST_STAGE_TRANSITIONS=NEST_STAGE_TRANSITIONS; window.getEvolutionCopy=getEvolutionCopy;
window.NPC_QUOTES=NPC_QUOTES; window.INITIAL_STATE=INITIAL_STATE;
window.INITIAL_BOOKSHELF=INITIAL_BOOKSHELF; window.WISHLIST=WISHLIST;
window.ALL_BOOKS=ALL_BOOKS;
window.NEST_TWIGS=NEST_TWIGS; window.NEST_GEO=NEST_GEO;
window.twigsForProgress=twigsForProgress; window.nestInfo=nestInfo; window.drawNest=drawNest;
window.loadBooks=loadBooks; window.fuzzySearch=fuzzySearch;
