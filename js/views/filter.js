    /* ==========================================================================
       10. FILTER BOTTOM SHEET (§5.3 + CustomField filters §6b)
       ========================================================================== */
import { renderAll } from '../render.js';
import { State } from '../state.js';
import { closeModal, openModal } from '../ui.js';
import { esc } from '../util.js';

    export function openFilterModal() {
      const f = State.filters;
      const currentCat = State.selectedCatId !== 'all' ? State.categories.find(c => c.id === State.selectedCatId) : null;

      // Get the tags present in the current category
      const tagSet = new Set();
      State.places.forEach(p => {
        if (State.selectedCatId === 'all' || p.categoryId === State.selectedCatId) {
          (p.tags || []).forEach(t => tagSet.add(t));
        }
      });
      const catTags = Array.from(tagSet);

      let customFilterHtml = '';
      if (currentCat) {
        const filterableFields = (currentCat.fields || []).filter(fd => fd.filterable);
        if (filterableFields.length > 0) {
          customFilterHtml += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
            <div class="form-label" style="color:var(--accent);">Filter by ${esc(currentCat.name)}</div>`;
          for (const fd of filterableFields) {
            const curVal = f.custom[fd.id];
            if (fd.type === 'select' || fd.type === 'multiselect') {
              const selArr = Array.isArray(curVal) ? curVal : [];
              customFilterHtml += `<div class="form-group"><label class="form-label">${esc(fd.label)}</label>
                <div class="chip-group">
                  ${(fd.options || []).map(o => `<button type="button" class="choice-chip ${selArr.includes(o) ? 'selected' : ''}" data-cf-multi="${esc(fd.id)}" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
                </div></div>`;
            } else if (fd.type === 'checkbox') {
              const st = curVal || 'all';
              customFilterHtml += `<div class="form-group"><label class="form-label">${esc(fd.label)}</label>
                <div class="chip-group">
                  ${[['all', 'All'], ['yes', 'Yes'], ['no', 'No']].map(([k, lbl]) => `<button type="button" class="choice-chip ${st === k ? 'selected' : ''}" data-cf-bool="${esc(fd.id)}" data-val="${k}">${lbl}</button>`).join('')}
                </div></div>`;
            } else if (fd.type === 'number') {
              const minV = curVal?.min ?? '';
              const maxV = curVal?.max ?? '';
              customFilterHtml += `<div class="form-group"><label class="form-label">${esc(fd.label)} (Min – Max)</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <input type="number" class="form-control" data-cf-num="${esc(fd.id)}" data-bound="min" placeholder="From..." value="${esc(minV)}">
                  <input type="number" class="form-control" data-cf-num="${esc(fd.id)}" data-bound="max" placeholder="To..." value="${esc(maxV)}">
                </div></div>`;
            }
          }
          customFilterHtml += `</div>`;
        }
      }

      openModal('Filter & Sort', `
        <div class="form-group">
          <label class="form-label">Sort by</label>
          <div class="chip-group">
            ${[['newest', 'Newest'], ['rating', 'Rating high→low'], ['name', 'Name A→Z'], ['visited', 'Recently visited']].map(([k, lbl]) => `
              <button type="button" class="choice-chip ${f.sortBy === k ? 'selected' : ''}" data-sort="${k}">${lbl}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <div class="chip-group">
            ${[['all', 'All'], ['visited', 'Visited'], ['want', 'Want to go']].map(([k, lbl]) => `
              <button type="button" class="choice-chip ${f.status === k ? 'selected' : ''}" data-f-status="${k}">${lbl}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Minimum rating</label>
          <div class="chip-group">
            ${[[0, 'All'], [3, '≥ 3★'], [4, '≥ 4★'], [4.5, '≥ 4.5★'], [-1, 'Unrated']].map(([k, lbl]) => `
              <button type="button" class="choice-chip ${f.minRating === k ? 'selected' : ''}" data-f-rating="${k}">${lbl}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Price level</label>
          <div class="chip-group">
            ${[1, 2, 3, 4].map(p => `<button type="button" class="choice-chip ${f.prices.includes(p) ? 'selected' : ''}" data-f-price="${p}">${'$'.repeat(p)}</button>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="f-only-fav" ${f.onlyFav ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent);">
            <span style="font-weight:600;">Show favorites only (♥)</span>
          </label>
        </div>

        ${catTags.length ? `<div class="form-group">
          <label class="form-label">Tags</label>
          <div class="chip-group">
            ${catTags.map(t => `<button type="button" class="choice-chip ${f.tags.includes(t) ? 'selected' : ''}" data-f-tag="${esc(t)}">#${esc(t)}</button>`).join('')}
          </div>
        </div>` : ''}

        ${customFilterHtml}

        <div style="display:flex;gap:10px;margin-top:16px;">
          <button type="button" class="btn-secondary" id="btn-reset-modal-filter" style="flex:1;">Reset</button>
          <button type="button" class="btn-primary" id="btn-apply-modal-filter" style="flex:2;">Show results</button>
        </div>
      `, (box) => {
        box.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { f.sortBy = b.dataset.sort; openFilterModal(); renderAll(); });
        box.querySelectorAll('[data-f-status]').forEach(b => b.onclick = () => { f.status = b.dataset.fStatus; openFilterModal(); renderAll(); });
        box.querySelectorAll('[data-f-rating]').forEach(b => b.onclick = () => { f.minRating = parseFloat(b.dataset.fRating); openFilterModal(); renderAll(); });
        box.querySelectorAll('[data-f-price]').forEach(b => b.onclick = () => {
          const p = parseInt(b.dataset.fPrice, 10);
          const idx = f.prices.indexOf(p);
          if (idx >= 0) f.prices.splice(idx, 1); else f.prices.push(p);
          openFilterModal(); renderAll();
        });
        box.querySelector('#f-only-fav').onchange = (e) => { f.onlyFav = e.target.checked; renderAll(); };
        box.querySelectorAll('[data-f-tag]').forEach(b => b.onclick = () => {
          const t = b.dataset.fTag;
          const idx = f.tags.indexOf(t);
          if (idx >= 0) f.tags.splice(idx, 1); else f.tags.push(t);
          openFilterModal(); renderAll();
        });

        box.querySelectorAll('[data-cf-multi]').forEach(b => b.onclick = () => {
          const id = b.dataset.cfMulti;
          const opt = b.dataset.opt;
          const cur = Array.isArray(f.custom[id]) ? [...f.custom[id]] : [];
          const i = cur.indexOf(opt);
          if (i >= 0) cur.splice(i, 1); else cur.push(opt);
          if (cur.length === 0) delete f.custom[id]; else f.custom[id] = cur;
          openFilterModal(); renderAll();
        });

        box.querySelectorAll('[data-cf-bool]').forEach(b => b.onclick = () => {
          const id = b.dataset.cfBool;
          const val = b.dataset.val;
          if (val === 'all') delete f.custom[id]; else f.custom[id] = val;
          openFilterModal(); renderAll();
        });

        box.querySelectorAll('[data-cf-num]').forEach(inp => inp.oninput = () => {
          const id = inp.dataset.cfNum;
          const bound = inp.dataset.bound;
          f.custom[id] = f.custom[id] || { min: '', max: '' };
          f.custom[id][bound] = inp.value;
          if (!f.custom[id].min && !f.custom[id].max) delete f.custom[id];
          renderAll();
        });

        box.querySelector('#btn-reset-modal-filter').onclick = () => {
          State.filters = { status: 'all', minRating: 0, prices: [], tags: [], onlyFav: false, custom: {}, sortBy: 'newest' };
          openFilterModal();
          renderAll();
        };
        box.querySelector('#btn-apply-modal-filter').onclick = closeModal;
      });
    }
