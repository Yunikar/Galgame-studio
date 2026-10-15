/**
 * 文件选择按钮（也可以把文件拖进来）
 */
import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Props = {
  /** 允许的文件类型，如 "image/png,image/jpeg" 或 "audio/*" */
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
  title?: string;
};

export default function UploadButton({
  accept,
  multiple,
  onFiles,
  children,
  className = 'btn btn-sm',
  title,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <button
      type="button"
      title={title}
      className={`${className} ${dragging ? 'border-brand-500 bg-brand-50 text-brand-600' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : [files[0]]);
      }}
    >
      <Icon name="upload" className="h-3.5 w-3.5" />
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          // 允许连续选同一个文件
          e.target.value = '';
        }}
      />
    </button>
  );
}
