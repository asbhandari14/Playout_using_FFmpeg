import { Router } from 'express';
import {
  uploadChunkHandler,
  uploadDirectHandler,
  getAssets,
  getAssetById,
  deleteAsset,
  getStorageSummary
} from '../controllers/assetController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadChunk, uploadDirect } from '../middleware/upload.js';

const router = Router();

router.use(authenticate);

// Chunked upload
router.post('/upload/chunk', uploadChunk.single('chunk'), uploadChunkHandler);

// Direct single-file upload
router.post('/upload/direct', uploadDirect.single('file'), uploadDirectHandler);

// Asset CRUD and storage
router.get('/', getAssets);
router.get('/storage/summary', getStorageSummary);
router.get('/:id', getAssetById);
router.delete('/:id', deleteAsset);

export default router;
