// community-board.js (v0.1 - Community discussion interactions)
// Patch Tag: LB-COMMUNITY-20250505B

const COMMUNITY_ENDPOINT = '/.netlify/functions/community-posts';

function formatTimestamp(timestamp) {
    if (!timestamp) return '剛剛';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '剛剛';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderEmptyState(listElement) {
    listElement.innerHTML = `
        <div class="empty-state">
            <h3>還沒有人發表留言</h3>
            <p>搶先分享你的回測心得、提問或技巧吧！</p>
        </div>
    `;
}

function renderPosts(listElement, posts = []) {
    if (!Array.isArray(posts) || posts.length === 0) {
        renderEmptyState(listElement);
        return;
    }

    const items = posts.map((post) => {
        const safeName = (post?.displayName || '匿名用戶').replace(/[<>]/g, '');
        const safeMessage = (post?.message || '').replace(/[<>]/g, '');
        return `
            <article class="post-card">
                <header class="post-card__header">
                    <span class="post-card__author">${safeName}</span>
                    <time class="post-card__time">${formatTimestamp(post?.createdAt)}</time>
                </header>
                <p class="post-card__content">${safeMessage.replace(/\n/g, '<br>')}</p>
            </article>
        `;
    });

    listElement.innerHTML = items.join('');
}

async function fetchPosts(listElement, statusElement) {
    try {
        statusElement.textContent = '載入最新留言中...';
        const response = await fetch(COMMUNITY_ENDPOINT, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data?.ok) {
            throw new Error(data?.message || '讀取留言失敗');
        }
        renderPosts(listElement, data.items);
        if (data.lastUpdated) {
            statusElement.textContent = `最後更新：${formatTimestamp(data.lastUpdated)}`;
        } else {
            statusElement.textContent = '';
        }
    } catch (error) {
        statusElement.textContent = '讀取留言時發生問題，稍後再試或檢查您的網路連線。';
        console.error('[Community] load error', error);
        renderEmptyState(listElement);
    }
}

async function submitPost(formElement, listElement, statusElement) {
    const submitButton = formElement.querySelector('button[type="submit"]');
    const nameInput = formElement.querySelector('input[name="displayName"]');
    const messageInput = formElement.querySelector('textarea[name="message"]');

    const payload = {
        displayName: nameInput.value,
        message: messageInput.value,
    };

    submitButton.disabled = true;
    submitButton.textContent = '送出中...';
    statusElement.textContent = '';

    try {
        const response = await fetch(COMMUNITY_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({ ok: false, message: '伺服器回應解析失敗' }));

        if (!response.ok || !data.ok) {
            const message = data?.message || `留言失敗 (HTTP ${response.status})`;
            statusElement.textContent = message;
            throw new Error(message);
        }

        nameInput.value = '';
        messageInput.value = '';
        statusElement.textContent = '留言成功！已同步到所有使用者。';
        await fetchPosts(listElement, statusElement);
    } catch (error) {
        console.error('[Community] post error', error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '發佈留言';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const formElement = document.querySelector('#community-form');
    const listElement = document.querySelector('#community-posts');
    const statusElement = document.querySelector('#community-status');
    const reloadButton = document.querySelector('#community-reload');

    if (!formElement || !listElement || !statusElement) {
        console.warn('[Community] 初始化元件失敗');
        return;
    }

    fetchPosts(listElement, statusElement);

    formElement.addEventListener('submit', (event) => {
        event.preventDefault();
        submitPost(formElement, listElement, statusElement);
    });

    if (reloadButton) {
        reloadButton.addEventListener('click', (event) => {
            event.preventDefault();
            fetchPosts(listElement, statusElement);
        });
    }
});
