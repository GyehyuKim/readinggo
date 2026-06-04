/* =========================================================
   ReadingGo — Netlify Function: 알라딘 OpenAPI 프록시
   TTBKey 를 서버(env)에서만 사용 + http→https 우회(mixed-content 방지).

   호출:
     /.netlify/functions/aladin?query=데미안        → 검색(ItemSearch)
     /.netlify/functions/aladin?isbn=9788937460449  → 상세(ItemLookUp, 페이지수 포함)
   env: ALADIN_TTB_KEY (Netlify 환경변수)
   ========================================================= */
const BASE = 'http://www.aladin.co.kr/ttb/api/';

exports.handler = async (event) => {
  const key = process.env.ALADIN_TTB_KEY;
  if (!key) return resp(500, { error: 'ALADIN_TTB_KEY 미설정 (Netlify env)' });

  const q = (event && event.queryStringParameters) || {};
  const isbn = (q.isbn || '').trim();
  const query = (q.query || q.q || '').trim().slice(0, 100);

  let url;
  if (isbn) {
    if (!/^\d{10,13}$/.test(isbn)) return resp(400, { error: 'isbn 형식 오류(숫자 10~13자리)' });
    url = `${BASE}ItemLookUp.aspx?ttbkey=${key}&itemIdType=ISBN13&ItemId=${encodeURIComponent(isbn)}`
        + `&output=js&Version=20131101&Cover=Big&OptResult=packing`;
  } else if (query) {
    const max = Math.min(parseInt(q.max, 10) || 10, 20);
    url = `${BASE}ItemSearch.aspx?ttbkey=${key}&Query=${encodeURIComponent(query)}`
        + `&QueryType=Keyword&SearchTarget=Book&MaxResults=${max}&start=1`
        + `&output=js&Version=20131101&Cover=Big&OptResult=packing`; // packing → subInfo.itemPage(쪽수) 포함
  } else {
    return resp(400, { error: 'query 또는 isbn 파라미터 필요' });
  }

  try {
    const r = await fetch(url);
    const text = await r.text();
    const data = parseAladin(text);
    const items = (data.item || []).map(normalize);
    return resp(200, { items });
  } catch (e) {
    return resp(502, { error: '알라딘 호출 실패', detail: String(e && e.message || e) });
  }
};

// output=js 는 JSON 이지만 가끔 앞에 콜백/BOM 이 붙음 → 첫 '{' 부터 파싱.
function parseAladin(text) {
  try { return JSON.parse(text); }
  catch (e) {
    const i = text.indexOf('{');
    const j = text.lastIndexOf('}');
    if (i >= 0 && j > i) return JSON.parse(text.slice(i, j + 1));
    throw e;
  }
}

// 알라딘 item → 우리 books 스키마 형태
function normalize(it) {
  const sub = it.subInfo || {};
  return {
    isbn13: it.isbn13 || it.isbn || '',
    title: cleanTitle(it.title || ''),
    author: it.author || '',
    publisher: it.publisher || '',
    total_pages: sub.itemPage ? Number(sub.itemPage) : null,
    cover_url: (it.cover || '').replace(/^http:/, 'https:'),  // 표지는 https 로
    pub_date: it.pubDate || '',
    description: it.description || '',
    aladin_link: it.link || '',
  };
}

// "제목 - 시리즈명" 같은 꼬리 정리(가벼운 정규화)
function cleanTitle(t) {
  return t.replace(/\s*\([^)]*\)\s*$/, '').trim() || t;
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
      'cache-control': 'public, max-age=86400',  // 책 메타는 하루 캐시
    },
    body: JSON.stringify(body),
  };
}
