    /* ==========================================================================
       5. APPLICATION STATE & FILTER LOGIC
       ========================================================================== */
import { SCHEMA_VERSION, toMultiValues, vnNorm } from './util.js';

    export const State = {
      tab: 'places',          // 'places' | 'stats' | 'random' | 'settings'
      categories: [],
      places: [],
      settings: {
        key: 'app_settings',
        schemaVersion: SCHEMA_VERSION,
        theme: 'auto',
        lastBackupAt: null,
        gridCols: 1,
        draftPlace: null
      },
      selectedCatId: 'all',
      searchQuery: '',
      filters: {
        status: 'all',        // 'all' | 'visited' | 'want'
        minRating: 0,         // 0 | 3 | 4 | 4.5 | -1 (unrated)
        prices: [],           // [1,2,3,4]
        tags: [],
        onlyFav: false,
        custom: {},           // { [fieldId]: value }
        sortBy: 'newest'      // 'newest' | 'rating' | 'name' | 'visited'
      },
      randomPick: null,
      randomOpts: { catId: 'all', onlyWant: true, maxPrice: 0 },
      statsCustomFieldId: ''
    };

    export function resetCustomFilters() {
      State.filters.custom = {};
    }

    export function hasActiveFilters() {
      const f = State.filters;
      return (
        f.status !== 'all' ||
        f.minRating !== 0 ||
        f.prices.length > 0 ||
        f.tags.length > 0 ||
        f.onlyFav ||
        Object.keys(f.custom).length > 0
      );
    }

    export function getFilteredPlaces() {
      const q = vnNorm(State.searchQuery);
      const f = State.filters;
      const catMap = new Map(State.categories.map(c => [c.id, c]));

      let list = State.places.filter(p => {
        if (State.selectedCatId !== 'all' && p.categoryId !== State.selectedCatId) return false;
        if (f.status !== 'all' && p.status !== f.status) return false;
        if (f.onlyFav && !p.favorite) return false;

        if (f.minRating === -1) {
          if (p.rating !== null) return false;
        } else if (f.minRating > 0) {
          if ((p.rating || 0) < f.minRating) return false;
        }

        if (f.prices.length > 0 && !f.prices.includes(p.priceLevel)) return false;
        if (f.tags.length > 0 && !f.tags.every(t => (p.tags || []).includes(t))) return false;

        // Filter by CustomField (only when a specific category is selected)
        if (State.selectedCatId !== 'all') {
          const cat = catMap.get(p.categoryId);
          if (cat) {
            for (const [fId, fVal] of Object.entries(f.custom)) {
              const fieldDef = cat.fields.find(fd => fd.id === fId);
              if (!fieldDef) continue;
              const pVal = p.customValues ? p.customValues[fId] : undefined;
              if (fieldDef.type === 'select' && Array.isArray(fVal) && fVal.length > 0) {
                const singleVal = Array.isArray(pVal) ? pVal[0] : pVal;
                if (!fVal.includes(singleVal)) return false;
              } else if (fieldDef.type === 'multiselect' && Array.isArray(fVal) && fVal.length > 0) {
                const arrVal = toMultiValues(pVal);
                if (arrVal.length === 0 || !fVal.some(v => arrVal.includes(v))) return false;
              } else if (fieldDef.type === 'checkbox' && fVal !== 'all') {
                const boolVal = Boolean(pVal);
                if (fVal === 'yes' && !boolVal) return false;
                if (fVal === 'no' && boolVal) return false;
              } else if (fieldDef.type === 'number' && fVal) {
                const num = parseFloat(pVal);
                if (fVal.min !== '' && (isNaN(num) || num < parseFloat(fVal.min))) return false;
                if (fVal.max !== '' && (isNaN(num) || num > parseFloat(fVal.max))) return false;
              }
            }
          }
        }

        // Diacritic-free text search on name + review + address + tags + custom text/longtext/url
        if (q) {
          const cat = catMap.get(p.categoryId);
          let customText = '';
          if (cat && p.customValues) {
            for (const fd of cat.fields) {
              if (['text', 'longtext', 'url'].includes(fd.type) && p.customValues[fd.id]) {
                customText += ' ' + p.customValues[fd.id];
              }
            }
          }
          const haystack = vnNorm(`${p.name} ${p.review} ${p.address} ${(p.tags || []).join(' ')} ${customText}`);
          if (!haystack.includes(q)) return false;
        }
        return true;
      });

      // Sorting (favorites pinned first within the same group, otherwise standard sort)
      list.sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        if (f.sortBy === 'rating') return (b.rating || -1) - (a.rating || -1);
        if (f.sortBy === 'name') return a.name.localeCompare(b.name, 'vi');
        if (f.sortBy === 'visited') return (b.visitedAt || '').localeCompare(a.visitedAt || '');
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      return list;
    }
