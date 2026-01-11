
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
