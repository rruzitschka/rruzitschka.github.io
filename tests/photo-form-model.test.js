import { describe, it, expect } from 'vitest';
import {
  PHOTO_MAX_DIMENSION,
  PHOTO_JPEG_QUALITY,
  isImageFile,
  fitScale,
  buildPhotoFileName,
  photoStoragePath,
  splitPhotosByTopo,
  buildOverlayPhotoGridHtml,
} from '../app/js/photo-form-model.js';

describe('isImageFile', () => {
  it('accepts image files only', () => {
    expect(isImageFile({ type: 'image/jpeg' })).toBe(true);
    expect(isImageFile({ type: 'image/png' })).toBe(true);
    expect(isImageFile({ type: 'application/pdf' })).toBe(false);
    expect(isImageFile({ type: '' })).toBe(false);
    expect(isImageFile(null)).toBe(false);
    expect(isImageFile(undefined)).toBe(false);
  });
});

describe('fitScale (downscale to PHOTO_MAX_DIMENSION, never upscale)', () => {
  it('returns 1 for images at or below the max dimension', () => {
    expect(fitScale(1000, 800)).toBe(1);
    expect(fitScale(PHOTO_MAX_DIMENSION, PHOTO_MAX_DIMENSION)).toBe(1);
    expect(fitScale(0, 0)).toBe(1);
  });

  it('scales landscape and portrait images to the max edge', () => {
    expect(fitScale(4096, 2048)).toBeCloseTo(PHOTO_MAX_DIMENSION / 4096);
    expect(fitScale(2000, 4000)).toBeCloseTo(PHOTO_MAX_DIMENSION / 4000);
  });
});

describe('buildPhotoFileName (iOS PhotoStorage layout parity)', () => {
  it('is {noteId}_{uuid}.jpg', () => {
    expect(buildPhotoFileName('ABC123', 'uuid-xyz')).toBe('ABC123_uuid-xyz.jpg');
  });

  it('sanitizes unsafe noteId characters and falls back to "photo"', () => {
    expect(buildPhotoFileName('a/b c', 'u')).toBe('abc_u.jpg');
    expect(buildPhotoFileName('', 'u')).toBe('photo_u.jpg');
    expect(buildPhotoFileName(null, 'u')).toBe('photo_u.jpg');
  });

  it('generates a unique .jpg name without an explicit uuid', () => {
    const a = buildPhotoFileName('n');
    const b = buildPhotoFileName('n');
    expect(a).toMatch(/^n_[0-9a-f-]+\.jpg$/);
    expect(a).not.toBe(b);
  });
});

describe('photoStoragePath (iOS FirebasePhotoUploader layout parity)', () => {
  it('is photos/{uid}/{noteId}/{fileName}', () => {
    expect(photoStoragePath('uid1', 'note1', 'x.jpg')).toBe('photos/uid1/note1/x.jpg');
  });
});

describe('splitPhotosByTopo', () => {
  it('splits photos and topos, preserving order in both groups', () => {
    const photos = [
      { id: 'a', isTopo: false },
      { id: 'b', isTopo: true },
      { id: 'c' }, // legacy docs without the flag are route photos
      { id: 'd', isTopo: true },
    ];
    const { routePhotos, topos } = splitPhotosByTopo(photos);
    expect(routePhotos.map((p) => p.id)).toEqual(['a', 'c']);
    expect(topos.map((p) => p.id)).toEqual(['b', 'd']);
  });

  it('handles empty and non-array input', () => {
    expect(splitPhotosByTopo([])).toEqual({ routePhotos: [], topos: [] });
    expect(splitPhotosByTopo(undefined)).toEqual({ routePhotos: [], topos: [] });
  });
});

describe('buildOverlayPhotoGridHtml', () => {
  it('returns empty string without photos', () => {
    expect(buildOverlayPhotoGridHtml([])).toBe('');
    expect(buildOverlayPhotoGridHtml(undefined)).toBe('');
  });

  it('renders one thumb per photo with continuous indexes', () => {
    const html = buildOverlayPhotoGridHtml([
      { id: 'a', storageURL: 'https://x/a.jpg' },
      { id: 'b', previewURL: 'blob:x', pending: true, isTopo: true },
    ]);
    expect(html).toContain('data-photo-index="0"');
    expect(html).toContain('data-photo-index="1"');
    expect(html).toContain('photo-topo-badge');
    expect(html).toContain('ovl-photo-topo-toggle is-topo');
  });

  it('escapes HTML-sensitive URL parts in the img src', () => {
    const html = buildOverlayPhotoGridHtml([{ id: 'a', storageURL: 'https://x/"<b>' }]);
    expect(html).not.toContain('"<b>');
    expect(html).toContain('&quot;&lt;b&gt;');
  });
});

describe('constants (iOS parity)', () => {
  it('matches the iOS JPEG pipeline', () => {
    expect(PHOTO_MAX_DIMENSION).toBe(2048);
    expect(PHOTO_JPEG_QUALITY).toBe(0.85);
  });
});
