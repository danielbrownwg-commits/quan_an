    /* ==========================================================================
       7. MAIN RENDERERS (Header, Category Bar, Places List)
       ========================================================================== */
import { exportBackupJson } from './backup.js';
import { DB } from './db.js';
import { State, getFilteredPlaces, hasActiveFilters, resetCustomFilters } from './state.js';
import { closeModal, openModal, showToast } from './ui.js';
import { esc, highlightMatch } from './util.js';
import { closeSheet, openPlaceDetail } from './views/detail.js';
import { openPlaceForm } from './views/form.js';
import { renderRandomView } from './views/random.js';
import { renderSettingsView } from './views/settings.js';
import { renderStatsView } from './views/stats.js';

    function applyTheme() {
      document.documentElement.setAttribute('data-theme', State.settings.theme || 'auto');
    }

    export function renderAll() {
      applyTheme();
      renderHeader();
      renderBackupBanner();
      renderActiveFiltersBar();

      const fab = document.getElementById('btn-fab-add');
      fab.style.display = State.tab === 'places' ? 'inline-flex' : 'none';

      document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === State.tab);
      });

      if (State.tab === 'places') renderPlacesView();
      else if (State.tab === 'stats') renderStatsView();
      else if (State.tab === 'random') renderRandomView();
      else if (State.tab === 'settings') renderSettingsView();
    }

    function renderHeader() {
      const titleEl = document.getElementById('header-title');
      const homeActions = document.getElementById('header-home-actions');
      const catBar = document.getElementById('cat-bar');
      const searchWrap = document.getElementById('search-bar-wrap');

      if (State.tab !== 'places') {
        homeActions.style.display = 'none';
        catBar.style.display = 'none';
        searchWrap.classList.remove('open');
        const titles = { stats: 'Stats', random: 'Where to today?', settings: 'Settings & Data' };
        titleEl.textContent = titles[State.tab] || 'Places';
        return;
      }

      titleEl.textContent = 'Places';
      homeActions.style.display = 'flex';
      catBar.style.display = 'flex';
      document.getElementById('filter-active-dot').style.display = hasActiveFilters() ? 'block' : 'none';

      const counts = { all: State.places.length };
      for (const p of State.places) counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;

      const sortedCats = [...State.categories].sort((a, b) => a.order - b.order);
      let html = `<button class="cat-chip ${State.selectedCatId === 'all' ? 'active' : ''}" data-cat="all">
        All <span class="count tabular-nums">(${counts.all})</span>
      </button>`;

      for (const c of sortedCats) {
        const cnt = counts[c.id] || 0;
        html += `<button class="cat-chip ${State.selectedCatId === c.id ? 'active' : ''}" data-cat="${esc(c.id)}">
          ${esc(c.icon)} ${esc(c.name)} <span class="count tabular-nums">(${cnt})</span>
        </button>`;
      }
      catBar.innerHTML = html;
      catBar.querySelectorAll('.cat-chip').forEach(btn => {
        btn.onclick = () => {
          State.selectedCatId = btn.dataset.cat;
          resetCustomFilters();
          renderAll();
        };
      });
    }

    function renderBackupBanner() {
      const wrap = document.getElementById('backup-reminder-wrap');
      if (State.tab !== 'places' || State.places.length === 0) {
        wrap.innerHTML = '';
        return;
      }
      const last = State.settings.lastBackupAt ? new Date(State.settings.lastBackupAt).getTime() : 0;
      const days = (Date.now() - last) / (1000 * 3600 * 24);
      if (days > 14) {
        wrap.innerHTML = `
          <div class="backup-banner">
            <span>⚠️ It's been over 14 days since your last backup.</span>
            <button class="btn-primary" id="btn-quick-backup" style="min-height:34px;padding:0 12px;font-size:0.85rem;">Back up now</button>
          </div>`;
        document.getElementById('btn-quick-backup').onclick = exportBackupJson;
      } else {
        wrap.innerHTML = '';
      }
    }

    function renderActiveFiltersBar() {
      const wrap = document.getElementById('active-filters-wrap');
      if (State.tab !== 'places' || !hasActiveFilters()) {
        wrap.innerHTML = '';
        return;
      }
      const f = State.filters;
      const pills = [];
      if (f.status !== 'all') pills.push(f.status === 'visited' ? 'Visited' : 'Want to go');
      if (f.minRating === -1) pills.push('Unrated');
      else if (f.minRating > 0) pills.push(`≥ ${f.minRating}★`);
      if (f.prices.length) pills.push(f.prices.map(p => '$'.repeat(p)).join(', '));
      if (f.onlyFav) pills.push('♥ Favorite');
      f.tags.forEach(t => pills.push(`#${t}`));

      for (const [k, v] of Object.entries(f.custom)) {
        if (Array.isArray(v) && v.length) pills.push(v.join(', '));
        else if (typeof v === 'string' && v !== 'all') pills.push(`${k}: ${v}`);
        else if (typeof v === 'object' && (v.min || v.max)) pills.push(`${v.min || 0}–${v.max || '∞'}`);
      }

      wrap.innerHTML = `
        <div class="active-filters-bar">
          ${pills.map(p => `<span class="filter-pill">${esc(p)}</span>`).join('')}
          <button class="clear-filters-btn" id="btn-clear-all-filters">Clear filters</button>
        </div>`;
      document.getElementById('btn-clear-all-filters').onclick = () => {
        State.filters = { status: 'all', minRating: 0, prices: [], tags: [], onlyFav: false, custom: {}, sortBy: State.filters.sortBy };
        renderAll();
      };
    }

    export async function renderPlacesView() {
      const main = document.getElementById('main-view');
      const places = getFilteredPlaces();
      const catMap = new Map(State.categories.map(c => [c.id, c]));

      if (places.length === 0) {
        main.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🧭</div>
            <p style="font-size:1.05rem;font-weight:600;color:var(--text);">No matching places</p>
            <p style="font-size:0.9rem;margin-bottom:18px;">Save your regular spots or places you want to visit soon.</p>
            <button class="btn-primary" id="btn-empty-add">+ Add your first place</button>
          </div>`;
        document.getElementById('btn-empty-add').onclick = () => openPlaceForm(null);
        return;
      }

      const listEl = document.createElement('div');
      listEl.className = `places-list ${State.settings.gridCols === 2 ? 'cols-2' : ''}`;

      for (const p of places) {
        const cat = catMap.get(p.categoryId) || { icon: '📍', name: 'Other', fields: [] };
        const card = document.createElement('article');
        card.className = 'place-card';

        // Custom fields shown on the card (max 2 fields with showOnCard: true)
        const cardFields = (cat.fields || []).filter(fd => fd.showOnCard).slice(0, 2);
        let customHtml = '';
        for (const fd of cardFields) {
          const val = p.customValues ? p.customValues[fd.id] : undefined;
          if (val !== undefined && val !== '' && val !== null && !(Array.isArray(val) && val.length === 0)) {
            const disp = fd.type === 'checkbox' ? (val ? 'Yes' : 'No') : Array.isArray(val) ? val.join(', ') : val;
            customHtml += `<div class="card-custom-row"><span class="lbl">${esc(fd.label)}:</span> ${highlightMatch(String(disp), State.searchQuery)}</div>`;
          }
        }

        const firstPhoto = (p.photos && p.photos.length > 0) ? p.photos[0] : null;
        const thumbKey = firstPhoto ? (firstPhoto.thumbKey || firstPhoto.blobKey) : null;

        card.innerHTML = `
          <div class="card-thumb" data-thumb-key="${esc(thumbKey || '')}">
            <span>${esc(cat.icon)}</span>
            ${p.favorite ? `<div class="card-fav-badge" title="Favorite">♥</div>` : ''}
          </div>
          <div class="card-body">
            <div class="card-top-row">
              <h2 class="card-title">${highlightMatch(p.name, State.searchQuery)}</h2>
              <button class="card-more-btn" data-more="${esc(p.id)}" aria-label="Quick actions">⋯</button>
            </div>
            <div class="card-meta-row tabular-nums">
              <span class="status-badge ${p.status}">${p.status === 'visited' ? 'Visited' : 'Want to go'}</span>
              ${p.rating ? `<span class="rating-inline">★ ${p.rating}</span>` : ''}
              ${p.priceLevel ? `<span class="price-inline">${'$'.repeat(p.priceLevel)}</span>` : ''}
            </div>
            ${customHtml}
            ${p.address ? `<div class="card-address">${highlightMatch(p.address, State.searchQuery)}</div>` : ''}
            ${(p.tags && p.tags.length) ? `<div class="card-tags">${p.tags.slice(0, 3).map(t => `<span class="tag-chip">#${highlightMatch(t, State.searchQuery)}</span>`).join('')}</div>` : ''}
          </div>`;

        card.onclick = (e) => {
          if (e.target.closest('[data-more]')) {
            e.stopPropagation();
            openQuickCardMenu(p);
            return;
          }
          openPlaceDetail(p.id);
        };

        listEl.appendChild(card);

        if (thumbKey) {
          DB.getPhotoUrl(thumbKey).then(url => {
            if (url) {
              const box = card.querySelector('.card-thumb');
              if (box) {
                const favHtml = p.favorite ? `<div class="card-fav-badge">♥</div>` : '';
                box.innerHTML = `<img src="${url}" loading="lazy" alt="${esc(p.name)}">${favHtml}`;
              }
            }
          });
        }
      }

      main.innerHTML = '';
      main.appendChild(listEl);
    }

    function openQuickCardMenu(place) {
      const nextStatus = place.status === 'visited' ? 'want' : 'visited';
      openModal(place.name, `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn-secondary" id="qm-status" style="justify-content:flex-start;">
            🔄 Switch to "${nextStatus === 'visited' ? 'Visited' : 'Want to go'}"
          </button>
          <button class="btn-secondary" id="qm-fav" style="justify-content:flex-start;">
            ${place.favorite ? '💔 Remove favorite' : '❤️ Mark as favorite'}
          </button>
          <button class="btn-secondary" id="qm-edit" style="justify-content:flex-start;">
            ✏️ Edit place
          </button>
          <button class="btn-danger" id="qm-del" style="justify-content:flex-start;">
            🗑️ Delete place
          </button>
        </div>
      `, () => {
        document.getElementById('qm-status').onclick = async () => {
          place.status = nextStatus;
          if (nextStatus === 'visited' && !place.visitedAt) place.visitedAt = new Date().toISOString().slice(0, 10);
          place.updatedAt = new Date().toISOString();
          await DB.put('places', place);
          closeModal();
          renderAll();
        };
        document.getElementById('qm-fav').onclick = async () => {
          place.favorite = !place.favorite;
          place.updatedAt = new Date().toISOString();
          await DB.put('places', place);
          closeModal();
          renderAll();
        };
        document.getElementById('qm-edit').onclick = () => {
          closeModal();
          openPlaceForm(place);
        };
        document.getElementById('qm-del').onclick = () => {
          closeModal();
          deletePlaceWithUndo(place);
        };
      });
    }

    export async function deletePlaceWithUndo(place) {
      const idx = State.places.findIndex(p => p.id === place.id);
      if (idx === -1) return;
      State.places.splice(idx, 1);
      await DB.delete('places', place.id);
      closeSheet();
      renderAll();

      let undone = false;
      showToast(`Deleted "${place.name}"`, 'Undo', async () => {
        undone = true;
        State.places.push(place);
        await DB.put('places', place);
        renderAll();
      }, 5000);

      setTimeout(async () => {
        if (!undone && place.photos) {
          for (const ph of place.photos) {
            await DB.delete('photos', ph.blobKey);
            if (ph.thumbKey) await DB.delete('photos', ph.thumbKey);
            DB.revokePhotoUrl(ph.blobKey);
            if (ph.thumbKey) DB.revokePhotoUrl(ph.thumbKey);
          }
        }
      }, 5500);
    }
