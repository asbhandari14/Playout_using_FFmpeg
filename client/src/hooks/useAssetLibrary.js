import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import {
  uploadAssetChunked,
  deleteAsset,
  fetchStorageSummary,
  setSelectedAsset,
  setCategoryFilter,
  setSearchQuery
} from '../store/slices/assetSlice.js';
import { formatBytes, validateUploadStorage } from './useStorageCalc.js';

const STORAGE_POLL_INTERVAL_MS = 5000; // Poll storage summary every 5 seconds
const CATEGORIES = ['All categories', 'Promos', 'General', 'Episodes', 'Songs', 'Ads'];

export default function useAssetLibrary(channelId) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const {
    list: assets,
    storage,
    selectedAsset,
    categoryFilter,
    searchQuery,
    loading
  } = useSelector((state) => state.assets);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('Promos');
  const [isUploading, setIsUploading] = useState(false);

  // 1. Storage Polling & Socket.IO Real-Time Listener
  useEffect(() => {
    if (!channelId) return;

    // Initial fetch
    dispatch(fetchStorageSummary(channelId));

    // Polling interval
    const intervalId = setInterval(() => {
      dispatch(fetchStorageSummary(channelId));
    }, STORAGE_POLL_INTERVAL_MS);

    // Socket.IO for immediate event-driven refresh
    const socket = io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000
    });

    socket.on('channel_storage_updated', (data) => {
      if (!data?.channelId || String(data.channelId) === String(channelId)) {
        dispatch(fetchStorageSummary(channelId));
      }
    });

    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [channelId, dispatch]);

  // 2. Storage Counter Display Calculation
  const storageDisplay = useMemo(() => {
    const totalUsedBytes = Number(storage?.totalUsed) || 0;
    const allocatedBytes = Number(storage?.allocatedStorage) || 0;
    const isUnlimited = Boolean(storage?.isUnlimited || allocatedBytes === 0);

    const usedFormatted =
      storage?.totalUsedFormatted ||
      (totalUsedBytes > 0
        ? formatBytes(totalUsedBytes, 2)
        : `${storage?.totalUsedGB || '0.00'} GB`);

    const totalFormatted = isUnlimited
      ? 'Unlimited'
      : storage?.quotaFormatted ||
        (allocatedBytes > 0
          ? formatBytes(allocatedBytes, 1)
          : `${storage?.quotaGB || '10.0'} GB`);

    const filesCount = storage?.totalCount !== undefined ? storage.totalCount : assets.length;

    return {
      used: usedFormatted,
      total: totalFormatted,
      filesCount
    };
  }, [storage, assets.length]);

  // Format assets to eliminate calculations from components
  const formattedAssets = useMemo(() => {
    return assets.map((asset) => ({
      ...asset,
      sizeFormatted: formatBytes(asset.size, 1)
    }));
  }, [assets]);

  // 3. File Selection handler
  const handleFilesSelected = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newUploads = files.map((file) => ({
      file,
      id: Math.random().toString(36).substring(2),
      name: file.name,
      size: formatBytes(file.size, 1),
      progress: 0,
      status: 'queued'
    }));

    setUploadFiles((prev) => [...prev, ...newUploads]);
    setIsUploadModalOpen(true);
  }, []);

  // 4. Chunked Upload handler
  const handleStartUpload = useCallback(async () => {
    if (uploadFiles.length === 0 || isUploading) return;
    setIsUploading(true);

    for (let i = 0; i < uploadFiles.length; i++) {
      const item = uploadFiles[i];
      if (item.status === 'completed') continue;

      // Validate storage quota before chunked upload
      const validation = validateUploadStorage(item.file?.size, storage);
      if (!validation.allowed) {
        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'failed', error: validation.message } : f
          )
        );
        alert(validation.message);
        continue;
      }

      setUploadFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f))
      );

      try {
        await dispatch(
          uploadAssetChunked({
            channelId,
            category: uploadCategory,
            file: item.file,
            onProgress: (percent) => {
              setUploadFiles((prev) =>
                prev.map((f, idx) => (idx === i ? { ...f, progress: percent } : f))
              );
            }
          })
        ).unwrap();

        setUploadFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, progress: 100, status: 'completed' } : f))
        );
      } catch (err) {
        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'failed', error: err || 'Upload failed' } : f
          )
        );
      }
    }

    setIsUploading(false);
    // Refresh storage immediately after upload completes
    if (channelId) {
      dispatch(fetchStorageSummary(channelId));
    }
  }, [uploadFiles, isUploading, channelId, uploadCategory, storage, dispatch]);

  // 5. Delete handlers
  const handleDelete = useCallback((e, asset) => {
    e.stopPropagation();
    setAssetToDelete(asset);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (assetToDelete?._id) {
      await dispatch(deleteAsset(assetToDelete._id));
      if (channelId) {
        dispatch(fetchStorageSummary(channelId));
      }
    }
    setAssetToDelete(null);
  }, [assetToDelete, channelId, dispatch]);

  const handleCancelDelete = useCallback(() => {
    setAssetToDelete(null);
  }, []);

  // 6. Drag & drop handler
  const handleDragStart = useCallback((e, asset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // 7. Search & filter handlers
  const handleSearchChange = useCallback(
    (val) => {
      dispatch(setSearchQuery(val));
    },
    [dispatch]
  );

  const handleCategoryChange = useCallback(
    (cat) => {
      dispatch(setCategoryFilter(cat));
    },
    [dispatch]
  );

  const handleSelectAsset = useCallback(
    (asset) => {
      dispatch(setSelectedAsset(asset));
    },
    [dispatch]
  );

  const handleCloseUploadModal = useCallback(() => {
    if (!isUploading) {
      setIsUploadModalOpen(false);
      setUploadFiles([]);
    }
  }, [isUploading]);

  return {
    // Redux state
    assets: formattedAssets,
    storage,
    selectedAsset,
    categoryFilter,
    searchQuery,
    loading,

    // Formatted storage
    storageDisplay,

    // Upload state & refs
    fileInputRef,
    isUploadModalOpen,
    uploadFiles,
    uploadCategory,
    setUploadCategory,
    isUploading,

    // Delete state
    assetToDelete,

    // Categories
    categories: CATEGORIES,

    // Actions
    handleFilesSelected,
    handleStartUpload,
    handleDelete,
    handleConfirmDelete,
    handleCancelDelete,
    handleDragStart,
    handleSearchChange,
    handleCategoryChange,
    handleSelectAsset,
    handleCloseUploadModal
  };
}
