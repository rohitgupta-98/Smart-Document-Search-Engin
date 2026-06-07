// ============================================================
// FRONTEND JAVASCRIPT - public/js/app.js
//
// Plain vanilla JS — no frameworks needed for a clean UI.
// Makes fetch() calls to our Express API endpoints.
// ============================================================

const API = '/api/documents';

// ─────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['search','add','browse'][i] === name);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');

  if (name === 'browse') loadDocuments();
  if (name === 'search') loadCategories();
}

// ─────────────────────────────────────────────
// LOAD CATEGORIES (for search filter dropdown)
// ─────────────────────────────────────────────
async function loadCategories() {
  try {
    const res = await fetch(`${API}/categories`);
    const data = await res.json();
    const select = document.getElementById('categoryFilter');
    // Keep first "All" option, then add categories
    select.innerHTML = '<option value="">All Categories</option>' +
      data.categories.map(c => `<option value="${c}">${c}</option>`).join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// ─────────────────────────────────────────────
// SEMANTIC SEARCH
// ─────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const category = document.getElementById('categoryFilter').value;
  const limit = document.getElementById('limitInput').value || 5;
  const container = document.getElementById('searchResults');

  if (!q) {
    container.innerHTML = '<div class="empty-state"><p>Please enter a search query</p></div>';
    return;
  }

  container.innerHTML = '<div class="loading">🔍 Searching (generating embedding + querying Pinecone)...</div>';

  try {
    // Build query string
    const params = new URLSearchParams({ q, limit });
    if (category) params.append('category', category);

    const res = await fetch(`${API}/search?${params}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    if (data.results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No results found for "<strong>${escHtml(q)}</strong>"</p>
          <small>Try adding some documents first (use "Add Document" tab)</small>
        </div>`;
      return;
    }

    const meta = `
      <div class="results-meta">
        <span>Found <strong>${data.totalResults}</strong> results for "<strong>${escHtml(q)}</strong>"
          ${category ? `in <em>${category}</em>` : ''}
        </span>
        <span>⚡ ${data.searchTimeMs}ms</span>
      </div>`;

    const cards = data.results.map(r => `
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">${escHtml(r.title)}</div>
          <div class="score-badge">Score: ${r.score}</div>
        </div>
        <div class="result-meta">
          <span class="badge category">${r.category}</span>
          <span>by ${escHtml(r.author)}</span>
          ${r.tags.map(t => `<span class="badge">#${t}</span>`).join('')}
        </div>
        <div class="result-preview">${escHtml(r.preview)}</div>
        <div class="result-actions">
          <button class="btn-danger" style="font-size:0.78rem;padding:4px 12px"
            onclick="deleteDoc('${r.mongoId}', this)">🗑 Delete</button>
        </div>
      </div>`).join('');

    container.innerHTML = meta + cards;
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">❌ Search failed: ${err.message}</div>`;
  }
}

// ─────────────────────────────────────────────
// ADD DOCUMENT
// ─────────────────────────────────────────────
async function addDocument() {
  const title    = document.getElementById('docTitle').value.trim();
  const author   = document.getElementById('docAuthor').value.trim();
  const category = document.getElementById('docCategory').value.trim();
  const content  = document.getElementById('docContent').value.trim();
  const tagsRaw  = document.getElementById('docTags').value.trim();
  const alert    = document.getElementById('addAlert');
  const btn      = document.getElementById('addBtn');

  if (!title || !author || !category || !content) {
    alert.innerHTML = '<div class="alert alert-error">Please fill in all required fields.</div>';
    return;
  }

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  btn.disabled = true;
  btn.textContent = 'Indexing...';
  alert.innerHTML = '';

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author, category, content, tags }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    alert.innerHTML = `<div class="alert alert-success">
      ✅ Document "<strong>${escHtml(title)}</strong>" added and indexed in Pinecone!
    </div>`;

    // Clear the form
    ['docTitle','docAuthor','docCategory','docContent','docTags']
      .forEach(id => document.getElementById(id).value = '');
  } catch (err) {
    alert.innerHTML = `<div class="alert alert-error">❌ Error: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add & Index Document';
  }
}

// ─────────────────────────────────────────────
// BROWSE / LIST DOCUMENTS
// ─────────────────────────────────────────────
let currentPage = 1;

async function loadDocuments(page = 1) {
  currentPage = page;
  const container = document.getElementById('documentsList');
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch(`${API}?page=${page}&pageSize=8`);
    const data = await res.json();

    document.getElementById('browseCount').textContent =
      `Total: ${data.total} document${data.total !== 1 ? 's' : ''}`;

    if (data.documents.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <p>No documents yet</p>
        <small>Use "Add Document" tab or run "npm run seed" to add samples</small>
      </div>`;
      return;
    }

    container.innerHTML = data.documents.map(d => `
      <div class="doc-card" id="doc-${d._id}">
        <div class="doc-info">
          <div class="doc-title">${escHtml(d.title)}</div>
          <div class="doc-sub">
            <span class="badge category" style="font-size:0.75rem">${d.category}</span>
            &nbsp;by ${escHtml(d.author)}
            &nbsp;·&nbsp;${new Date(d.createdAt).toLocaleDateString()}
          </div>
          <div style="margin-top:6px">
            ${d.tags.map(t => `<span class="badge" style="font-size:0.75rem">#${t}</span>`).join(' ')}
          </div>
        </div>
        <button class="btn-danger" style="font-size:0.78rem;padding:4px 12px;margin-left:12px"
          onclick="deleteDoc('${d._id}', this)">🗑</button>
      </div>`).join('');

    // Pagination buttons
    const pg = document.getElementById('pagination');
    pg.innerHTML = '';
    if (data.totalPages > 1) {
      for (let i = 1; i <= data.totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === page ? 'btn-primary' : 'btn-secondary';
        btn.style.padding = '6px 14px';
        btn.onclick = () => loadDocuments(i);
        pg.appendChild(btn);
      }
    }
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">❌ Failed to load: ${err.message}</div>`;
  }
}

// ─────────────────────────────────────────────
// DELETE DOCUMENT
// ─────────────────────────────────────────────
async function deleteDoc(id, btnEl) {
  if (!confirm('Delete this document from MongoDB and Pinecone?')) return;

  btnEl.disabled = true;
  btnEl.textContent = '...';

  try {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    // Remove card from DOM
    const card = document.getElementById(`doc-${id}`);
    if (card) card.remove();

    // Also remove from search results if visible
    btnEl.closest('.result-card')?.remove();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
    btnEl.disabled = false;
    btnEl.textContent = '🗑';
  }
}

// ─────────────────────────────────────────────
// UTILITY: Escape HTML to prevent XSS
// ─────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────
// INIT on page load
// ─────────────────────────────────────────────
loadCategories();
