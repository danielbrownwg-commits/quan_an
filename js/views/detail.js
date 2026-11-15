    /* ==========================================================================
       8. DETAIL SHEET & FORM SHEET
       ========================================================================== */
import { DB } from '../db.js';
import { deletePlaceWithUndo, renderAll } from '../render.js';
import { State } from '../state.js';
import { bindStarPicker, showToast } from '../ui.js';
import { esc, toMultiValues } from '../util.js';
import { openPlaceForm } from './form.js';

    export function closeSheet() {
      const sheet = document.getElementById('overlay-sheet');
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
      sheet.innerHTML = '';
    }

    export async function openPlaceDetail(placeId) {
      const place = State.places.find(p => p.id === placeId);
      if (!place) return;
      const cat = State.categories.find(c => c.id === place.categoryId) || { icon: '📍', name: 'Other', fields: [] };
      const sheet = document.getElementById('overlay-sheet');

      // Put 'menu' photos first in the carousel
      const sortedPhotos = [...(place.photos || [])].sort((a, b) => (a.kind === 'menu' ? -1 : b.kind === 'menu' ? 1 : 0));
      const kindLabels = { menu: '📋 Menu', food: '🍲 Food', place: '🏠 Space', other: '📷 Other' };

      // Custom fields Notion table
      let customRows = '';
      for (const fd of (cat.fields || []).sort((a, b) => a.order - b.order)) {
        const val = place.customValues ? place.customValues[fd.id] : undefined;
        if (val === undefined || val === '' || val === null || (Array.isArray(val) && val.length === 0)) continue;
        let renderedVal = esc(val);
        if (fd.type === 'checkbox') renderedVal = val ? '✅ Yes' : 'No';
        else if (fd.type === 'multiselect') renderedVal = toMultiValues(val).map(v => `<span class="tag-chip">${esc(v)}</span>`).join(' ');
        else if (fd.type === 'url') renderedVal = `<a href="${esc(val)}" target="_blank" rel="noopener">${esc(val)}</a>`;
        else if (fd.type === 'rating') renderedVal = `<span class="rating-inline">★ ${esc(val)}</span>`;
        customRows += `<div class="props-row"><div class="props-label">${esc(fd.label)}</div><div class="props-val">${renderedVal}</div></div>`;
      }

      const mapsHref = place.mapUrl || (place.lat && place.lng ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}` : '');

      sheet.innerHTML = `
        <div class="sheet-header">
          <button class="icon-btn" id="btn-detail-back" aria-label="Back">←</button>
          <span class="sheet-title">${esc(place.name)}</span>
          <div style="display:flex;gap:4px;">
            <button class="icon-btn" id="btn-detail-fav" aria-label="Favorite">${place.favorite ? '❤️' : '🤍'}</button>
            <button class="btn-secondary" id="btn-detail-edit" style="min-height:36px;padding:0 12px;">Edit</button>
          </div>
        </div>
        <div class="sheet-body">
          ${sortedPhotos.length > 0 ? `<div class="carousel-wrap" id="detail-carousel"></div>` : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="tag-chip" style="font-size:0.88rem;padding:4px 10px;">${esc(cat.icon)} ${esc(cat.name)}</span>
            <button class="status-badge ${place.status}" id="btn-detail-toggle-status" style="min-height:34px;padding:4px 12px;font-size:0.88rem;">
              ${place.status === 'visited' ? '✓ Visited (tap to change)' : '☆ Want to go (tap to change)'}
            </button>
          </div>

          <h1 style="font-size:1.5rem;margin:4px 0 10px;">${esc(place.name)}</h1>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);">
            <div id="detail-star-mount"></div>
            <div class="price-inline tabular-nums" style="font-size:1.05rem;">${place.priceLevel ? '$'.repeat(place.priceLevel) : 'No price noted'}</div>
          </div>

          ${customRows ? `<div class="props-table">${customRows}</div>` : ''}

          ${place.review ? `<div class="detail-review-box">${esc(place.review)}</div>` : ''}

          ${(place.tags && place.tags.length) ? `<div class="card-tags" style="margin:12px 0;">${place.tags.map(t => `<span class="tag-chip" style="font-size:0.85rem;padding:4px 9px;">#${esc(t)}</span>`).join('')}</div>` : ''}

          <div class="props-table">
            ${place.address ? `
              <div class="props-row">
                <div class="props-label">Address</div>
                <div class="props-val">
                  <div>${esc(place.address)}</div>
                  <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                    <button class="btn-secondary" id="btn-copy-addr" style="min-height:34px;font-size:0.82rem;">Copy</button>
                    ${mapsHref ? `<a href="${esc(mapsHref)}" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;align-items:center;min-height:34px;padding:0 12px;font-size:0.82rem;text-decoration:none;">Open in Maps ↗</a>` : ''}
                  </div>
                </div>
              </div>` : (mapsHref ? `
              <div class="props-row">
                <div class="props-label">Map</div>
                <div class="props-val"><a href="${esc(mapsHref)}" target="_blank" rel="noopener">Open in Google Maps ↗</a></div>
              </div>` : '')}
            ${place.hours ? `<div class="props-row"><div class="props-label">Opening hours</div><div class="props-val">${esc(place.hours)}</div></div>` : ''}
            ${place.visitedAt ? `<div class="props-row"><div class="props-label">Last visited</div><div class="props-val tabular-nums">${esc(place.visitedAt)}</div></div>` : ''}
          </div>

          <div style="margin-top:24px;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;color:var(--text-muted);font-size:0.8rem;">
            <span class="tabular-nums">Updated: ${esc((place.updatedAt || '').slice(0, 10))}</span>
            <button class="clear-filters-btn" id="btn-detail-del">🗑️ Delete place</button>
          </div>
        </div>`;

      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');

      // Mount quick star rating
      bindStarPicker(document.getElementById('detail-star-mount'), place.rating, async (newRating) => {
        place.rating = newRating;
        place.updatedAt = new Date().toISOString();
        await DB.put('places', place);
        renderAll();
      });

      // Load carousel photos
      if (sortedPhotos.length > 0) {
        const car = document.getElementById('detail-carousel');
        for (const ph of sortedPhotos) {
          const item = document.createElement('div');
          item.className = 'carousel-item';
          item.innerHTML = `<span class="photo-badge">${esc(kindLabels[ph.kind] || 'Photo')}</span>
            ${ph.caption ? `<div class="photo-caption-bar">${esc(ph.caption)}</div>` : ''}`;
          car.appendChild(item);
          DB.getPhotoUrl(ph.blobKey).then(url => {
            if (url) {
              const img = document.createElement('img');
              img.src = url;
              img.alt = ph.caption || place.name;
              item.prepend(img);
              item.onclick = () => openLightbox(url, kindLabels[ph.kind], ph.caption);
            }
          });
        }
      }

      document.getElementById('btn-detail-back').onclick = closeSheet;
      document.getElementById('btn-detail-edit').onclick = () => openPlaceForm(place);
      document.getElementById('btn-detail-fav').onclick = async () => {
        place.favorite = !place.favorite;
        place.updatedAt = new Date().toISOString();
        await DB.put('places', place);
        openPlaceDetail(place.id);
        renderAll();
      };
      document.getElementById('btn-detail-toggle-status').onclick = async () => {
        place.status = place.status === 'visited' ? 'want' : 'visited';
        if (place.status === 'visited' && !place.visitedAt) place.visitedAt = new Date().toISOString().slice(0, 10);
        place.updatedAt = new Date().toISOString();
        await DB.put('places', place);
        openPlaceDetail(place.id);
        renderAll();
      };
      const copyBtn = document.getElementById('btn-copy-addr');
      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard?.writeText(place.address);
          showToast('Address copied');
        };
      }
      document.getElementById('btn-detail-del').onclick = () => deletePlaceWithUndo(place);
    }

    function openLightbox(url, badge, caption) {
      document.getElementById('lightbox-img').src = url;
      document.getElementById('lightbox-meta').textContent = badge || '';
      document.getElementById('lightbox-caption').textContent = caption || '';
      document.getElementById('lightbox').classList.add('open');
    }
    document.getElementById('btn-close-lightbox').onclick = () => {
      document.getElementById('lightbox').classList.remove('open');
    };
