import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Configure Multer memory storage (we keeps files in memory to upload them directly to Cloudinary or fallback)
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Configure Cloudinary if credentials are provided
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloudinary_cloud_name' &&
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_KEY !== 'your_cloudinary_api_key' &&
  process.env.CLOUDINARY_API_SECRET && 
  process.env.CLOUDINARY_API_SECRET !== 'your_cloudinary_api_secret';

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('[Cloudinary] Successfully configured.');
} else {
  console.warn('[Cloudinary] Credentials missing or default. Falling back to mockup online placeholders.');
}

/**
 * Uploads a file buffer to Cloudinary or returns a high-quality mockup URL if not configured.
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} originalName - Original filename for logging/seed reference
 * @returns {Promise<string>} The uploaded image secure URL
 */
export const uploadImage = async (fileBuffer, originalName = 'image.png') => {
  if (!isCloudinaryConfigured) {
    // Generate a random high-quality placeholder URL from a set of beautiful product / tech images
    const placeholders = [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80', // watch
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80', // headphones
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80', // shoes
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80', // glasses
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&auto=format&fit=crop&q=80', // shoe mockup
      'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=600&auto=format&fit=crop&q=80', // desk setup
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&auto=format&fit=crop&q=80', // shoes
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80', // retro mic
    ];
    
    // Choose index deterministically based on originalName length, or randomly
    const idx = Math.abs(originalName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % placeholders.length;
    const url = placeholders[idx];
    
    console.log(`[Cloudinary Mock] Uploaded ${originalName} (Simulated). Returned: ${url}`);
    return url;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'mevn-marketplace' },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Upload Error]', error);
          return reject(new Error('Cloudinary upload failed: ' + error.message));
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};
