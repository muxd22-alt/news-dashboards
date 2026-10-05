document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-link-section').classList.add('hidden');

  const addForm = document.getElementById('add-form');
  const statusMsg = document.getElementById('status-message');

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('url-input').value;
    const btn = document.getElementById('submit-btn');

    try {
      btn.textContent = 'Sending...';
      btn.disabled = true;
      statusMsg.textContent = '';
      statusMsg.className = '';

      const response = await fetch('/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (response.ok) {
        statusMsg.textContent = 'Link successfully sent to the Engine!';
        statusMsg.className = 'success-msg';
        document.getElementById('url-input').value = '';
      } else {
        statusMsg.textContent = data.error || 'Failed to send link.';
        statusMsg.className = 'error-msg';
      }
    } catch (err) {
      statusMsg.textContent = 'Network error. Could not reach the API.';
      statusMsg.className = 'error-msg';
    } finally {
      btn.textContent = 'Send to Engine';
      btn.disabled = false;
    }
  });

  loadFeed();
});

function toggleAddSection() {
  const section = document.getElementById('add-link-section');
  section.classList.toggle('hidden');
  if (!section.classList.contains('hidden')) {
    document.getElementById('url-input').focus();
  }
}

const ITEMS_PER_PAGE = 3;
let gapsPage = 1;
let feedsPage = 1;
let gapsData = [];
let feedsData = [];

function createPagination(containerId, currentPage, totalItems, onPageChange) {
  const container = document.getElementById(containerId);
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="pagination-controls">
      <button class="page-btn" onclick="goToPage('${containerId}', ${currentPage - 1}, ${totalPages}, '${onPageChange}')" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>
      <span class="page-info">Page ${currentPage} of ${totalPages}</span>
      <button class="page-btn" onclick="goToPage('${containerId}', ${currentPage + 1}, ${totalPages}, '${onPageChange}')" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
    </div>
  `;
}

function goToPage(containerId, page, totalPages, callback) {
  if (page < 1 || page > totalPages) return;
  if (containerId === 'gaps-pagination') gapsPage = page;
  if (containerId === 'feed-pagination') feedsPage = page;
  window[callback]();
}

function renderFeedItem(link) {
  return `
    <div class="glass-card feed-item" style="position: relative;">
      <button onclick="deleteFeedItem('${link.url}', event)" class="delete-btn" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" title="Delete Extract" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-muted)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
      <h3>${link.title}</h3>
      <div class="summary-content" style="flex-grow: 1; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.95rem;">
        ${marked.parse(link.summary)}
      </div>
      <div class="keywords" style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${(link.keywords || []).map(kw => `
          <span style="display: flex; align-items: center; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem;">
            <span style="color: var(--accent-blue); margin-right: 6px; font-weight: 600;">#${kw}</span>
            <a href="https://x.com/search?q=${encodeURIComponent(kw)}" target="_blank" style="color: #1da1f2; margin-right: 6px; text-decoration: none;" title="Search on X">𝕏</a>
            <a href="https://search.brave.com/search?q=${encodeURIComponent(kw)}" target="_blank" style="color: #ff2000; text-decoration: none;" title="Search on Brave">🦁</a>
          </span>
        `).join('')}
      </div>
      <a href="${link.url}" class="link" target="_blank">Source Link →</a>
      <span class="date">${link.date}</span>
    </div>
  `;
}

function renderGapItem(gap) {
  return `
    <div class="glass-card gap-item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <h4 style="margin: 0; color: var(--accent-purple);">${gap.title}</h4>
        <a href="${gap.url}" class="link" target="_blank" style="font-size: 0.75rem;">Source →</a>
      </div>
      <div class="gap-keywords" style="margin-bottom: 0.75rem; display: flex; gap: 0.3rem; flex-wrap: wrap;">
        ${(gap.keywords || []).map(kw => `
          <span style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 0.1rem 0.4rem; border-radius: 8px; font-size: 0.7rem; color: #a855f7;">#${kw}</span>
        `).join('')}
      </div>
      <div class="gap-content" style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;">
        ${marked.parse(gap.gap || '')}
      </div>
      <span class="date" style="margin-top: 0.5rem; display: block;">${gap.date}</span>
    </div>
  `;
}

function renderFeeds() {
  const feedContainer = document.getElementById('feed-container');
  const start = (feedsPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedFeeds = feedsData.slice(start, end);

  if (paginatedFeeds.length > 0) {
    feedContainer.innerHTML = paginatedFeeds.map(renderFeedItem).join('');
  } else {
    feedContainer.innerHTML = '<p class="loading">No recent intelligence extracts.</p>';
  }

  createPagination('feed-pagination', feedsPage, feedsData.length, 'renderFeeds');
}

function renderGaps() {
  const gapsContainer = document.getElementById('gaps-container');
  const start = (gapsPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedGaps = gapsData.slice(start, end);

  if (paginatedGaps.length > 0) {
    gapsContainer.innerHTML = paginatedGaps.map(renderGapItem).join('');
  } else {
    gapsContainer.innerHTML = '<p class="loading">No knowledge gaps yet.</p>';
  }

  createPagination('gaps-pagination', gapsPage, gapsData.length, 'renderGaps');
}

async function loadFeed() {
  const digestContent = document.getElementById('daily-digest-content');

  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Data not found');
    const data = await response.json();

    if (data.masterDigest && data.masterDigest !== 'Awaiting initial intelligence compile...' && data.masterDigest.trim() !== '') {
      digestContent.innerHTML = `<div>${marked.parse(data.masterDigest)}</div><span style="font-size: 0.8rem; color: #94a3b8; display: block; margin-top: 1rem;">Updated: ${data.lastGenerated}</span>`;
    } else {
      digestContent.innerHTML = '<p class="loading">Add links to generate executive summary...</p>';
    }

    feedsData = data.links || [];
    feedsPage = 1;
    renderFeeds();
  } catch (err) {
    digestContent.innerHTML = '<p class="loading">Awaiting initial intelligence compile...</p>';
    document.getElementById('feed-container').innerHTML = '<p class="loading">Waiting for new incoming links...</p>';
  }

  try {
    const gapsResponse = await fetch('gaps.json');
    if (gapsResponse.ok) {
      const gapsJson = await gapsResponse.json();
      gapsData = gapsJson.gaps || [];
      gapsPage = 1;
      renderGaps();
    }
  } catch (err) {
    document.getElementById('gaps-container').innerHTML = '<p class="loading">Unable to load gaps.</p>';
  }
}

async function deleteFeedItem(url, event) {
  if (!confirm('Are you sure you want to delete this extract?')) return;
  
  const btn = event.currentTarget;
  const originalHtml = btn.innerHTML;
  
  try {
    btn.innerHTML = '<span style="font-size:12px;">...</span>';
    btn.disabled = true;

    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    const data = await res.json();
    if (res.ok) {
      feedsData = feedsData.filter(item => item.url !== url);
      renderFeeds();
    } else {
      alert(data.error || 'Failed to delete.');
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  } catch (err) {
    alert('Network error. Could not reach delete API.');
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}
