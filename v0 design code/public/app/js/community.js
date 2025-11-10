// Version: LB-COMMUNITY-UI-20250218A
(function () {
  const API_ENDPOINT = '/.netlify/functions/community-posts';
  const statusEl = document.getElementById('community-status');
  const formEl = document.getElementById('community-post-form');
  const listEl = document.getElementById('community-post-list');
  if (!statusEl || !formEl || !listEl) {
    console.warn('[Community UI] Required DOM elements missing.');
    return;
  }

  function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.hidden = false;
    statusEl.classList.remove('status-banner--error');
    if (type === 'error') {
      statusEl.classList.add('status-banner--error');
    }
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusEl.classList.remove('status-banner--error');
  }

  function formatDate(value) {
    if (!value) return '剛剛';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '時間未知';
    try {
      return parsed.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour12: false,
      });
    } catch (error) {
      return parsed.toISOString().replace('T', ' ').slice(0, 19);
    }
  }

  function renderPosts(posts) {
    listEl.innerHTML = '';
    if (!Array.isArray(posts) || posts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'community-post';
      empty.textContent = '目前還沒有任何貼文，快來分享你的第一個策略吧！';
      listEl.appendChild(empty);
      return;
    }

    posts.forEach((post) => {
      const wrapper = document.createElement('article');
      wrapper.className = 'community-post';

      const meta = document.createElement('div');
      meta.className = 'community-meta';
      const author = document.createElement('span');
      author.textContent = post.author || '匿名使用者';
      const timestamp = document.createElement('span');
      timestamp.textContent = formatDate(post.createdAt);
      meta.append(author, timestamp);

      const content = document.createElement('div');
      content.className = 'community-content';
      content.textContent = post.content || '';

      wrapper.append(meta, content);
      listEl.appendChild(wrapper);
    });
  }

  async function fetchPosts() {
    showStatus('載入留言中…');
    try {
      const response = await fetch(API_ENDPOINT, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      renderPosts(payload.posts || []);
      hideStatus();
    } catch (error) {
      console.error('[Community UI] 無法載入貼文', error);
      showStatus('載入留言失敗，請稍後再試。', 'error');
    }
  }

  async function submitPost(event) {
    event.preventDefault();
    const submitBtn = formEl.querySelector('button[type="submit"]');
    const formData = new FormData(formEl);
    const author = (formData.get('author') || '').toString().trim();
    const content = (formData.get('content') || '').toString().trim();

    if (!author || !content) {
      showStatus('請填寫暱稱與內容後再送出。', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '送出中…';
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ author, content }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.error || `送出失敗 (HTTP ${response.status})`;
        throw new Error(message);
      }

      formEl.reset();
      showStatus('貼文已送出！重新載入最新留言…');
      await fetchPosts();
    } catch (error) {
      console.error('[Community UI] 送出貼文失敗', error);
      showStatus(error.message || '送出貼文失敗，請稍後再試。', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '送出貼文';
      }
    }
  }

  formEl.addEventListener('submit', submitPost);
  fetchPosts();
})();
