    /* ==========================================================================
       14. CUSTOM FIELDS EDITOR SHEET (§5.7)
       ========================================================================== */
import { DB } from '../db.js';
import { State } from '../state.js';
import { closeModal, openModal, showToast } from '../ui.js';
import { esc, normalizePlaceCustomValues, uid } from '../util.js';
import { closeSheet } from './detail.js';

    export function openCategoryFieldsEditor(catId, onBack) {
      const cat = State.categories.find(c => c.id === catId);
      if (!cat) return;
      const sheet = document.getElementById('overlay-sheet');

      const render = () => {
        const fields = [...(cat.fields || [])].sort((a, b) => a.order - b.order);
        sheet.innerHTML = `
          <div class="sheet-header">
            <button class="icon-btn" id="btn-cf-back" aria-label="Back">←</button>
            <span class="sheet-title">Fields of ${esc(cat.icon)} ${esc(cat.name)}</span>
            <button class="btn-primary" id="btn-cf-add" style="min-height:36px;padding:0 12px;font-size:0.85rem;">+ Add field</button>
          </div>
          <div class="sheet-body">
            <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0;">Max 12 fields per category; max 2 shown on cards to keep the list tidy.</p>
            ${fields.length === 0 ? `<div class="empty-state">No custom fields yet.</div>` : fields.map((fd, idx) => `
              <div class="stat-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
                <div style="flex:1;">
                  <div style="font-weight:600;">${esc(fd.label)}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);">
                    Type: <strong>${esc(fd.type)}</strong>
                    ${fd.showOnCard ? ' • 📌 Shown on card' : ''}
                    ${fd.filterable ? ' • 🔍 Filterable' : ''}
                  </div>
                </div>
                <div style="display:flex;gap:2px;">
                  <button class="icon-btn" data-fd-up="${idx}" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>↑</button>
                  <button class="icon-btn" data-fd-down="${idx}" ${idx === fields.length - 1 ? 'disabled style="opacity:0.3"' : ''}>↓</button>
                  <button class="icon-btn" data-fd-edit="${esc(fd.id)}">✏️</button>
                  <button class="icon-btn" data-fd-del="${esc(fd.id)}" style="color:var(--danger);">🗑️</button>
                </div>
              </div>`).join('')}
          </div>`;

        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');

        document.getElementById('btn-cf-back').onclick = () => {
          closeSheet();
          if (onBack) onBack();
        };

        document.getElementById('btn-cf-add').onclick = () => {
          if ((cat.fields || []).length >= 12) {
            showToast('Limit of 12 fields per category reached');
            return;
          }
          openFieldDefModal(cat, null, render);
        };

        sheet.querySelectorAll('[data-fd-up]').forEach(b => b.onclick = async () => {
          const i = parseInt(b.dataset.fdUp, 10);
          if (i <= 0) return;
          const tmp = fields[i - 1].order;
          fields[i - 1].order = fields[i].order;
          fields[i].order = tmp;
          await DB.put('categories', cat);
          render();
        });

        sheet.querySelectorAll('[data-fd-down]').forEach(b => b.onclick = async () => {
          const i = parseInt(b.dataset.fdDown, 10);
          if (i >= fields.length - 1) return;
          const tmp = fields[i + 1].order;
          fields[i + 1].order = fields[i].order;
          fields[i].order = tmp;
          await DB.put('categories', cat);
          render();
        });

        sheet.querySelectorAll('[data-fd-edit]').forEach(b => b.onclick = () => {
          const fd = cat.fields.find(x => x.id === b.dataset.fdEdit);
          if (fd) openFieldDefModal(cat, fd, render);
        });

        sheet.querySelectorAll('[data-fd-del]').forEach(b => b.onclick = () => {
          const fd = cat.fields.find(x => x.id === b.dataset.fdDel);
          if (!fd) return;
          const usedPlaces = State.places.filter(p => p.categoryId === cat.id && p.customValues && p.customValues[fd.id] !== undefined && p.customValues[fd.id] !== '');
          openModal(`Delete field "${fd.label}"?`, `
            <p>The data of this field for <strong>${usedPlaces.length} places</strong> will be deleted.</p>
            <button class="btn-danger" id="btn-confirm-del-fd" style="width:100%;">Confirm delete field</button>
          `, () => {
            document.getElementById('btn-confirm-del-fd').onclick = async () => {
              const backupValues = usedPlaces.map(p => ({ pId: p.id, val: p.customValues[fd.id] }));
              cat.fields = cat.fields.filter(x => x.id !== fd.id);
              await DB.put('categories', cat);
              for (const p of usedPlaces) {
                delete p.customValues[fd.id];
                await DB.put('places', p);
              }
              closeModal();
              render();
              showToast(`Deleted field "${fd.label}"`, 'Undo', async () => {
                cat.fields.push(fd);
                await DB.put('categories', cat);
                for (const item of backupValues) {
                  const pl = State.places.find(x => x.id === item.pId);
                  if (pl) {
                    pl.customValues[fd.id] = item.val;
                    await DB.put('places', pl);
                  }
                }
                render();
              });
            };
          });
        });
      };

      render();
    }

    function openFieldDefModal(cat, existingField, onDone) {
      const isEdit = Boolean(existingField);
      const fd = existingField ? JSON.parse(JSON.stringify(existingField)) : {
        id: 'f_' + uid(),
        label: '',
        type: 'text',
        options: [],
        showOnCard: false,
        filterable: false,
        order: (cat.fields || []).length
      };

      const filterableTypes = ['select', 'multiselect', 'checkbox', 'number'];
      const canConvert = (from, to) => {
        if (from === to) return true;
        if ((from === 'text' && to === 'longtext') || (from === 'longtext' && to === 'text')) return true;
        if ((from === 'select' && to === 'multiselect') || (from === 'multiselect' && to === 'select')) return true;
        return false;
      };

      openModal(isEdit ? `Edit field "${existingField.label}"` : 'Add new field', `
        <div class="form-group">
          <label class="form-label">Field name (Label) *</label>
          <input class="form-control" id="fd-label" value="${esc(fd.label)}" placeholder="e.g. Car parking, Signature dish...">
        </div>
        <div class="form-group">
          <label class="form-label">Data type</label>
          <select class="form-control" id="fd-type">
            ${[
              ['text', 'Short text (1 line)'],
              ['longtext', 'Long text (multi-line)'],
              ['number', 'Number'],
              ['select', 'Select one'],
              ['multiselect', 'Multi-select'],
              ['checkbox', 'Yes/No toggle (Checkbox)'],
              ['date', 'Date'],
              ['url', 'URL'],
              ['rating', 'Extra rating (0.5–5)']
            ].map(([k, lbl]) => `<option value="${k}" ${fd.type === k ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="fd-options-wrap" style="display:${['select', 'multiselect'].includes(fd.type) ? 'block' : 'none'};">
          <label class="form-label">Options (comma-separated, max 20)</label>
          <input class="form-control" id="fd-options" value="${esc((fd.options || []).join(', '))}" placeholder="Breakfast, Lunch, Dinner">
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:8px;">
            <input type="checkbox" id="fd-showcard" ${fd.showOnCard ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent);">
            <span>Show on list card (max 2 fields per category)</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;" id="fd-filterable-lbl">
            <input type="checkbox" id="fd-filterable" ${fd.filterable ? 'checked' : ''} ${filterableTypes.includes(fd.type) ? '' : 'disabled'} style="width:20px;height:20px;accent-color:var(--accent);">
            <span>Allow as filter (Select / Checkbox / Number only)</span>
          </label>
        </div>
        <button class="btn-primary" id="fd-save-btn" style="width:100%;">Save field</button>
      `, () => {
        const typeEl = document.getElementById('fd-type');
        const optWrap = document.getElementById('fd-options-wrap');
        const filtCheck = document.getElementById('fd-filterable');

        typeEl.onchange = () => {
          const newT = typeEl.value;
          if (isEdit && !canConvert(existingField.type, newT)) {
            showToast('You can only switch type between text↔longtext or select↔multiselect. Create a new field instead!');
            typeEl.value = fd.type;
            return;
          }
          fd.type = newT;
          optWrap.style.display = ['select', 'multiselect'].includes(newT) ? 'block' : 'none';
          if (!filterableTypes.includes(newT)) {
            filtCheck.checked = false;
            filtCheck.disabled = true;
          } else {
            filtCheck.disabled = false;
          }
        };

        document.getElementById('fd-save-btn').onclick = async () => {
          const label = document.getElementById('fd-label').value.trim();
          if (!label) { showToast('Please enter a field name'); return; }
          fd.label = label;
          fd.showOnCard = document.getElementById('fd-showcard').checked;
          fd.filterable = filtCheck.checked && filterableTypes.includes(fd.type);

          if (['select', 'multiselect'].includes(fd.type)) {
            const opts = document.getElementById('fd-options').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
            if (opts.length === 0) { showToast('Please enter at least 1 option'); return; }
            if (isEdit && existingField.options) {
              const removed = existingField.options.filter(o => !opts.includes(o));
              if (removed.length > 0) {
                const affectedCount = State.places.filter(p => p.categoryId === cat.id && p.customValues && removed.some(r => p.customValues[fd.id] === r || (Array.isArray(p.customValues[fd.id]) && p.customValues[fd.id].includes(r)))).length;
                if (affectedCount > 0) showToast(`Note: ${affectedCount} places use an option you just removed`);
              }
            }
            fd.options = opts;
          }

          cat.fields = cat.fields || [];
          if (isEdit) {
            const idx = cat.fields.findIndex(x => x.id === fd.id);
            if (idx >= 0) cat.fields[idx] = fd;
          } else {
            cat.fields.push(fd);
          }
          await DB.put('categories', cat);
          if (isEdit && existingField.type !== fd.type) {
            for (const p of State.places) {
              if (p.categoryId === cat.id && normalizePlaceCustomValues(p, cat)) {
                await DB.put('places', p);
              }
            }
          }
          closeModal();
          if (onDone) onDone();
        };
      });
    }
