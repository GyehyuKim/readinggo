import React, { useState, useCallback } from "react";

/* ------------------------------------------------------------------ *
 *  문장의 결 — Reading Reflection Companion (prototype v2)
 *  내가 캡쳐한 문장 → 맥락 + 회고 질문(렌즈 전환) → 내 생각 → 시간차 되감기
 * ------------------------------------------------------------------ */

const P = {
  paper: "#f3ede1", paperDeep: "#ece3d2", ink: "#2b2620", inkSoft: "#5c5347",
  accent: "#a8503c", accentSoft: "#c97a5f", sage: "#6f7a5a", line: "#d8cdb8",
  recall: "#3f5567", recallBg: "#e7e9e4",
};
const FONT = "'Gowun Batang', 'Noto Serif KR', serif";

const SAMPLE = {
  title: "사물들", author: "조르주 페렉",
  highlights: [
    { page: "p.27", type: "책 속 문장", content: "무한한 욕망만이 그들을 압도했다." },
    { page: "p.40", type: "책 속 문장", content: "그리고 벼룩시장을 발견한 것은 일생일대의 사건이었다." },
    { page: "p.42", type: "책 속 문장", content: "위태하거나 모호하지 않은 것이 없었다. 바로 이것이 그들의 삶, 암울함 이상으로 알 수 없는 불안의 근원이었다. 무엇인가가 입을 무한히 크게 벌리고 있는 것 같았다." },
    { page: "p.53", type: "책 속 문장", content: "이들이 갖는 수치심과 오만함은 같은 성격이어서 같은 환멸 같은 분노를 내포하고 있었다." },
    { page: "p.61", type: "책 속 문장", content: "무엇보다 영화가 있었다. 분명히 영화는 그들의 감수성이 온전히 받아들일 수 있는 유일한 영역이었다." },
    { page: "p.64", type: "책 속 문장", content: "그들은 나왔다. 슬펐다. 상상하던 영화가 아니었다. 그들이 만들고 싶어 하던 그 영화, 아니 더 은밀히 그렇게 살아보고 싶어 하던 그 영화가 아니었다." },
    { page: "p.71", type: "책 속 문장", content: "그들은 바보였다. 아 얼마나 수없이 되뇌었던가. 자신들이 바보 같다고, 틀렸다고, 악착같이 달려들고 기어오르는 다른 사람들보다 정신을 덜 차렸다고 말이다." },
    { page: "p.100", type: "책 속 문장", content: "그러던 어느 날 전혀 예상치 못하게 천둥처럼 갑자기 어마어마한 돈이 굴러 들어오는 것이다. 마침내 그들의 희곡이 채택되고 그들의 천재성이 인정받게 되는 것이다." },
    { page: "p.115", type: "책 속 문장", content: "그들은 행복을 상상할 수 있다고 믿었다. 하지만 그들은 홀로 꼼짝없이 쓸쓸하게 나왔다." },
    { page: "p.150", type: "책 속 문장", content: "그들은 몽유병자나 다름없었다. 자신들이 원하는 것이 무엇인지 더 이상 알지 못했다. 그들은 모든 것을 상실했다." },
  ],
};

const LENSES = [
  { key: "감정", desc: "이 문장이 건드린 독자의 감정이나 떠오른 구체적 순간을 향한 질문" },
  { key: "연결", desc: "이 문장을 독자의 다른 독서·경험·요즘 고민과 잇게 하는 질문" },
  { key: "반론", desc: "이 문장/작가의 태도에 독자가 동의하는지 따져 묻는 질문" },
  { key: "투사", desc: "문장 속 인물이나 상황에 독자 자신을 대입하게 하는 질문" },
];

function parseExport(text) {
  const lines = text.split(/\r?\n/);
  let title = "", author = "";
  const highlights = []; let cur = null;
  const flush = () => { if (cur && cur.content) highlights.push(cur); cur = null; };
  for (const raw of lines) {
    const line = raw.trim();
    const tM = line.match(/^-\s*책\s*제목\s*:\s*(.+)$/);
    const aM = line.match(/^-\s*저자\s*:\s*(.+)$/);
    if (tM) title = tM[1].trim();
    if (aM) author = aM[1].trim();
    if (/^-\s*날짜\s*:/.test(line)) { flush(); cur = { page: "", type: "", content: "" }; continue; }
    if (!cur) continue;
    const p = line.match(/^-\s*페이지\s*:\s*(.+)$/);
    const ty = line.match(/^-\s*노트\s*타입\s*:\s*(.+)$/);
    const c = line.match(/^-\s*내용\s*:\s*(.+)$/);
    if (p) cur.page = p[1].trim();
    else if (ty) cur.type = ty[1].trim();
    else if (c) cur.content = c[1].trim();
  }
  flush();
  return { title, author, highlights };
}

async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000, system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text)
    .join("\n").replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
const ctx = (book, h) => `책: 『${book.title}』 — ${book.author}\n페이지: ${h.page}\n캡쳐한 문장: "${h.content}"`;

const genInitial = (book, h) => callClaude(
  "너는 한국어 독서 동반자야. 사용자가 직접 캡쳐한 문장 하나가 주어진다. 두 가지를 만들어라. " +
  "(1) insight: 그 문장·장면·작가·시대 배경에 관한 흥미로운 맥락이나 fun fact 1~2문장. " +
  "확실하지 않은 구체적 사실(연도·수상·인용)은 절대 지어내지 말고, 불확실하면 문장의 문체·이미지·정서에서 끌어낸 통찰로 대체. " +
  "(2) question: 독자가 '왜 하필 이 문장에 멈췄을까'를 곱씹게 하는, 그 문장에 구체적으로 닿은 따뜻한 회고 질문 1개. " +
  "JSON만 출력: {\"insight\":\"...\",\"question\":\"...\"}  마크다운·백틱 금지.",
  ctx(book, h)
);

const genLens = (book, h, lens) => callClaude(
  `너는 한국어 독서 동반자야. 캡쳐한 문장에 대해 '${lens.key}' 결의 회고 질문 하나만 새로 만들어라. ` +
  `방향: ${lens.desc}. 그 문장에 구체적으로 닿게, 따뜻하고 구체적으로. ` +
  "JSON만 출력: {\"question\":\"...\"}  마크다운·백틱 금지.",
  ctx(book, h)
);

const genResurface = (book, h, pastAnswer) => callClaude(
  "너는 한국어 독서 동반자야. 독자가 예전에 이 문장에 남긴 답이 함께 주어진다. " +
  "시간이 흘러 같은 문장을 다시 만난 독자에게, 예전의 답과 지금을 잇는 회고 질문 하나를 만들어라. " +
  "예전 답을 짧게 가볍게 인용하며 '그때와 지금'의 변화를 따뜻하게 물어라. 판단하지 말 것. " +
  "JSON만 출력: {\"question\":\"...\"}  마크다운·백틱 금지.",
  `${ctx(book, h)}\n예전에 남긴 답: "${pastAnswer}"`
);

const hasStore = typeof window !== "undefined" && window.storage;
async function save(key, value) { if (hasStore) { try { await window.storage.set(key, JSON.stringify(value)); } catch (e) {} } }

export default function ReadingCompanion() {
  const [book, setBook] = useState({ title: SAMPLE.title, author: SAMPLE.author });
  const mk = (h, i) => ({
    id: i, ...h, loading: false, error: "", insight: "", question: "", lens: "기본",
    regenLoading: false, open: false, answer: "",
    resurfaced: "", resurfaceLoading: false, resurfaceAnswer: "", showRecall: false,
  });
  const [items, setItems] = useState(SAMPLE.highlights.map(mk));
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const upd = useCallback((id, patch) => setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it))), []);

  const open = useCallback(async (id) => {
    const it = items.find((x) => x.id === id); if (!it) return;
    upd(id, { open: true }); if (it.question) return;
    upd(id, { loading: true, error: "" });
    try { const r = await genInitial(book, it); upd(id, { insight: r.insight, question: r.question, loading: false }); }
    catch (e) { upd(id, { loading: false, error: "생성에 실패했어요. 다시 시도해 주세요." }); }
  }, [items, book, upd]);

  const lens = useCallback(async (id, L) => {
    const it = items.find((x) => x.id === id); if (!it) return;
    upd(id, { regenLoading: true, lens: L.key });
    try { const r = await genLens(book, it, L); upd(id, { question: r.question, regenLoading: false }); }
    catch (e) { upd(id, { regenLoading: false }); }
  }, [items, book, upd]);

  const recall = useCallback(async (id) => {
    const it = items.find((x) => x.id === id); if (!it || !it.answer.trim()) return;
    upd(id, { resurfaceLoading: true, showRecall: true });
    try { const r = await genResurface(book, it, it.answer); upd(id, { resurfaced: r.question, resurfaceLoading: false }); }
    catch (e) { upd(id, { resurfaceLoading: false }); }
  }, [items, book, upd]);

  const doImport = () => {
    const parsed = parseExport(importText); if (!parsed.highlights.length) return;
    setBook({ title: parsed.title || "제목 미상", author: parsed.author || "" });
    setItems(parsed.highlights.map(mk)); setShowImport(false); setImportText("");
  };

  const pill = (active) => ({
    border: `1px solid ${active ? PALETTEacc() : P.line}`, background: active ? P.accent : "transparent",
    color: active ? P.paper : P.inkSoft, padding: "4px 12px", borderRadius: 999, fontSize: 12.5,
    cursor: "pointer", fontFamily: FONT,
  });
  function PALETTEacc() { return P.accent; }

  return (
    <div style={{ background: P.paper, minHeight: "100vh", color: P.ink, fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Serif+KR:wght@300;400;600&display=swap');
        *{box-sizing:border-box}
        .fade{animation:f .55s ease both}@keyframes f{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .btn{transition:all .18s ease}.btn:hover{transform:translateY(-1px)}
        textarea{font-family:${FONT}}
        .dot{width:6px;height:6px;border-radius:50%;background:${P.accent};display:inline-block;animation:pl 1s infinite ease-in-out}
        .dot:nth-child(2){animation-delay:.15s}.dot:nth-child(3){animation-delay:.3s}
        @keyframes pl{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 22px 96px" }}>
        <header style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: P.accent, textTransform: "uppercase", marginBottom: 14 }}>
            문장의 결 · 암기가 아니라 회고
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>『{book.title}』</h1>
          <p style={{ color: P.inkSoft, fontSize: 17, margin: "10px 0 0" }}>{book.author}</p>
          <div style={{ marginTop: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: P.inkSoft }}>내가 남긴 문장 {items.length}개</span>
            <button className="btn" onClick={() => setShowImport((s) => !s)}
              style={{ border: `1px solid ${P.line}`, background: "transparent", color: P.inkSoft, padding: "6px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
              {showImport ? "닫기" : "내 기록 불러오기"}
            </button>
          </div>
          {showImport && (
            <div className="fade" style={{ marginTop: 18 }}>
              <p style={{ fontSize: 13, color: P.inkSoft, margin: "0 0 8px" }}>북모리 등에서 내보낸 텍스트를 그대로 붙여넣으면 문장을 자동으로 읽어옵니다.</p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder="### 책 정보&#10;- 책 제목: ...&#10;### 노트 목록&#10;- 날짜: ...&#10;- 페이지: p.27&#10;- 내용: ..."
                style={{ width: "100%", minHeight: 120, padding: 14, borderRadius: 10, resize: "vertical", border: `1px solid ${P.line}`, background: P.paperDeep, color: P.ink, fontSize: 13, lineHeight: 1.6, outline: "none" }} />
              <button className="btn" onClick={doImport}
                style={{ marginTop: 10, border: "none", background: P.ink, color: P.paper, padding: "9px 20px", borderRadius: 999, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>불러오기</button>
            </div>
          )}
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {items.map((it) => (
            <article key={it.id} style={{ background: P.paperDeep, border: `1px solid ${P.line}`, borderRadius: 14, padding: "26px 26px 22px" }}>
              <div style={{ fontSize: 12, letterSpacing: 1, color: P.accent, marginBottom: 12 }}>{it.page} · {it.type}</div>
              <blockquote style={{ margin: 0, fontSize: 19, lineHeight: 1.75, position: "relative", paddingLeft: 18 }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: P.accentSoft, borderRadius: 2 }} />
                {it.content}
              </blockquote>

              {!it.open && (
                <button className="btn" onClick={() => open(it.id)}
                  style={{ marginTop: 18, border: `1px solid ${P.accent}`, background: "transparent", color: P.accent, padding: "8px 18px", borderRadius: 999, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
                  ✦ 이 문장 깊이 보기
                </button>
              )}

              {it.open && (
                <div className="fade" style={{ marginTop: 20 }}>
                  {it.loading && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", color: P.inkSoft, fontSize: 14 }}>
                      <span className="dot" /><span className="dot" /><span className="dot" /><span style={{ marginLeft: 6 }}>문장을 들여다보는 중…</span>
                    </div>
                  )}
                  {it.error && <div style={{ color: P.accent, fontSize: 14 }}>{it.error}</div>}

                  {it.question && (
                    <>
                      {it.insight && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 12, letterSpacing: 2, color: P.sage, textTransform: "uppercase", marginBottom: 6 }}>✦ 맥락 한 조각</div>
                          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75 }}>{it.insight}</p>
                        </div>
                      )}

                      <div style={{ background: P.paper, border: `1px dashed ${P.line}`, borderRadius: 10, padding: "16px 18px" }}>
                        <div style={{ fontSize: 12, letterSpacing: 2, color: P.accent, textTransform: "uppercase", marginBottom: 8 }}>
                          ❛ 너에게 묻는다 {it.lens !== "기본" && <span style={{ color: P.inkSoft }}>· {it.lens}의 결</span>}
                        </div>
                        <p style={{ margin: "0 0 12px", fontSize: 16, lineHeight: 1.7, fontWeight: 700, opacity: it.regenLoading ? 0.4 : 1 }}>{it.question}</p>
                        <textarea value={it.answer} onChange={(e) => upd(it.id, { answer: e.target.value })}
                          onBlur={() => save(`answer:${book.title}:${it.page}`, { q: it.question, a: it.answer })}
                          placeholder="떠오르는 대로 적어보세요…"
                          style={{ width: "100%", minHeight: 70, padding: 12, borderRadius: 8, resize: "vertical", border: `1px solid ${P.line}`, background: P.paperDeep, color: P.ink, fontSize: 15, lineHeight: 1.7, outline: "none" }} />

                        <div style={{ marginTop: 12, display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: P.inkSoft }}>다른 결로 묻기 →</span>
                          {LENSES.map((L) => (
                            <button key={L.key} className="btn" disabled={it.regenLoading} onClick={() => lens(it.id, L)} style={pill(it.lens === L.key)}>{L.key}</button>
                          ))}
                        </div>
                      </div>

                      {/* 시간차 되감기 */}
                      {it.answer.trim() && !it.showRecall && (
                        <button className="btn" onClick={() => recall(it.id)}
                          style={{ marginTop: 14, border: `1px solid ${P.recall}`, background: "transparent", color: P.recall, padding: "8px 16px", borderRadius: 999, fontSize: 13.5, cursor: "pointer", fontFamily: FONT }}>
                          🕰 한 달 뒤처럼 되감기
                        </button>
                      )}
                      {it.showRecall && (
                        <div className="fade" style={{ marginTop: 16, background: P.recallBg, border: `1px solid ${P.line}`, borderRadius: 10, padding: "16px 18px" }}>
                          <div style={{ fontSize: 12, letterSpacing: 2, color: P.recall, textTransform: "uppercase", marginBottom: 8 }}>🕰 다시 만난 문장</div>
                          {it.resurfaceLoading ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", color: P.inkSoft, fontSize: 14 }}>
                              <span className="dot" /><span className="dot" /><span className="dot" /><span style={{ marginLeft: 6 }}>그때의 너를 불러오는 중…</span>
                            </div>
                          ) : (
                            <>
                              <p style={{ margin: "0 0 12px", fontSize: 16, lineHeight: 1.7, fontWeight: 700, color: P.recall }}>{it.resurfaced}</p>
                              <textarea value={it.resurfaceAnswer} onChange={(e) => upd(it.id, { resurfaceAnswer: e.target.value })}
                                placeholder="지금의 나로서 다시…"
                                style={{ width: "100%", minHeight: 60, padding: 12, borderRadius: 8, resize: "vertical", border: `1px solid ${P.line}`, background: P.paper, color: P.ink, fontSize: 15, lineHeight: 1.7, outline: "none" }} />
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        <footer style={{ marginTop: 48, textAlign: "center", fontSize: 12, color: P.inkSoft }}>
          {hasStore ? "기록은 이 기기에 저장됩니다." : "프로토타입 — 기록은 세션 동안만 유지됩니다."}
        </footer>
      </div>
    </div>
  );
}
