    /* ==========================================================================
       1. UTILITIES & VIETNAMESE NORMALIZATION
       ========================================================================== */
    export const SCHEMA_VERSION = 1;
    export const DB_NAME = 'places_glacier_db';
    export const DB_VERSION = 1;

    export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

    // Normalize: case-insensitive and strip Vietnamese diacritics
    export function vnNorm(str) {
      if (!str) return '';
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim();
    }

    // Strict XSS escaping before rendering
    export function esc(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Highlight text matching the diacritic-free keyword
    export function highlightMatch(text, rawQuery) {
      if (!text) return '';
      const q = vnNorm(rawQuery);
      if (!q) return esc(text);
      const chars = Array.from(String(text));
      const normChars = chars.map(c => vnNorm(c));
      const normJoined = normChars.join('');
      const idx = normJoined.indexOf(q);
      if (idx === -1) return esc(text);
      const before = chars.slice(0, idx).join('');
      const match = chars.slice(idx, idx + q.length).join('');
      const after = chars.slice(idx + q.length).join('');
      return `${esc(before)}<mark class="hl">${esc(match)}</mark>${esc(after)}`;
    }

    // Parse name & coordinates from a Google Maps URL (offline regex)
    export function parseGoogleMapsUrl(url) {
      if (!url) return { lat: null, lng: null, name: '' };
      let lat = null, lng = null, name = '';
      const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      const dMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      const coord = dMatch || atMatch || qMatch;
      if (coord) {
        lat = parseFloat(coord[1]);
        lng = parseFloat(coord[2]);
      }
      const placeMatch = url.match(/\/place\/([^/@?]+)/);
      if (placeMatch && placeMatch[1]) {
        try {
          name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        } catch (_) {}
      }
      return { lat, lng, name };
    }

    /** Coerce a custom field value (single string or array) into an array for multiselect fields. */
    export function toMultiValues(val) {
      if (Array.isArray(val)) return val.filter(v => v !== undefined && v !== null && v !== '');
      return (val !== undefined && val !== null && val !== '') ? [val] : [];
    }

    /** Normalize place.customValues types (string <-> array) to match the category's field definitions. */
    export function normalizePlaceCustomValues(place, cat) {
      if (!place || !place.customValues || !cat || !Array.isArray(cat.fields)) return false;
      let changed = false;
      for (const fd of cat.fields) {
        if (!(fd.id in place.customValues)) continue;
        const val = place.customValues[fd.id];
        if (fd.type === 'multiselect' && typeof val === 'string') {
          place.customValues[fd.id] = val ? [val] : [];
          changed = true;
        } else if (fd.type === 'select' && Array.isArray(val)) {
          place.customValues[fd.id] = val[0] ?? '';
          changed = true;
        }
      }
      return changed;
    }
