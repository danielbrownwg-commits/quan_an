    /* ==========================================================================
       12. RANDOM PICKER VIEW — "Where to today?" (§5.5)
       ========================================================================== */
import { State } from '../state.js';
import { showToast } from '../ui.js';
import { esc } from '../util.js';
import { openPlaceDetail } from './detail.js';

    export function renderRandomView() {
      const main = document.getElementById('main-view');
      const ro = State.randomOpts;
      const sortedCats = [...State.categories].sort((a, b) => a.order - b.order);

      const pool = State.places.filter(p => {
        if (ro.catId !== 'all' && p.categoryId !== ro.catId) return false;
        if (ro.onlyWant && p.status !== 'want') return false;
        if (ro.maxPrice > 0 && p.priceLevel > ro.maxPrice) return false;
        return true;
      });

      const pick = State.randomPick;

      main.innerHTML = `
        <div class="stat-card">
          <div class="form-group">
            <label class="form-label">Choose category</label>
            <select class="form-control" id="rnd-cat">
              <option value="all" ${ro.catId === 'all' ? 'selected' : ''}>All categories</option>
              ${sortedCats.map(c => `<option value="${esc(c.id)}" ${ro.catId === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Max price level</label>
            <div class="chip-group">
              ${[[0, 'Any'], [1, '$'], [2, '$$'], [3, '$$$'], [4, '$$$$']].map(([val, lbl]) => `
                <button type="button" class="choice-chip ${ro.maxPrice === val ? 'selected' : ''}" data-rnd-price="${val}">${lbl}</button>`).join('')}
            </div>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
              <input type="checkbox" id="rnd-only-want" ${ro.onlyWant ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent);">
              <span style="font-weight:600;">Only pick from "Want to go"</span>
            </label>
          </div>

          <button class="btn-primary" id="btn-roll-random" style="width:100%;height:48px;font-size:1.05rem;">
            🎲 Pick randomly (${pool.length} matching places)
          </button>
        </div>

        ${pick ? `
        <div class="stat-card" style="border:2px solid var(--accent);">
          <div style="font-size:0.82rem;color:var(--accent);font-weight:600;margin-bottom:4px;">TODAY'S PICK</div>
          <h2 style="margin:0 0 8px;">${esc(pick.name)}</h2>
          <div class="card-meta-row tabular-nums" style="margin-bottom:8px;">
            <span class="status-badge ${pick.status}">${pick.status === 'visited' ? 'Visited' : 'Want to go'}</span>
            ${pick.rating ? `<span class="rating-inline">★ ${pick.rating}</span>` : ''}
            ${pick.priceLevel ? `<span class="price-inline">${'$'.repeat(pick.priceLevel)}</span>` : ''}
          </div>
          ${pick.address ? `<div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:10px;">📍 ${esc(pick.address)}</div>` : ''}
          ${pick.review ? `<div style="font-size:0.92rem;margin-bottom:12px;">${esc(pick.review)}</div>` : ''}
          <div style="display:flex;gap:10px;">
            <button class="btn-secondary" id="btn-rnd-again" style="flex:1;">Pick another</button>
            <button class="btn-primary" id="btn-rnd-detail" style="flex:1;">View details</button>
          </div>
        </div>` : ''}`;

      document.getElementById('rnd-cat').onchange = (e) => { ro.catId = e.target.value; State.randomPick = null; renderRandomView(); };
      document.getElementById('rnd-only-want').onchange = (e) => { ro.onlyWant = e.target.checked; State.randomPick = null; renderRandomView(); };
      main.querySelectorAll('[data-rnd-price]').forEach(b => b.onclick = () => {
        ro.maxPrice = parseInt(b.dataset.rndPrice, 10);
        State.randomPick = null;
        renderRandomView();
      });

      const roll = () => {
        if (pool.length === 0) {
          showToast('No places match the criteria!');
          return;
        }
        let candidates = pool.length > 1 && State.randomPick ? pool.filter(p => p.id !== State.randomPick.id) : pool;
        State.randomPick = candidates[Math.floor(Math.random() * candidates.length)];
        renderRandomView();
      };

      document.getElementById('btn-roll-random').onclick = roll;
      const againBtn = document.getElementById('btn-rnd-again');
      if (againBtn) againBtn.onclick = roll;
      const detBtn = document.getElementById('btn-rnd-detail');
      if (detBtn) detBtn.onclick = () => openPlaceDetail(pick.id);
    }
