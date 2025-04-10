'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: Buffer;
  onChange: (image: Buffer) => void;
  className?: string;
  maxSize?: number; // in bytes
  accept?: string;
}

export function ImageUpload({
  value,
  onChange,
  className,
  maxSize = 5 * 1024 * 1024, // 5MB default
  accept = 'image/*',
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error state
    setError(null);

    // Validate file size
    if (file.size > maxSize) {
      setError(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Convert file to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      onChange(buffer);
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Failed to process image');
    }
  };

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange(Buffer.from([]));
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label htmlFor="image-upload" className="sr-only">
            Upload Image
          </Label>
          <Input
            id="image-upload"
            type="file"
            accept={accept}
            onChange={handleFileChange}
            ref={inputRef}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => inputRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {preview ? 'Change Image' : 'Upload Image'}
          </Button>
        </div>
        {preview && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleRemove}
          >
            <XIcon className="w-4 h-4" />
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {preview && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
          <img
            src={preview}
            alt="Preview"
            className="object-contain w-full h-full"
          />
        </div>
      )}
    </div>
  );
} 