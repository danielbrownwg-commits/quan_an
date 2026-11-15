/* ==========================================================================
       15. BACKUP / RESTORE (.ZIP STORE-ONLY, GARBAGE COLLECTOR & .CSV EXPORT) (§7)
       ========================================================================== */
import { DB } from './db.js';
import { base64ToBlob } from './image.js';
import { renderAll } from './render.js';
import { State } from './state.js';
import { closeModal, openModal, showToast } from './ui.js';
import { SCHEMA_VERSION, normalizePlaceCustomValues } from './util.js';

    const CRC32_TABLE = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c >>> 0;
      }
      return t;
    })();

    function calcCrc32(u8) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < u8.length; i++) {
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ u8[i]) & 0xFF];
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // Scan and permanently delete every orphaned photo Blob that no longer belongs to any place
    export async function garbageCollectPhotos() {
      try {
        const activeKeys = new Set();
        for (const p of State.places) {
          for (const ph of (p.photos || [])) {
            if (ph.blobKey) activeKeys.add(ph.blobKey);
            if (ph.thumbKey) activeKeys.add(ph.thumbKey);
          }
        }
        if (State.settings.draftPlace && Array.isArray(State.settings.draftPlace.photos)) {
          for (const ph of State.settings.draftPlace.photos) {
            if (ph.blobKey) activeKeys.add(ph.blobKey);
            if (ph.thumbKey) activeKeys.add(ph.thumbKey);
          }
        }

        const allStoredPhotos = await DB.getAll('photos');
        let removedCount = 0;
        for (const item of allStoredPhotos) {
          if (!activeKeys.has(item.key)) {
            await DB.delete('photos', item.key);
            DB.revokePhotoUrl(item.key);
            removedCount++;
          }
        }
        return removedCount;
      } catch (_) {
        return 0;
      }
    }

    // Pack a list of [{ name: string, blob: Blob }] into one .zip Blob (Method 0 - Store)
    async function buildStoreZipBlob(entries) {
      const enc = new TextEncoder();
      const fileChunks = [];
      const centralDirChunks = [];
      let offset = 0;

      for (const entry of entries) {
        const nameBytes = enc.encode(entry.name);
        const buf = await entry.blob.arrayBuffer();
        const u8 = new Uint8Array(buf);
        const crc = calcCrc32(u8);
        const size = u8.byteLength;

        const lfh = new ArrayBuffer(30 + nameBytes.length);
        const lfv = new DataView(lfh);
        lfv.setUint32(0, 0x04034b50, true);
        lfv.setUint16(4, 20, true);
        lfv.setUint16(6, 0x0800, true);
        lfv.setUint16(8, 0, true);
        lfv.setUint16(10, 0, true);
        lfv.setUint16(12, 0x21, true);
        lfv.setUint32(14, crc, true);
        lfv.setUint32(18, size, true);
        lfv.setUint32(22, size, true);
        lfv.setUint16(26, nameBytes.length, true);
        lfv.setUint16(28, 0, true);
        new Uint8Array(lfh, 30).set(nameBytes);

        const cdfh = new ArrayBuffer(46 + nameBytes.length);
        const cdv = new DataView(cdfh);
        cdv.setUint32(0, 0x02014b50, true);
        cdv.setUint16(4, 20, true);
        cdv.setUint16(6, 20, true);
        cdv.setUint16(8, 0x0800, true);
        cdv.setUint16(10, 0, true);
        cdv.setUint16(12, 0, true);
        cdv.setUint16(14, 0x21, true);
        cdv.setUint32(16, crc, true);
        cdv.setUint32(20, size, true);
        cdv.setUint32(24, size, true);
        cdv.setUint16(28, nameBytes.length, true);
        cdv.setUint16(30, 0, true);
        cdv.setUint16(32, 0, true);
        cdv.setUint16(34, 0, true);
        cdv.setUint16(36, 0, true);
        cdv.setUint32(38, 0, true);
        cdv.setUint32(42, offset, true);
        new Uint8Array(cdfh, 46).set(nameBytes);

        fileChunks.push(lfh, entry.blob);
        centralDirChunks.push(cdfh);
        offset += lfh.byteLength + size;
      }

      const cdSize = centralDirChunks.reduce((acc, c) => acc + c.byteLength, 0);
      const eocd = new ArrayBuffer(22);
      const eocdv = new DataView(eocd);
      eocdv.setUint32(0, 0x06054b50, true);
      eocdv.setUint16(4, 0, true);
      eocdv.setUint16(6, 0, true);
      eocdv.setUint16(8, entries.length, true);
      eocdv.setUint16(10, entries.length, true);
      eocdv.setUint32(12, cdSize, true);
      eocdv.setUint32(16, offset, true);
      eocdv.setUint16(20, 0, true);

      return new Blob([...fileChunks, ...centralDirChunks, eocd], { type: 'application/zip' });
    }

    // Read a .zip file (Store-only) and split it into Map<filename, Blob>
    async function parseStoreZipBlob(zipBlob) {
      const dec = new TextDecoder();
      const headBuf = await zipBlob.slice(0, 4).arrayBuffer();
      if (new DataView(headBuf).getUint32(0, true) !== 0x04034b50) {
        throw new Error('Not a valid ZIP file');
      }

      const tailLen = Math.min(zipBlob.size, 65557);
      const tailOffset = zipBlob.size - tailLen;
      const tailBuf = await zipBlob.slice(tailOffset, zipBlob.size).arrayBuffer();
      const tv = new DataView(tailBuf);

      let eocdPos = -1;
      for (let i = tailLen - 22; i >= 0; i--) {
        if (tv.getUint32(i, true) === 0x06054b50) {
          eocdPos = i;
          break;
        }
      }
      if (eocdPos === -1) throw new Error('ZIP directory structure (EOCD) not found');

      const totalEntries = tv.getUint16(eocdPos + 10, true);
      const cdSize = tv.getUint32(eocdPos + 12, true);
      const cdOffset = tv.getUint32(eocdPos + 16, true);

      const cdBuf = await zipBlob.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
      const cdv = new DataView(cdBuf);
      const cdU8 = new Uint8Array(cdBuf);

      const files = new Map();
      let ptr = 0;
      for (let i = 0; i < totalEntries; i++) {
        if (cdv.getUint32(ptr, true) !== 0x02014b50) break;
        const method = cdv.getUint16(ptr + 10, true);
        const compSize = cdv.getUint32(ptr + 20, true);
        const nameLen = cdv.getUint16(ptr + 28, true);
        const extraLen = cdv.getUint16(ptr + 30, true);
        const commentLen = cdv.getUint16(ptr + 32, true);
        const localHeaderOffset = cdv.getUint32(ptr + 42, true);

        const name = dec.decode(cdU8.subarray(ptr + 46, ptr + 46 + nameLen));
        ptr += 46 + nameLen + extraLen + commentLen;

        if (method !== 0) {
          throw new Error(`File "${name}" uses compression method ${method}; only ZIP Store-only archives from this app are supported.`);
        }

        const lfhBuf = await zipBlob.slice(localHeaderOffset, localHeaderOffset + 30).arrayBuffer();
        const lfhv = new DataView(lfhBuf);
        const lNameLen = lfhv.getUint16(26, true);
        const lExtraLen = lfhv.getUint16(28, true);
        const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;

        const mime = name.endsWith('.json') ? 'application/json' : 'image/jpeg';
        files.set(name, zipBlob.slice(dataStart, dataStart + compSize, mime));
      }
      return files;
    }

    export async function exportBackupJson() {
      await garbageCollectPhotos();
      showToast('Packing ZIP (metadata + photos)...', null, null, 2500);
      try {
        const photosRaw = await DB.getAll('photos');
        const nowIso = new Date().toISOString();
        State.settings.lastBackupAt = nowIso;
        await DB.put('settings', State.settings);

        const payload = {
          schemaVersion: SCHEMA_VERSION,
          exportedAt: nowIso,
          categories: State.categories,
          places: State.places,
          settings: State.settings,
          photoKeys: photosRaw.map(p => p.key)
        };

        const entries = [
          { name: 'data.json', blob: new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }) }
        ];

        for (const item of photosRaw) {
          if (item.key && item.blob) {
            entries.push({ name: `photos/${item.key}.jpg`, blob: item.blob });
          }
        }

        const zipBlob = await buildStoreZipBlob(entries);
        const ymd = nowIso.slice(0, 10).replace(/-/g, '');
        const fileName = `places-backup-${ymd}.zip`;

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);

        renderAll();
        showToast(`Exported ${fileName} (${photosRaw.length} photo files)`);
      } catch (err) {
        showToast('Backup packing error: ' + err.message);
      }
    }

    document.getElementById('restore-file-input').onchange = async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        let data = null;
        let zipPhotoMap = new Map();

        if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
          const files = await parseStoreZipBlob(file);
          const dataBlob = files.get('data.json');
          if (!dataBlob) throw new Error('data.json not found inside the ZIP!');
          data = JSON.parse(await dataBlob.text());
          for (const [path, blob] of files.entries()) {
            if (path.startsWith('photos/') && path.endsWith('.jpg')) {
              const key = path.slice('photos/'.length, -4);
              zipPhotoMap.set(key, blob);
            }
          }
        } else {
          data = JSON.parse(await file.text());
        }

        if (!data || !Array.isArray(data.categories) || !Array.isArray(data.places)) {
          showToast('File is not a valid Places Backup!');
          return;
        }

        const totalPhotos = zipPhotoMap.size || (data.photos ? data.photos.length : 0);

        openModal('Restore Data (Import)', `
          <p>Backup contains: <strong>${data.categories.length} categories</strong>, <strong>${data.places.length} places</strong>, <strong>${totalPhotos} photo files</strong>.</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
            <button class="btn-primary" id="btn-imp-merge">🔄 Merge (by ID, keep existing data)</button>
            <button class="btn-danger" id="btn-imp-replace">⚠️ Replace everything (delete old data)</button>
          </div>
        `, () => {
          document.getElementById('btn-imp-merge').onclick = () => executeImport(data, zipPhotoMap, 'merge');
          document.getElementById('btn-imp-replace').onclick = () => executeImport(data, zipPhotoMap, 'replace');
        });
      } catch (err) {
        showToast('Error reading backup file: ' + err.message);
      }
    };

    async function executeImport(data, zipPhotoMap, mode) {
      closeModal();
      showToast('Restoring data...', null, null, 2000);

      if (mode === 'replace') {
        await DB.clearStore('categories');
        await DB.clearStore('places');
        await DB.clearStore('photos');
        DB.revokeAllUrls();
        State.categories = [];
        State.places = [];
      }

      const catMap = new Map(State.categories.map(c => [c.id, c]));
      for (const incCat of data.categories) {
        if (catMap.has(incCat.id) && mode === 'merge') {
          const curCat = catMap.get(incCat.id);
          const fMap = new Map((curCat.fields || []).map(f => [f.id, f]));
          for (const nf of (incCat.fields || [])) fMap.set(nf.id, nf);
          curCat.fields = Array.from(fMap.values());
          await DB.put('categories', curCat);
        } else {
          catMap.set(incCat.id, incCat);
          await DB.put('categories', incCat);
        }
      }
      State.categories = Array.from(catMap.values());

      const catById = new Map(State.categories.map(c => [c.id, c]));
      const placeMap = new Map(State.places.map(p => [p.id, p]));
      for (const incPlace of data.places) {
        normalizePlaceCustomValues(incPlace, catById.get(incPlace.categoryId));
        placeMap.set(incPlace.id, incPlace);
        await DB.put('places', incPlace);
      }
      State.places = Array.from(placeMap.values());

      let photoCount = 0;
      if (zipPhotoMap && zipPhotoMap.size > 0) {
        for (const [key, blob] of zipPhotoMap.entries()) {
          await DB.put('photos', { key, blob });
          photoCount++;
        }
      } else if (Array.isArray(data.photos)) {
        for (const ph of data.photos) {
          if (ph.key && ph.dataUrl) {
            const blob = await base64ToBlob(ph.dataUrl);
            await DB.put('photos', { key: ph.key, blob });
            photoCount++;
          }
        }
      }

      await garbageCollectPhotos();
      renderAll();
      showToast(`Done: ${State.categories.length} categories, ${State.places.length} places, ${photoCount} photos`);
    }

    // Export CSV including each category's custom field columns
    export function exportPlacesCsv() {
      const sortedCats = [...State.categories].sort((a, b) => a.order - b.order);
      const catMap = new Map(sortedCats.map(c => [c.id, c]));

      const dynamicFields = [];
      for (const c of sortedCats) {
        const fields = [...(c.fields || [])].sort((a, b) => a.order - b.order);
        for (const fd of fields) {
          dynamicFields.push({
            catId: c.id,
            fieldId: fd.id,
            type: fd.type,
            headerName: `[${c.name}] ${fd.label}`
          });
        }
      }

      const baseHeaders = [
        'ID', 'Category', 'Name', 'Status', 'Favorite', 'Rating', 'Price',
        'Address', 'Maps link', 'Coordinates (Lat,Lng)', 'Opening hours', 'Tags',
        'Review', 'Last visited', 'Created', 'Updated'
      ];
      const headers = [...baseHeaders, ...dynamicFields.map(df => df.headerName)];
      const rows = [headers];

      for (const p of State.places) {
        const cat = catMap.get(p.categoryId);
        const coords = (p.lat !== null && p.lng !== null) ? `${p.lat}, ${p.lng}` : '';
        const baseRow = [
          p.id,
          cat ? cat.name : '',
          p.name || '',
          p.status === 'visited' ? 'Visited' : 'Want to go',
          p.favorite ? 'Yes' : 'No',
          p.rating ?? '',
          p.priceLevel ? '$'.repeat(p.priceLevel) : '',
          p.address || '',
          p.mapUrl || '',
          coords,
          p.hours || '',
          (p.tags || []).join('; '),
          (p.review || '').replace(/\r?\n/g, ' '),
          p.visitedAt || '',
          (p.createdAt || '').slice(0, 10),
          (p.updatedAt || '').slice(0, 10)
        ];

        const customRow = dynamicFields.map(df => {
          if (p.categoryId !== df.catId || !p.customValues) return '';
          const val = p.customValues[df.fieldId];
          if (val === undefined || val === null || val === '') return '';
          if (df.type === 'checkbox') return val ? 'Yes' : 'No';
          if (Array.isArray(val)) return val.join('; ');
          return String(val).replace(/\r?\n/g, ' ');
        });

        rows.push([...baseRow, ...customRow]);
      }

      const csvContent = '\uFEFF' + rows
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `places-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
