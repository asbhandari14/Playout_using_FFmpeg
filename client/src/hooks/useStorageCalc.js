import { useMemo, useCallback } from 'react';

export const STORAGE_UNITS = ['MB', 'GB', 'TB'];

const BYTES_IN_MB = 1024 * 1024;
const BYTES_IN_GB = 1024 * 1024 * 1024;
const BYTES_IN_TB = 1024 * 1024 * 1024 * 1024;

/**
 * Converts a given storage amount and unit (MB, GB, TB) into bytes.
 * Returns 0 if amount is empty, 0, or invalid (representing unlimited/unassigned).
 */
export const storageToBytes = (amount, unit = 'GB') => {
  const val = Number(amount);
  if (!val || val <= 0 || isNaN(val)) {
    return 0;
  }

  const cleanUnit = String(unit).trim().toUpperCase();
  switch (cleanUnit) {
    case 'TB':
      return Math.round(val * BYTES_IN_TB);
    case 'MB':
      return Math.round(val * BYTES_IN_MB);
    case 'GB':
    default:
      return Math.round(val * BYTES_IN_GB);
  }
};

/**
 * Converts bytes into appropriate storage amount and unit (MB, GB, or TB).
 */
export const bytesToStorage = (bytes) => {
  const b = Number(bytes);
  if (!b || b <= 0 || isNaN(b)) {
    return { amount: '', unit: 'GB' };
  }

  if (b >= BYTES_IN_TB) {
    const tbVal = b / BYTES_IN_TB;
    return {
      amount: Number(tbVal.toFixed(2)),
      unit: 'TB'
    };
  }

  if (b >= BYTES_IN_GB) {
    const gbVal = b / BYTES_IN_GB;
    return {
      amount: Number(gbVal.toFixed(2)),
      unit: 'GB'
    };
  }

  const mbVal = b / BYTES_IN_MB;
  return {
    amount: Number(mbVal.toFixed(2)),
    unit: 'MB'
  };
};

/**
 * Formats bytes into human-readable string.
 */
export const formatBytes = (bytes, decimals = 2) => {
  const b = Number(bytes);
  if (!b || b <= 0 || isNaN(b)) {
    return `0.00 MB`;
  }

  if (b >= BYTES_IN_TB) {
    return `${(b / BYTES_IN_TB).toFixed(decimals)} TB`;
  }
  if (b >= BYTES_IN_GB) {
    return `${(b / BYTES_IN_GB).toFixed(decimals)} GB`;
  }
  return `${(b / BYTES_IN_MB).toFixed(decimals)} MB`;
};

/**
 * Formats a used / allocated storage comparison string.
 */
export const formatStorageComparison = (usedBytes, allocatedBytes) => {
  const used = Number(usedBytes) || 0;
  const allocated = Number(allocatedBytes) || 0;

  const usedFormatted = formatBytes(used, 2);
  const allocatedFormatted = allocated > 0 ? formatBytes(allocated, 1) : 'Unlimited';

  return `${usedFormatted} / ${allocatedFormatted}`;
};

/**
 * Validates whether an incoming file size (in bytes) fits within the available storage quota.
 */
export const validateUploadStorage = (incomingBytes, storage) => {
  const incoming = Number(incomingBytes) || 0;
  const allocated = Number(storage?.allocatedStorage) || 0;
  const isUnlimited = Boolean(storage?.isUnlimited || allocated === 0);

  if (isUnlimited) {
    return { allowed: true };
  }

  const totalUsed = Number(storage?.totalUsed) || 0;
  const remaining = Math.max(0, allocated - totalUsed);

  if (incoming > remaining) {
    return {
      allowed: false,
      message: `No available storage remaining. File size (${formatBytes(incoming)}) exceeds your available storage (${formatBytes(remaining)} remaining of ${formatBytes(allocated)} allocated).`
    };
  }

  return { allowed: true };
};

/**
 * Hook providing storage unit conversion and formatting calculations.
 */
export default function useStorageCalc() {
  const toBytes = useCallback((amount, unit) => storageToBytes(amount, unit), []);
  const fromBytes = useCallback((bytes) => bytesToStorage(bytes), []);
  const humanize = useCallback((bytes, decimals) => formatBytes(bytes, decimals), []);
  const compare = useCallback(
    (usedBytes, allocatedBytes) => formatStorageComparison(usedBytes, allocatedBytes),
    []
  );
  const validate = useCallback(
    (incomingBytes, storage) => validateUploadStorage(incomingBytes, storage),
    []
  );

  return useMemo(
    () => ({
      storageToBytes: toBytes,
      bytesToStorage: fromBytes,
      formatBytes: humanize,
      formatStorageComparison: compare,
      validateUploadStorage: validate,
      STORAGE_UNITS
    }),
    [toBytes, fromBytes, humanize, compare, validate]
  );
}

