    /* ==========================================================================
       9. PLACE ADD/EDIT FORM (Dynamic CustomFields + Auto-save Draft + Photo Upload)
       ========================================================================== */
import { garbageCollectPhotos } from '../backup.js';
import { DB } from '../db.js';
import { compressImageFile } from '../image.js';
import { renderAll } from '../render.js';
import { State } from '../state.js';
import { bindStarPicker, showToast } from '../ui.js';
import { esc, parseGoogleMapsUrl, toMultiValues, uid, vnNorm } from '../util.js';
import { closeSheet } from './detail.js';
import { openCategoryFieldsEditor } from './fields-editor.js';

    function getAllUsedTags() {
      const s = new Set();
      State.places.forEach(p => (p.tags || []).forEach(t => s.add(t)));
      return Array.from(s);
    }

    export function openPlaceForm(existingPlace = null) {
      const isEdit = Boolean(existingPlace);
      // If adding new and an autosaved draft exists, restore it
      const defaultCat = State.selectedCatId !== 'all' ? State.selectedCatId : (State.categories[0]?.id || 'cat_food');
      const working = existingPlace
        ? JSON.parse(JSON.stringify(existingPlace))
        : (State.settings.draftPlace || {
            id: uid(),
            categoryId: defaultCat,
            name: '',
            status: 'want',
            rating: null,
            review: '',
            address: '',
            mapUrl: '',
            lat: null,
            lng: null,
            hours: '',
            priceLevel: 0,
            tags: [],
            photos: [],
            visitedAt: new Date().toISOString().slice(0, 10),
            favorite: false,
            customValues: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

      const sheet = document.getElementById('overlay-sheet');

      const saveDraftIfNeeded = () => {
        if (!isEdit) {
          State.settings.draftPlace = working;
          DB.put('settings', State.settings);
        }
      };

      const renderForm = () => {
        const sortedCats = [...State.categories].sort((a, b) => a.order - b.order);
        const currentCat = State.categories.find(c => c.id === working.categoryId) || sortedCats[0];
        const allTags = getAllUsedTags();

        sheet.innerHTML = `
          <div class="sheet-header">
            <button class="icon-btn" id="btn-form-cancel" aria-label="Close">✕</button>
            <span class="sheet-title">${isEdit ? 'Edit place' : 'Add place'}</span>
            <button class="icon-btn" id="btn-form-fav" aria-label="Favorite">${working.favorite ? '❤️' : '🤍'}</button>
          </div>
          <div class="sheet-body">
            <div class="form-group">
              <label class="form-label">Place name *</label>
              <input class="form-control" id="f-name" value="${esc(working.name)}" placeholder="e.g. Pho Tu Lun, Katinat...">
              <div id="dup-warning" style="color:var(--danger);font-size:0.82rem;margin-top:4px;display:none;"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-control" id="f-cat">
                ${sortedCats.map(c => `<option value="${esc(c.id)}" ${c.id === working.categoryId ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}
              </select>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="form-group">
              <div>
                <label class="form-label">Status</label>
                <div class="chip-group">
                  <button type="button" class="choice-chip ${working.status === 'want' ? 'selected' : ''}" data-st="want">Want to go</button>
                  <button type="button" class="choice-chip ${working.status === 'visited' ? 'selected' : ''}" data-st="visited">Visited</button>
                </div>
              </div>
              <div>
                <label class="form-label">Price level</label>
                <div class="chip-group">
                  ${[1, 2, 3, 4].map(pl => `<button type="button" class="choice-chip ${working.priceLevel === pl ? 'selected' : ''}" data-pl="${pl}">${'$'.repeat(pl)}</button>`).join('')}
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Rating (0.5 – 5 stars)</label>
              <div id="form-star-mount"></div>
            </div>

            <!-- Dynamic Category Custom Fields -->
            <div style="padding:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="font-weight:600;font-size:0.95rem;">Custom fields: ${esc(currentCat?.name || '')}</span>
                <button type="button" class="btn-secondary" id="btn-jump-edit-fields" style="min-height:32px;padding:0 10px;font-size:0.8rem;">⚙️ Edit fields</button>
              </div>
              <div id="custom-fields-mount"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Photos (auto-compressed ≤ 1600px)</label>
              <label class="btn-secondary" style="display:inline-flex;cursor:pointer;margin-bottom:6px;">
                📷 Choose / take photos
                <input type="file" id="f-photo-input" accept="image/*" multiple style="display:none">
              </label>
              <div class="photo-edit-grid" id="form-photo-grid"></div>
            </div>

            <div class="form-group">
              <label class="form-label">Review / Notes</label>
              <textarea class="form-control" id="f-review" placeholder="Great dishes, atmosphere, parking tips...">${esc(working.review)}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Tags (comma-separated)</label>
              <input class="form-control" id="f-tags" list="tag-suggestions" value="${esc((working.tags || []).join(', '))}" placeholder="banh cuon, breakfast, stay long">
              <datalist id="tag-suggestions">
                ${allTags.map(t => `<option value="${esc(t)}">`).join('')}
              </datalist>
            </div>

            <div class="form-group">
              <label class="form-label">Google Maps link (paste to auto-extract name/coordinates)</label>
              <input class="form-control" id="f-mapurl" value="${esc(working.mapUrl)}" placeholder="https://www.google.com/maps/place/...">
            </div>

            <div class="form-group">
              <label class="form-label">Address</label>
              <input class="form-control" id="f-address" value="${esc(working.address)}" placeholder="Street number, street, district...">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="form-group">
              <div>
                <label class="form-label">Opening hours</label>
                <input class="form-control" id="f-hours" value="${esc(working.hours)}" placeholder="07:00–21:00">
              </div>
              <div>
                <label class="form-label">Last visit date</label>
                <input type="date" class="form-control" id="f-visited" value="${esc(working.visitedAt || '')}">
              </div>
            </div>
          </div>

          <div class="sheet-footer-fixed">
            <button type="button" class="btn-secondary" id="btn-form-discard" style="flex:1;">Cancel</button>
            <button type="button" class="btn-primary" id="btn-form-save" style="flex:2;">Save place</button>
          </div>`;

        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');

        bindStarPicker(document.getElementById('form-star-mount'), working.rating, (val) => {
          working.rating = val;
          saveDraftIfNeeded();
        });

        renderCustomFieldsInputs(currentCat, working, saveDraftIfNeeded);
        renderPhotoEditGrid(working, saveDraftIfNeeded);

        // Bindings
        const nameInput = document.getElementById('f-name');
        const dupWarn = document.getElementById('dup-warning');
        nameInput.oninput = () => {
          working.name = nameInput.value;
          const norm = vnNorm(working.name);
          const dup = norm && State.places.find(p => p.id !== working.id && vnNorm(p.name) === norm);
          if (dup) {
            dupWarn.style.display = 'block';
            dupWarn.textContent = `⚠️ A place with this name already exists: "${dup.name}"`;
          } else {
            dupWarn.style.display = 'none';
          }
          saveDraftIfNeeded();
        };

        // Note: when a place's category changes, we keep the old data in working.customValues so nothing is lost if it is switched back
        document.getElementById('f-cat').onchange = (e) => {
          working.categoryId = e.target.value;
          saveDraftIfNeeded();
          renderForm();
        };

        sheet.querySelectorAll('[data-st]').forEach(btn => {
          btn.onclick = () => {
            working.status = btn.dataset.st;
            saveDraftIfNeeded();
            renderForm();
          };
        });

        sheet.querySelectorAll('[data-pl]').forEach(btn => {
          btn.onclick = () => {
            const p = parseInt(btn.dataset.pl, 10);
            working.priceLevel = working.priceLevel === p ? 0 : p;
            saveDraftIfNeeded();
            renderForm();
          };
        });

        document.getElementById('f-review').oninput = (e) => { working.review = e.target.value; saveDraftIfNeeded(); };
        document.getElementById('f-address').oninput = (e) => { working.address = e.target.value; saveDraftIfNeeded(); };
        document.getElementById('f-hours').oninput = (e) => { working.hours = e.target.value; saveDraftIfNeeded(); };
        document.getElementById('f-visited').oninput = (e) => { working.visitedAt = e.target.value || null; saveDraftIfNeeded(); };
        document.getElementById('f-tags').oninput = (e) => {
          working.tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
          saveDraftIfNeeded();
        };

        document.getElementById('f-mapurl').oninput = (e) => {
          working.mapUrl = e.target.value.trim();
          const parsed = parseGoogleMapsUrl(working.mapUrl);
          if (parsed.lat !== null) { working.lat = parsed.lat; working.lng = parsed.lng; }
          if (parsed.name && !working.name) {
            working.name = parsed.name;
            nameInput.value = parsed.name;
            showToast(`Extracted name: ${parsed.name}`);
          }
          saveDraftIfNeeded();
        };

        document.getElementById('f-photo-input').onchange = async (e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          showToast(`Compressing ${files.length} photos...`, null, null, 2000);
          for (const file of files) {
            try {
              const { fullBlob, thumbBlob } = await compressImageFile(file);
              const blobKey = 'img_' + uid();
              const thumbKey = 'th_' + uid();
              await DB.put('photos', { key: blobKey, blob: fullBlob });
              await DB.put('photos', { key: thumbKey, blob: thumbBlob });
              working.photos.push({ id: uid(), blobKey, thumbKey, caption: '', kind: 'food' });
            } catch (err) {
              showToast('Could not compress photo: ' + err.message);
            }
          }
          saveDraftIfNeeded();
          renderPhotoEditGrid(working, saveDraftIfNeeded);
        };

        document.getElementById('btn-form-fav').onclick = () => {
          working.favorite = !working.favorite;
          saveDraftIfNeeded();
          renderForm();
        };

        document.getElementById('btn-jump-edit-fields').onclick = () => {
          openCategoryFieldsEditor(currentCat.id, () => openPlaceForm(working));
        };

document.getElementById('btn-form-cancel').onclick = closeSheet;
     document.getElementById('btn-form-discard').onclick = async () => {
       if (!isEdit) {
         State.settings.draftPlace = null;
         await DB.put('settings', State.settings);
       }
       await garbageCollectPhotos();
       closeSheet();
     };

     document.getElementById('btn-form-save').onclick = async () => {
       if (!working.name.trim()) {
         showToast('Please enter a place name');
         nameInput.focus();
         return;
       }
       working.name = working.name.trim();
       working.updatedAt = new Date().toISOString();
       const idx = State.places.findIndex(p => p.id === working.id);
       if (idx >= 0) State.places[idx] = working;
       else State.places.push(working);

       await DB.put('places', working);
       if (!isEdit) {
         State.settings.draftPlace = null;
         await DB.put('settings', State.settings);
       }
       await garbageCollectPhotos();
       closeSheet();
       renderAll();
       showToast('Place saved');
     };
   };

   renderForm();
 }

    function renderCustomFieldsInputs(cat, working, onUpdate) {
      const mount = document.getElementById('custom-fields-mount');
      if (!cat || !cat.fields || cat.fields.length === 0) {
        mount.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);">This category has no custom fields yet.</div>`;
        return;
      }
      working.customValues = working.customValues || {};
      mount.innerHTML = '';

      for (const fd of [...cat.fields].sort((a, b) => a.order - b.order)) {
        const wrap = document.createElement('div');
        wrap.className = 'form-group';
        wrap.style.marginBottom = '10px';
        const val = working.customValues[fd.id];

        if (fd.type === 'checkbox') {
          wrap.innerHTML = `
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;min-height:38px;">
              <input type="checkbox" ${val ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent);">
              <span style="font-weight:600;font-size:0.92rem;">${esc(fd.label)}</span>
            </label>`;
          wrap.querySelector('input').onchange = (e) => {
            working.customValues[fd.id] = e.target.checked;
            onUpdate();
          };
        } else if (fd.type === 'select') {
          const single = Array.isArray(val) ? (val[0] ?? '') : val;
          wrap.innerHTML = `<label class="form-label">${esc(fd.label)}</label>
            <div class="chip-group">
              ${(fd.options || []).map(opt => `<button type="button" class="choice-chip ${single === opt ? 'selected' : ''}" data-opt="${esc(opt)}">${esc(opt)}</button>`).join('')}
            </div>`;
          wrap.querySelectorAll('[data-opt]').forEach(btn => {
            btn.onclick = () => {
              const o = btn.dataset.opt;
              working.customValues[fd.id] = single === o ? '' : o;
              onUpdate();
              renderCustomFieldsInputs(cat, working, onUpdate);
            };
          });
        } else if (fd.type === 'multiselect') {
          const arr = toMultiValues(val);
          wrap.innerHTML = `<label class="form-label">${esc(fd.label)}</label>
            <div class="chip-group">
              ${(fd.options || []).map(opt => `<button type="button" class="choice-chip ${arr.includes(opt) ? 'selected' : ''}" data-opt="${esc(opt)}">${esc(opt)}</button>`).join('')}
            </div>`;
          wrap.querySelectorAll('[data-opt]').forEach(btn => {
            btn.onclick = () => {
              const o = btn.dataset.opt;
              const cur = [...toMultiValues(working.customValues[fd.id])];
              const i = cur.indexOf(o);
              if (i >= 0) cur.splice(i, 1);
              else cur.push(o);
              working.customValues[fd.id] = cur;
              onUpdate();
              renderCustomFieldsInputs(cat, working, onUpdate);
            };
          });
        } else if (fd.type === 'rating') {
          wrap.innerHTML = `<label class="form-label">${esc(fd.label)}</label><div class="custom-star-sub"></div>`;
          bindStarPicker(wrap.querySelector('.custom-star-sub'), val || null, (newR) => {
            working.customValues[fd.id] = newR;
            onUpdate();
          });
        } else if (fd.type === 'longtext') {
          wrap.innerHTML = `<label class="form-label">${esc(fd.label)}</label>
            <textarea class="form-control" style="min-height:68px;">${esc(val || '')}</textarea>`;
          wrap.querySelector('textarea').oninput = (e) => {
            working.customValues[fd.id] = e.target.value;
            onUpdate();
          };
        } else {
          const inputType = fd.type === 'number' ? 'number' : fd.type === 'date' ? 'date' : fd.type === 'url' ? 'url' : 'text';
          wrap.innerHTML = `<label class="form-label">${esc(fd.label)}</label>
            <input type="${inputType}" class="form-control" value="${esc(val ?? '')}">`;
          wrap.querySelector('input').oninput = (e) => {
            working.customValues[fd.id] = fd.type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value;
            onUpdate();
          };
        }
        mount.appendChild(wrap);
      }
    }

    function renderPhotoEditGrid(working, onUpdate) {
      const grid = document.getElementById('form-photo-grid');
      if (!grid) return;
      grid.innerHTML = '';
      (working.photos || []).forEach((ph, idx) => {
        const card = document.createElement('div');
        card.className = 'photo-edit-card';
        card.innerHTML = `
          <div class="ph-preview" style="height:110px;background:var(--surface-2);border-radius:6px;overflow:hidden;"></div>
          <select class="form-control" style="min-height:34px;padding:2px 6px;font-size:0.82rem;">
            <option value="menu" ${ph.kind === 'menu' ? 'selected' : ''}>📋 Menu</option>
            <option value="food" ${ph.kind === 'food' ? 'selected' : ''}>🍲 Food</option>
            <option value="place" ${ph.kind === 'place' ? 'selected' : ''}>🏠 Space</option>
            <option value="other" ${ph.kind === 'other' ? 'selected' : ''}>📷 Other</option>
          </select>
          <input class="form-control" style="min-height:34px;padding:2px 6px;font-size:0.82rem;" placeholder="Caption..." value="${esc(ph.caption || '')}">
          <button type="button" class="clear-filters-btn" style="font-size:0.8rem;">Remove photo</button>`;

        DB.getPhotoUrl(ph.thumbKey || ph.blobKey).then(url => {
          if (url) card.querySelector('.ph-preview').innerHTML = `<img src="${url}" alt="">`;
        });

        card.querySelector('select').onchange = (e) => { ph.kind = e.target.value; onUpdate(); };
        card.querySelector('input').oninput = (e) => { ph.caption = e.target.value; onUpdate(); };
        card.querySelector('button').onclick = async () => {
          working.photos.splice(idx, 1);
          onUpdate();
          renderPhotoEditGrid(working, onUpdate);
        };
        grid.appendChild(card);
      });
    }
