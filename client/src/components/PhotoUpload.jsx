import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar } from './common';

export default function PhotoUpload({ name, photoUrl, onUpload, disabled = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(photoUrl || null);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, GIF, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setError('');
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const url = await onUpload(file);
      if (url) setPreview(url);
    } catch (err) {
      setError(err.message);
      setPreview(photoUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview?.startsWith('blob:') || preview?.startsWith('http') || preview?.startsWith('/')
    ? preview
    : photoUrl;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name || 'Profile'}
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
          />
        ) : (
          <Avatar name={name || '?'} size="xl" />
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFile}
        disabled={disabled || uploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading || !onUpload}
        className="btn-secondary text-sm flex items-center gap-2"
      >
        <Camera className="w-4 h-4" />
        {uploading ? 'Uploading...' : 'Upload Profile Photo'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-400 text-center">Saved permanently in database</p>
    </div>
  );
}
