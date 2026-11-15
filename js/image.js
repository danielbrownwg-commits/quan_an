    /* ==========================================================================
       4. IMAGE COMPRESSION (Canvas 1600px full + 400px thumb)
       ========================================================================== */
    export async function compressImageFile(file) {
      const bitmap = await createImageBitmap(file);
      const makeBlob = async (maxSide, quality) => {
        let { width, height } = bitmap;
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);
        return new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
      };
      const fullBlob = await makeBlob(1600, 0.8);
      const thumbBlob = await makeBlob(400, 0.78);
      if (bitmap.close) bitmap.close();
      return { fullBlob, thumbBlob };
    }

    function blobToBase64(blob) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }

    export async function base64ToBlob(dataUrl) {
      const res = await fetch(dataUrl);
      return await res.blob();
    }
