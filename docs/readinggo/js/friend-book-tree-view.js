/* friend-book-tree-view.js — #1454 상호 친구의 필드 제한 책나무 projection UI.
   base table은 읽지 않으며 요약 RPC와 선택 가지의 페이지 RPC만 사용한다. */
(function () {
  'use strict';
  var R = window.React || React;
  var h = R.createElement;
  var LEAF_PAGE_SIZE = 20;

  function bucketFriendTreeCount(value) {
    var n = Math.max(0, Number(value) || 0);
    if (n === 0) return '0';
    if (n <= 5) return '1-5';
    if (n <= 20) return '6-20';
    if (n <= 100) return '21-100';
    return '101+';
  }

  function friendTreeSentenceItem(leaf, book, owner) {
    var when = leaf && leaf.created_at ? new Date(leaf.created_at).toLocaleDateString('ko-KR') : '';
    return {
      id: leaf.id,
      q: leaf.text,
      text: leaf.text,
      page: leaf.page,
      time: when,
      visibility: leaf.visibility,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author || '',
      userId: owner.id,
      nick: '@' + owner.handle,
      avatar: owner.avatar_url
        ? h('img', { src: owner.avatar_url, alt: '', loading: 'lazy', style: { width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' } })
        : ((owner.display_name || owner.handle || '').slice(0, 1)),
      isMine: false,
      claps: 0,
    };
  }

  function FriendBookTreeView(props) {
    var ownerId = props.ownerId;
    var entryPoint = props.entryPoint || 'profile';
    var selectedId = props.selectedId || null;
    var setSelectedId = props.onSelectedIdChange || function () {};
    var statePair = R.useState(undefined);
    var data = statePair[0], setData = statePair[1];
    var errorPair = R.useState(false);
    var denied = errorPair[0], setDenied = errorPair[1];
    var leavesPair = R.useState(undefined);
    var leaves = leavesPair[0], setLeaves = leavesPair[1];
    var leavesErrorPair = R.useState(false);
    var leavesError = leavesErrorPair[0], setLeavesError = leavesErrorPair[1];
    var loadingMorePair = R.useState(false);
    var loadingMore = loadingMorePair[0], setLoadingMore = loadingMorePair[1];
    var tracked = R.useRef(false);

    R.useEffect(function () {
      var alive = true;
      setData(undefined); setDenied(false); setSelectedId(null);
      var ds = window.DataStore;
      if (!ds || !ds.friendBookTree || !ds.friendBookTree.get) { setDenied(true); return undefined; }
      Promise.resolve(ds.friendBookTree.get(ownerId)).then(function (value) {
        if (!alive) return;
        setData(value);
        if (!tracked.current && window.rgTrack) {
          tracked.current = true;
          window.rgTrack('friend_book_tree_viewed', {
            branch_count_bucket: bucketFriendTreeCount(value && value.branch_count),
            visible_leaf_count_bucket: bucketFriendTreeCount(value && value.visible_leaf_count),
            entry_point: entryPoint === 'feed' ? 'feed' : 'profile',
          });
        }
      }).catch(function () { if (alive) setDenied(true); });
      return function () { alive = false; };
    }, [ownerId]);

    var branches = data && Array.isArray(data.branches) ? data.branches : [];
    var selected = branches.find(function (branch) { return branch.book_id === selectedId; }) || null;
    var selectedBookId = selected ? selected.book_id : null;

    R.useEffect(function () {
      var alive = true;
      setLeavesError(false);
      if (!selectedBookId) { setLeaves(undefined); return undefined; }
      if (!selected || selected.status === 'wish' || Number(selected.visible_leaf_count) === 0) {
        setLeaves([]); return undefined;
      }
      var ds = window.DataStore;
      if (!ds || !ds.friendBookTree || !ds.friendBookTree.leaves) { setLeavesError(true); setLeaves([]); return undefined; }
      setLeaves(undefined);
      Promise.resolve(ds.friendBookTree.leaves(ownerId, selectedBookId, 0, LEAF_PAGE_SIZE))
        .then(function (rows) { if (alive) setLeaves(Array.isArray(rows) ? rows : []); })
        .catch(function () { if (alive) { setLeavesError(true); setLeaves([]); } });
      return function () { alive = false; };
    }, [ownerId, selectedBookId]);

    function loadMoreLeaves() {
      if (!selected || loadingMore || !Array.isArray(leaves)) return;
      var ds = window.DataStore;
      if (!ds || !ds.friendBookTree || !ds.friendBookTree.leaves) return;
      setLoadingMore(true); setLeavesError(false);
      Promise.resolve(ds.friendBookTree.leaves(ownerId, selected.book_id, leaves.length, LEAF_PAGE_SIZE))
        .then(function (rows) {
          var incoming = Array.isArray(rows) ? rows : [];
          setLeaves(function (current) {
            var next = Array.isArray(current) ? current.slice() : [];
            var seen = new Set(next.map(function (leaf) { return leaf.id; }));
            incoming.forEach(function (leaf) { if (!seen.has(leaf.id)) { seen.add(leaf.id); next.push(leaf); } });
            return next;
          });
        })
        .catch(function () { setLeavesError(true); })
        .finally(function () { setLoadingMore(false); });
    }

    var back = h('button', {
      type: 'button', onClick: selected ? function () { setSelectedId(null); } : props.onBack,
      'aria-label': selected ? '가지 목록으로' : '프로필로',
      style: { border: 0, background: 'transparent', color: 'var(--ink)', fontSize: 22, padding: 10, cursor: 'pointer' },
    }, '←');
    var header = h('header', { style: { position: 'sticky', top: 0, zIndex: 3, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg, #fff)', borderBottom: '1px solid var(--line)' } },
      back,
      h('h1', { style: { margin: 0, fontSize: 16, fontWeight: 900 } }, selected ? (selected.book.title || '책') : ((data && data.owner ? '@' + data.owner.handle : '친구') + '님의 책나무'))
    );

    if (data === undefined && !denied) return h('section', { role: 'dialog', 'aria-label': '친구 책나무', style: props.style }, header, h('div', { role: 'status', style: { padding: 40, textAlign: 'center', color: 'var(--ink-3)' } }, '책나무를 불러오는 중…'));
    if (denied || !data) return h('section', { role: 'dialog', 'aria-label': '친구 책나무', style: props.style }, header,
      h('div', { role: 'status', style: { padding: 40, textAlign: 'center', color: 'var(--ink-3)', lineHeight: 1.6, whiteSpace: 'pre-line' } }, '지금은 이 책나무를 볼 수 없어요.\n서로 팔로우한 친구만 볼 수 있고, 친구가 공개를 끄면 바로 닫혀요.'));

    if (selected) {
      var loadedLeaves = Array.isArray(leaves) ? leaves : [];
      var hasMore = loadedLeaves.length < Number(selected.visible_leaf_count || 0);
      return h('section', { role: 'dialog', 'aria-label': selected.book.title + ' 가지', style: props.style }, header,
        h('div', { style: { padding: '14px 16px 40px' } },
          h('button', { type: 'button', onClick: function () { if (window.RG_openBook) window.RG_openBook(selected.book_id); },
            style: { width: '100%', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--card)', padding: 14, marginBottom: 14, cursor: 'pointer' },
            'aria-label': selected.book.title + ' 책 상세 보기' },
            h('strong', null, selected.book.title), h('div', { style: { fontSize: 12, color: 'var(--ink-3)', marginTop: 4 } }, (selected.book.author || '') + ' · 책 상세 보기')),
          leaves === undefined
            ? h('div', { role: 'status', style: { padding: '24px 0', color: 'var(--ink-3)', textAlign: 'center' } }, '공개한 문장을 불러오는 중…')
            : loadedLeaves.length === 0
              ? h('div', { role: 'status', style: { padding: '24px 0', color: 'var(--ink-3)', textAlign: 'center' } }, leavesError ? '문장을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' : '공개한 한 문장은 아직 없어요')
              : h(R.Fragment, null,
                  loadedLeaves.map(function (leaf) { return h(window.SentenceCard, { key: leaf.id, item: friendTreeSentenceItem(leaf, selected.book, data.owner), bookId: selected.book_id }); }),
                  hasMore && h('button', { type: 'button', disabled: loadingMore, onClick: loadMoreLeaves,
                    style: { width: '100%', border: 0, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--ink)', padding: 12, marginTop: 10, fontWeight: 800, cursor: loadingMore ? 'default' : 'pointer' } }, loadingMore ? '불러오는 중…' : '공개 문장 더 보기'),
                  leavesError && h('div', { role: 'status', style: { padding: 10, color: 'var(--danger)', textAlign: 'center' } }, '더 불러오지 못했어요. 다시 시도해 주세요.')
                )
        ));
    }

    var statusLabel = { reading: '읽는 중', completed: '완독', aborted: '중단', wish: '읽고 싶어요' };
    return h('section', { role: 'dialog', 'aria-label': '친구 책나무', style: props.style }, header,
      h('div', { style: { padding: '14px 16px 40px' } },
        branches.length === 0
          ? h('div', { role: 'status', style: { padding: 40, textAlign: 'center', color: 'var(--ink-3)' } }, '아직 자란 가지가 없어요')
          : h('ul', { 'aria-label': '책나무 가지', style: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 } }, branches.map(function (branch) {
              return h('li', { key: branch.book_id }, h('button', {
                type: 'button', onClick: function () {
                  setSelectedId(branch.book_id);
                  if (window.rgTrack) window.rgTrack('friend_book_tree_branch_opened', {
                    book_status: branch.status,
                    leaf_count_bucket: bucketFriendTreeCount(branch.visible_leaf_count),
                    entry_point: entryPoint === 'feed' ? 'feed' : 'profile',
                  });
                },
                'aria-label': (branch.book.title || '책') + ', ' + (statusLabel[branch.status] || branch.status) + ', 공개 문장 ' + branch.visible_leaf_count + '개',
                style: { width: '100%', display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: selectedId === branch.book_id ? 'var(--brand-tint)' : 'var(--card)', padding: 12, cursor: 'pointer' },
              },
                branch.book.cover_url ? h('img', { src: branch.book.cover_url, alt: '', loading: 'lazy', style: { width: 46, height: 64, objectFit: 'cover', borderRadius: 'var(--r-sm)' } }) : h('span', { 'aria-hidden': 'true', style: { width: 46, display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' } }, window.rgIcon ? window.rgIcon('book', 24) : null),
                h('span', { style: { minWidth: 0, flex: 1 } }, h('strong', { style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, branch.book.title),
                  h('span', { style: { display: 'block', fontSize: 12, color: 'var(--ink-3)', marginTop: 4 } }, (statusLabel[branch.status] || branch.status) + ' · 공개 문장 ' + branch.visible_leaf_count + '개'))
              ));
            }))
      ));
  }

  window.bucketFriendTreeCount = bucketFriendTreeCount;
  window.friendTreeSentenceItem = friendTreeSentenceItem;
  window.FriendBookTreeView = FriendBookTreeView;
})();
