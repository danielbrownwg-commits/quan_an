    /* ==========================================================================
       16. EVENT LISTENERS, MIGRATION & SERVICE WORKER BOOTSTRAP
       ========================================================================== */
import { garbageCollectPhotos } from './backup.js';
import { DB } from './db.js';
import { renderAll, renderPlacesView } from './render.js';
import { getSeedCategories } from './seed.js';
import { State } from './state.js';
import { registerServiceWorker } from './sw-register.js';
import { SCHEMA_VERSION, esc } from './util.js';
import { openFilterModal } from './views/filter.js';
import { openPlaceForm } from './views/form.js';

    function bindGlobalEvents() {
      document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
          State.tab = btn.dataset.tab;
          renderAll();
        };
      });

      const searchWrap = document.getElementById('search-bar-wrap');
      const searchInput = document.getElementById('search-input');
      document.getElementById('btn-toggle-search').onclick = () => {
        const isOpen = searchWrap.classList.toggle('open');
        if (isOpen) searchInput.focus();
      };
      searchInput.oninput = (e) => {
        State.searchQuery = e.target.value;
        renderPlacesView();
      };
      document.getElementById('btn-clear-search').onclick = () => {
        State.searchQuery = '';
        searchInput.value = '';
        searchWrap.classList.remove('open');
        renderPlacesView();
      };

      document.getElementById('btn-open-filter').onclick = openFilterModal;

      document.getElementById('btn-toggle-cols').onclick = async () => {
        State.settings.gridCols = State.settings.gridCols === 2 ? 1 : 2;
        await DB.put('settings', State.settings);
        renderPlacesView();
      };

      document.getElementById('btn-fab-add').onclick = () => openPlaceForm(null);
    }

    async function bootstrap() {
      bindGlobalEvents();
      registerServiceWorker();

      if (navigator.storage && navigator.storage.persist) {
        try { navigator.storage.persist(); } catch (_) {}
      }

      try {
        await DB.init();
        const savedSettings = await DB.get('settings', 'app_settings');
        if (savedSettings) {
          State.settings = { ...State.settings, ...savedSettings, schemaVersion: SCHEMA_VERSION };
        } else {
          await DB.put('settings', State.settings);
        }

        State.categories = await DB.getAll('categories');
        if (State.categories.length === 0) {
          State.categories = getSeedCategories();
          for (const c of State.categories) await DB.put('categories', c);
        }

        State.places = await DB.getAll('places');
        await garbageCollectPhotos();
        renderAll();
      } catch (err) {
        document.getElementById('main-view').innerHTML = `
          <div class="stat-card" style="border-color:var(--danger);">
            <h3 style="color:var(--danger);margin-top:0;">⚠️ Browser storage unavailable</h3>
            <p>Could not initialize IndexedDB (${esc(err.message)}). Turn off private browsing or check free storage on your device.</p>
          </div>`;
      }
    }

    bootstrap();
