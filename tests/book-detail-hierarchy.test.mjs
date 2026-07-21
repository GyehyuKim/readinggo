import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../docs/readinggo/js/book-detail-modal.js', import.meta.url), 'utf8');

const includes = (text, message) => assert.ok(source.includes(text), message);

includes('data-section="primary-reading-actions"', '읽는 중 핵심 액션 구역이 있어야 한다');
includes("gridTemplateColumns:'repeat(2, minmax(0, 1fr))'", '완독/중단 CTA는 2열이어야 한다');
includes('data-section="primary-resume"', '중단 책 다시 읽기는 Primary여야 한다');
includes('data-section="primary-completed"', '완독 별점/소감 진입은 Primary여야 한다');
includes("{book.status === 'aborted' ? `중단 · ${prog.cur}쪽에서 멈춤` : '읽는 중'}", '상태 요약을 텍스트로 제공해야 한다');
includes("{book.status === 'aborted' && <div", '중단 상태는 진도 보존 안내를 제공해야 한다');

for (const marker of ['secondary-add-quote', 'secondary-quotes']) {
  includes(`data-section="${marker}"`, `${marker} 구역이 있어야 한다`);
}
for (const marker of ['tertiary-description', 'tertiary-related', 'tertiary-recap', 'tertiary-ai-recommendations']) {
  includes(`data-section="${marker}"`, `${marker} 구역이 있어야 한다`);
}
includes('data-section="utility-row"', '외부 링크와 Markdown은 compact utility row여야 한다');
includes("data-section=\"secondary-add-quote\" style={{order:2", '내 기록은 시각 순서 2단이어야 한다');
includes("data-section=\"tertiary-description\" style={{order:3", '책 소개는 내 기록 뒤 3단이어야 한다');

includes('data-testid="review-modal-backdrop"', '완독 소감은 별도 bottom modal이어야 한다');
includes('aria-modal="true"', '완독 소감 dialog는 modal 의미를 제공해야 한다');
includes('aria-labelledby="review-modal-title"', '완독 소감 dialog는 접근 가능한 이름을 가져야 한다');
includes("document.addEventListener('keydown', onKeyDown)", 'ESC와 Tab 포커스 트랩을 처리해야 한다');
includes("event.key === 'Escape'", 'ESC 닫기를 지원해야 한다');
includes("event.key !== 'Tab'", 'Tab 포커스 트랩을 지원해야 한다');
includes("window.confirm('작성 중인 소감을 버릴까요?')", '미저장 닫기는 폐기 확인을 거쳐야 한다');
includes('setSavedReview(next)', '저장 성공 시 상세 미리보기를 즉시 갱신해야 한다');
includes('입력한 내용은 그대로 두었어요', '저장 실패 시 입력 보존을 알려야 한다');
includes('role="status" aria-live="polite"', '저장 상태는 live region으로 알려야 한다');
includes('reviewTriggerRef.current.focus()', '닫은 뒤 진입 버튼으로 포커스를 복귀해야 한다');
includes("maxLength={1000}", '완독 소감은 1,000자로 제한해야 한다');

console.log('✓ book-detail hierarchy/review modal regression contract');
