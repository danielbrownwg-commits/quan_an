    /* ==========================================================================
       6. UI HELPERS: TOAST, MODAL, STARS SVG
       ========================================================================== */
import { esc, uid } from './util.js';

    export function showToast(msg, actionLabel = null, onAction = null, duration = 4500) {
      const wrap = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `<span>${esc(msg)}</span>`;
      if (actionLabel && onAction) {
        const btn = document.createElement('button');
        btn.textContent = actionLabel;
        btn.onclick = () => {
          onAction();
          el.remove();
        };
        el.appendChild(btn);
      }
      wrap.appendChild(el);
      if (duration > 0) {
        setTimeout(() => { if (el.parentNode) el.remove(); }, duration);
      }
    }

    export function openModal(title, htmlContent, onMount) {
      document.getElementById('modal-title').textContent = title;
      const box = document.getElementById('modal-content');
      box.innerHTML = htmlContent;
      document.getElementById('modal-backdrop').classList.add('open');
      if (onMount) onMount(box);
    }

    export function closeModal() {
      document.getElementById('modal-backdrop').classList.remove('open');
    }

    document.getElementById('btn-close-modal').onclick = closeModal;
    document.getElementById('modal-backdrop').onclick = (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    };

    // Draw the 5-star strip with half-star support (0.5 step)
    function renderHalfStarPicker(currentVal, inputId) {
      const val = parseFloat(currentVal) || 0;
      let html = `<div class="star-picker" data-star-picker="${esc(inputId)}">`;
      for (let i = 1; i <= 5; i++) {
        let fillType = 'empty';
        if (val >= i) fillType = 'full';
        else if (val >= i - 0.5) fillType = 'half';
        const gradId = `grad_${inputId}_${i}`;
        html += `
          <div class="star-unit" data-star-idx="${i}">
            <div class="star-half-left" data-val="${i - 0.5}"></div>
            <div class="star-half-right" data-val="${i}"></div>
            <svg viewBox="0 0 24 24">
              <defs>
                <linearGradient id="${gradId}">
                  <stop offset="50%" stop-color="var(--star)"/>
                  <stop offset="50%" stop-color="transparent"/>
                </linearGradient>
              </defs>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                stroke="var(--star)" stroke-width="1.8"
                fill="${fillType === 'full' ? 'var(--star)' : fillType === 'half' ? `url(#${gradId})` : 'none'}" />
            </svg>
          </div>`;
      }
      html += `
        <button type="button" class="btn-secondary" data-clear-star="1" style="min-height:30px;padding:0 8px;font-size:0.8rem;margin-left:6px;">Clear</button>
        <span class="tabular-nums" style="margin-left:6px;font-weight:600;color:var(--star);" data-star-label>${val > 0 ? val : 'Unrated'}</span>
      </div>`;
      return html;
    }

    export function bindStarPicker(container, initialVal, onChange) {
      let current = initialVal;
      const rerender = () => {
        container.innerHTML = renderHalfStarPicker(current, uid());
        container.querySelectorAll('[data-val]').forEach(half => {
          half.onclick = () => {
            current = parseFloat(half.dataset.val);
            onChange(current);
            rerender();
          };
        });
        const clearBtn = container.querySelector('[data-clear-star]');
        if (clearBtn) {
          clearBtn.onclick = () => {
            current = null;
            onChange(null);
            rerender();
          };
        }
      };
      rerender();
    }
