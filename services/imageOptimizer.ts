
/**
 * Enterprise-grade Image Optimization Service
 * resizing and compression to ensure fast loading and low bandwidth usage.
 */

export const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.match(/image.*/)) {
      reject(new Error("File is not an image"));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // High Quality but Web Optimized Resolution
        const MAX_WIDTH = 1200; 
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        // Maintain Aspect Ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Browser does not support canvas"));
            return;
        }

        // Smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.75 quality (Good balance for jewelry details)
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(optimizedDataUrl);
      };
      img.onerror = (err) => reject(new Error("Failed to load image"));
    };
    reader.onerror = (err) => reject(new Error("Failed to read file"));
  });
};

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) || '';

/**
 * Uploads an image to the physical server storage in /uploads/... folder
 * and returns the relative path URL (e.g. /uploads/ordered/img_xxx.jpg or /uploads/ready/img_xxx.jpg).
 */
export const uploadOrderImage = async (file: File, folder: 'ordered' | 'ready' | 'catalog' | 'estimates' | 'customers' | 'general' = 'ordered'): Promise<string> => {
  const compressedBase64 = await compressImage(file);
  try {
    const res = await fetch(`${API_BASE}/api/sync/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: compressedBase64, folder })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return data.url;
      }
    }
  } catch (e) {
    console.warn("[Upload] Direct image upload to server failed, using local base64 fallback", e);
  }
  return compressedBase64;
};

