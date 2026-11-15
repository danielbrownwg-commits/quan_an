    /* ==========================================================================
       11. STATS VIEW (SVG/HTML Visualization §5.4)
       ========================================================================== */
import { renderAll } from '../render.js';
import { State } from '../state.js';
import { esc } from '../util.js';
import { openPlaceDetail } from './detail.js';

    export function renderStatsView() {
      const main = document.getElementById('main-view');
      const total = State.places.length;
      const visited = State.places.filter(p => p.status === 'visited').length;
      const want = total - visited;
      const visitedPct = total ? Math.round((visited / total) * 100) : 0;

      // Theo category
      const catCounts = State.categories.map(c => ({
        cat: c,
        count: State.places.filter(p => p.categoryId === c.id).length
      })).sort((a, b) => b.count - a.count);
      const maxCat = Math.max(1, ...catCounts.map(x => x.count));

      // Rating distribution (0.5 -> 5.0)
      const ratingBins = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
      const ratingCounts = ratingBins.map(r => ({
        r,
        c: State.places.filter(p => p.rating === r).length
      }));
      const maxR = Math.max(1, ...ratingCounts.map(x => x.c));

      // Activity, last 12 months
      const months = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const c = State.places.filter(p => (p.visitedAt || p.createdAt || '').startsWith(ym)).length;
        months.push({ ym, label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`, c });
      }
      const maxM = Math.max(1, ...months.map(m => m.c));

      // Top tags
      const tagMap = {};
      State.places.forEach(p => (p.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));
      const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

      // Top 5 rated
      const topRated = [...State.places].filter(p => p.rating !== null).sort((a, b) => b.rating - a.rating).slice(0, 5);

      // List every select/checkbox CustomField to show its distribution
      const customAnalyzable = [];
      for (const c of State.categories) {
        for (const fd of (c.fields || [])) {
          if (['select', 'multiselect', 'checkbox'].includes(fd.type)) {
            customAnalyzable.push({ key: `${c.id}::${fd.id}`, label: `${c.icon} ${c.name} — ${fd.label}`, cat: c, field: fd });
          }
        }
      }
      if (!State.statsCustomFieldId && customAnalyzable.length) {
        State.statsCustomFieldId = customAnalyzable[0].key;
      }

      let customDistHtml = '';
      const chosenMeta = customAnalyzable.find(x => x.key === State.statsCustomFieldId);
      if (chosenMeta) {
        const distMap = {};
        const catPlaces = State.places.filter(p => p.categoryId === chosenMeta.cat.id);
        for (const p of catPlaces) {
          const v = p.customValues ? p.customValues[chosenMeta.field.id] : undefined;
          if (chosenMeta.field.type === 'checkbox') {
            const k = v ? 'Yes' : 'No';
            distMap[k] = (distMap[k] || 0) + 1;
          } else if (Array.isArray(v)) {
            v.forEach(item => { distMap[item] = (distMap[item] || 0) + 1; });
          } else if (v) {
            distMap[v] = (distMap[v] || 0) + 1;
          }
        }
        const entries = Object.entries(distMap);
        const maxC = Math.max(1, ...entries.map(e => e[1]));
        customDistHtml = entries.length ? entries.map(([k, cnt]) => `
          <div class="bar-row tabular-nums">
            <span class="bar-label">${esc(k)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(cnt / maxC) * 100}%"></div></div>
            <span class="bar-val">${cnt}</span>
          </div>`).join('') : `<div style="font-size:0.85rem;color:var(--text-muted);">No data for this field yet.</div>`;
      }

      main.innerHTML = `
        <div class="stat-card">
          <h3 class="stat-title">Places overview</h3>
          <div style="display:flex;align-items:center;gap:18px;">
            <svg width="96" height="96" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--surface-2)" stroke-width="4"/>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--accent)" stroke-width="4" stroke-dasharray="${visitedPct}, 100"/>
              <text x="18" y="20.5" text-anchor="middle" fill="var(--text)" font-size="7.5" font-weight="600">${visitedPct}%</text>
            </svg>
            <div class="tabular-nums" style="flex:1;display:flex;flex-direction:column;gap:6px;">
              <div>Total: <strong>${total}</strong> places</div>
              <div style="color:var(--accent);cursor:pointer;" data-jump-status="visited">✓ Visited: <strong>${visited}</strong></div>
              <div style="color:var(--text-muted);cursor:pointer;" data-jump-status="want">☆ Want to go: <strong>${want}</strong></div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <h3 class="stat-title">By category (tap to filter)</h3>
          ${catCounts.map(({ cat, count }) => `
            <div class="bar-row tabular-nums" data-jump-cat="${esc(cat.id)}">
              <span class="bar-label">${esc(cat.icon)} ${esc(cat.name)}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(count / maxCat) * 100}%"></div></div>
              <span class="bar-val">${count}</span>
            </div>`).join('')}
        </div>

        <div class="stat-card">
          <h3 class="stat-title">Rating distribution (0.5 – 5★)</h3>
          <div style="display:flex;align-items:flex-end;gap:6px;height:110px;padding-top:14px;">
            ${ratingCounts.map(({ r, c }) => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span class="tabular-nums" style="font-size:0.7rem;color:var(--text-muted);">${c || ''}</span>
                <div style="width:100%;background:var(--star);border-radius:4px 4px 0 0;height:${Math.max(4, Math.round((c / maxR) * 72))}px;opacity:${c ? 1 : 0.2};"></div>
                <span class="tabular-nums" style="font-size:0.72rem;">${r}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="stat-card">
          <h3 class="stat-title">Activity, last 12 months</h3>
          <div style="display:flex;align-items:flex-end;gap:4px;height:115px;padding-top:14px;">
            ${months.map(m => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span class="tabular-nums" style="font-size:0.68rem;color:var(--text-muted);">${m.c || ''}</span>
                <div style="width:100%;background:var(--accent);border-radius:4px 4px 0 0;height:${Math.max(4, Math.round((m.c / maxM) * 72))}px;opacity:${m.c ? 1 : 0.2};"></div>
                <span class="tabular-nums" style="font-size:0.62rem;writing-mode:vertical-rl;transform:rotate(180deg);height:28px;">${m.label}</span>
              </div>`).join('')}
          </div>
        </div>

        ${customAnalyzable.length ? `
        <div class="stat-card">
          <h3 class="stat-title">Distribution by custom field</h3>
          <select class="form-control" id="stat-custom-select" style="margin-bottom:12px;">
            ${customAnalyzable.map(item => `<option value="${esc(item.key)}" ${item.key === State.statsCustomFieldId ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}
          </select>
          ${customDistHtml}
        </div>` : ''}

        <div class="stat-card">
          <h3 class="stat-title">Top rated</h3>
          ${topRated.length ? topRated.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" data-open-place="${esc(p.id)}">
              <span style="font-weight:600;">${esc(p.name)}</span>
              <span class="rating-inline tabular-nums">★ ${p.rating}</span>
            </div>`).join('') : '<div style="color:var(--text-muted);font-size:0.9rem;">No places rated yet.</div>'}
        </div>

        <div class="stat-card">
          <h3 class="stat-title">Top Tags</h3>
          <div class="chip-group">
            ${topTags.length ? topTags.map(([t, c]) => `<button class="choice-chip" data-jump-tag="${esc(t)}">#${esc(t)} (${c})</button>`).join('') : '<span style="color:var(--text-muted);font-size:0.9rem;">No tags yet.</span>'}
          </div>
        </div>`;

      main.querySelectorAll('[data-jump-cat]').forEach(el => el.onclick = () => {
        State.selectedCatId = el.dataset.jumpCat;
        State.tab = 'places';
        renderAll();
      });
      main.querySelectorAll('[data-jump-status]').forEach(el => el.onclick = () => {
        State.filters.status = el.dataset.jumpStatus;
        State.tab = 'places';
        renderAll();
      });
      main.querySelectorAll('[data-jump-tag]').forEach(el => el.onclick = () => {
        State.filters.tags = [el.dataset.jumpTag];
        State.tab = 'places';
        renderAll();
      });
      main.querySelectorAll('[data-open-place]').forEach(el => el.onclick = () => openPlaceDetail(el.dataset.openPlace));
      const cSel = document.getElementById('stat-custom-select');
      if (cSel) cSel.onchange = (e) => { State.statsCustomFieldId = e.target.value; renderStatsView(); };
    }
