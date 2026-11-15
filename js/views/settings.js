    /* ==========================================================================
       13. SETTINGS, CATEGORY & CUSTOM FIELD MANAGEMENT (§5.6, §5.7, §7)
       ========================================================================== */
import { exportBackupJson, exportPlacesCsv } from '../backup.js';
import { DB } from '../db.js';
import { renderAll } from '../render.js';
import { getDemoPlaces, getSeedCategories } from '../seed.js';
import { State } from '../state.js';
import { closeModal, openModal, showToast } from '../ui.js';
import { esc, uid } from '../util.js';
import { openCategoryFieldsEditor } from './fields-editor.js';

    export async function renderSettingsView() {
      const main = document.getElementById('main-view');
      const sortedCats = [...State.categories].sort((a, b) => a.order - b.order);

      let storageText = 'Calculating...';
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
          const quotaMB = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
          storageText = `${usedMB} MB / ${quotaMB} MB`;
        } catch (_) {
          storageText = 'Unknown';
        }
      }

      main.innerHTML = `
        <div class="stat-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3 class="stat-title" style="margin:0;">Manage Categories & Custom Fields</h3>
            <button class="btn-primary" id="btn-add-cat" style="min-height:36px;padding:0 12px;font-size:0.85rem;">+ Add</button>
          </div>
          <p style="font-size:0.84rem;color:var(--text-muted);margin:0 0 12px;">Tap a category to create or edit its custom fields.</p>
          <div id="settings-cat-list">
            ${sortedCats.map((c, idx) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);gap:6px;">
                <div style="flex:1;cursor:pointer;" data-manage-cat="${esc(c.id)}">
                  <div style="font-weight:600;">${esc(c.icon)} ${esc(c.name)}</div>
                  <div style="font-size:0.78rem;color:var(--text-muted);">${(c.fields || []).length} custom fields</div>
                </div>
                <div style="display:flex;gap:2px;">
                  <button class="icon-btn" data-cat-up="${idx}" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} aria-label="Up">↑</button>
                  <button class="icon-btn" data-cat-down="${idx}" ${idx === sortedCats.length - 1 ? 'disabled style="opacity:0.3"' : ''} aria-label="Down">↓</button>
                  <button class="icon-btn" data-cat-edit="${esc(c.id)}" aria-label="Rename">✏️</button>
                  <button class="icon-btn" data-cat-del="${esc(c.id)}" aria-label="Delete" style="color:var(--danger);">🗑️</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="stat-card">
          <h3 class="stat-title">Appearance (Glacier theme)</h3>
          <div class="chip-group">
            ${[['auto', 'Auto (follow device)'], ['light', 'Light'], ['dark', 'Dark']].map(([k, lbl]) => `
              <button class="choice-chip ${(State.settings.theme || 'auto') === k ? 'selected' : ''}" data-theme-opt="${k}">${lbl}</button>`).join('')}
          </div>
        </div>

        <div class="stat-card">
          <h3 class="stat-title">Backup & Restore (Offline)</h3>
          <div class="tabular-nums" style="font-size:0.88rem;color:var(--text-muted);margin-bottom:12px;">
            <div>Storage used: <strong>${esc(storageText)}</strong></div>
            <div>Last backup: <strong>${State.settings.lastBackupAt ? esc(State.settings.lastBackupAt.slice(0, 16).replace('T', ' ')) : 'Never backed up'}</strong></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <button class="btn-primary" id="btn-export-json">⬇️ Export Backup (.json)</button>
            <button class="btn-secondary" id="btn-import-json">⬆️ Import Backup (.json)</button>
          </div>
          <button class="btn-secondary" id="btn-export-csv" style="width:100%;">📊 Export to Excel/Sheets (.csv, no photos)</button>
        </div>

        <div class="stat-card">
          <h3 class="stat-title">Sample Data & Reset</h3>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn-secondary" id="btn-load-demo">✨ Load demo data (quick test)</button>
            <button class="btn-danger" id="btn-wipe-all">⚠️ Delete all data (2-step confirmation)</button>
          </div>
        </div>`;

      main.querySelectorAll('[data-theme-opt]').forEach(b => b.onclick = async () => {
        State.settings.theme = b.dataset.themeOpt;
        await DB.put('settings', State.settings);
        renderAll();
      });

      main.querySelectorAll('[data-manage-cat]').forEach(el => el.onclick = () => {
        openCategoryFieldsEditor(el.dataset.manageCat, () => renderSettingsView());
      });

      main.querySelectorAll('[data-cat-up]').forEach(b => b.onclick = async () => {
        const i = parseInt(b.dataset.catUp, 10);
        if (i <= 0) return;
        const tmp = sortedCats[i - 1].order;
        sortedCats[i - 1].order = sortedCats[i].order;
        sortedCats[i].order = tmp;
        await DB.put('categories', sortedCats[i - 1]);
        await DB.put('categories', sortedCats[i]);
        renderSettingsView();
      });

      main.querySelectorAll('[data-cat-down]').forEach(b => b.onclick = async () => {
        const i = parseInt(b.dataset.catDown, 10);
        if (i >= sortedCats.length - 1) return;
        const tmp = sortedCats[i + 1].order;
        sortedCats[i + 1].order = sortedCats[i].order;
        sortedCats[i].order = tmp;
        await DB.put('categories', sortedCats[i + 1]);
        await DB.put('categories', sortedCats[i]);
        renderSettingsView();
      });

      document.getElementById('btn-add-cat').onclick = () => openCatNameModal(null);
      main.querySelectorAll('[data-cat-edit]').forEach(b => b.onclick = () => {
        const cat = State.categories.find(c => c.id === b.dataset.catEdit);
        if (cat) openCatNameModal(cat);
      });
      main.querySelectorAll('[data-cat-del]').forEach(b => b.onclick = () => {
        const cat = State.categories.find(c => c.id === b.dataset.catDel);
        if (cat) openDeleteCategoryModal(cat);
      });

      document.getElementById('btn-export-json').onclick = exportBackupJson;
      document.getElementById('btn-import-json').onclick = () => document.getElementById('restore-file-input').click();
      document.getElementById('btn-export-csv').onclick = exportPlacesCsv;

      document.getElementById('btn-load-demo').onclick = async () => {
        const demos = getDemoPlaces();
        for (const dp of demos) {
          if (!State.places.some(p => p.id === dp.id)) {
            State.places.push(dp);
            await DB.put('places', dp);
          }
        }
        showToast('Demo data loaded!');
        State.tab = 'places';
        renderAll();
      };

      document.getElementById('btn-wipe-all').onclick = () => {
        openModal('Confirm delete: step 1/2', `
          <p>All <strong>${State.places.length} places</strong> and all photos will be deleted from this device.</p>
          <button class="btn-danger" id="btn-wipe-step2" style="width:100%;">I understand, continue to step 2</button>
        `, () => {
          document.getElementById('btn-wipe-step2').onclick = () => {
            openModal('Final confirmation 2/2', `
              <p>This can't be undone unless you've exported a backup.</p>
              <button class="btn-danger" id="btn-wipe-confirm-final" style="width:100%;">DELETE EVERYTHING PERMANENTLY</button>
            `, () => {
              document.getElementById('btn-wipe-confirm-final').onclick = async () => {
                await DB.clearStore('places');
                await DB.clearStore('photos');
                await DB.clearStore('categories');
                DB.revokeAllUrls();
                State.places = [];
                State.categories = getSeedCategories();
                for (const c of State.categories) await DB.put('categories', c);
                closeModal();
                renderAll();
                showToast('Everything deleted; default categories restored');
              };
            });
          };
        });
      };
    }

    function openCatNameModal(cat = null) {
      const isEdit = Boolean(cat);
      openModal(isEdit ? 'Edit category' : 'Add new category', `
        <div class="form-group">
          <label class="form-label">Icon (emoji)</label>
          <input class="form-control" id="m-cat-icon" value="${esc(cat ? cat.icon : '📍')}" maxlength="4">
        </div>
        <div class="form-group">
          <label class="form-label">Category name</label>
          <input class="form-control" id="m-cat-name" value="${esc(cat ? cat.name : '')}" placeholder="e.g. Bookstores, Homestays...">
        </div>
        <button class="btn-primary" id="m-cat-save" style="width:100%;">Save category</button>
      `, () => {
        document.getElementById('m-cat-save').onclick = async () => {
          const name = document.getElementById('m-cat-name').value.trim();
          const icon = document.getElementById('m-cat-icon').value.trim() || '📍';
          if (!name) { showToast('Please enter a category name'); return; }
          if (isEdit) {
            cat.name = name;
            cat.icon = icon;
            await DB.put('categories', cat);
          } else {
            const newCat = { id: 'cat_' + uid(), name, icon, order: State.categories.length, fields: [] };
            State.categories.push(newCat);
            await DB.put('categories', newCat);
          }
          closeModal();
          renderSettingsView();
        };
      });
    }

    function openDeleteCategoryModal(cat) {
      if (State.categories.length <= 1) {
        showToast('You must keep at least 1 category!');
        return;
      }
      const affected = State.places.filter(p => p.categoryId === cat.id);
      const otherCats = State.categories.filter(c => c.id !== cat.id);

      openModal(`Delete category "${cat.name}"`, `
        <p>There are <strong>${affected.length} places</strong> in this category.</p>
        ${affected.length > 0 ? `
          <div class="form-group">
            <label class="form-label">Move ${affected.length} places to:</label>
            <select class="form-control" id="del-cat-target">
              ${otherCats.map(o => `<option value="${esc(o.id)}">${esc(o.icon)} ${esc(o.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn-primary" id="btn-move-and-del-cat" style="width:100%;margin-bottom:8px;">Move places & Delete category</button>
        ` : ''}
        <button class="btn-danger" id="btn-wipe-cat-places" style="width:100%;">Delete category ${affected.length ? `and delete ${affected.length} places` : ''}</button>
      `, () => {
        const moveBtn = document.getElementById('btn-move-and-del-cat');
        if (moveBtn) {
          moveBtn.onclick = async () => {
            const targetId = document.getElementById('del-cat-target').value;
            for (const p of affected) {
              p.categoryId = targetId;
              await DB.put('places', p);
            }
            State.categories = State.categories.filter(c => c.id !== cat.id);
            await DB.delete('categories', cat.id);
            closeModal();
            renderSettingsView();
            showToast('Places moved and category deleted');
          };
        }
        document.getElementById('btn-wipe-cat-places').onclick = async () => {
          for (const p of affected) {
            await DB.delete('places', p.id);
          }
          State.places = State.places.filter(p => p.categoryId !== cat.id);
          State.categories = State.categories.filter(c => c.id !== cat.id);
          await DB.delete('categories', cat.id);
          closeModal();
          renderSettingsView();
          showToast('Category deleted');
        };
      });
    }
