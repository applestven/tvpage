
"use client";
import React, { useState, useEffect, useRef } from 'react';

const extractRealUrl = (input: string): string => {
  // 匹配 http(s):// 后的真实 URL
  const match = input.match(/https?:\/\/(https?:\/\/[^\s]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return input;
};

interface VideoInputProps {
  onInputChange?: (hasInput: boolean, type: 'url' | 'file' | null, value: string | File | null) => void;
}

const VideoInput: React.FC<VideoInputProps> = ({ onInputChange }) => {
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动解析并填充真实 URL
    if (url) {
      const real = extractRealUrl(url);
      if (real !== url) {
        setUrl(real);
        // 选中输入框内容，便于用户确认
        inputRef.current?.select();
      }
    }
  }, [url]);

  // 通知父组件输入状态变化
  useEffect(() => {
    if (url.trim()) {
      onInputChange?.(true, 'url', url);
    } else if (selectedFile) {
      onInputChange?.(true, 'file', selectedFile);
    } else {
      onInputChange?.(false, null, null);
    }
  }, [url, selectedFile, onInputChange]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // 输入URL时清除已选文件
    if (e.target.value.trim()) {
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    // 选择文件时清除URL
    if (file) {
      setUrl("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* <label htmlFor="video-url" className="text-sm font-medium">视频链接</label> */}
      <input
        id="video-url"
        type="text"
        placeholder="输入视频 URL"
        className="input input-bordered w-full text-blue-500"
        value={url}
        ref={inputRef}
        onChange={handleUrlChange}
      />
      <div className="flex items-center my-2">
        <div className="flex-1 h-px bg-blue-200" />
        <span className="mx-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">二选一</span>
        <div className="flex-1 h-px bg-blue-200" />
      </div>
      <input 
        id="video-upload" 
        type="file" 
        accept="video/*" 
        className="file-input w-full text-blue-500" 
        onChange={handleFileChange}
      />
      {selectedFile && (
        <p className="text-xs text-green-600 mt-1">已选择: {selectedFile.name}</p>
      )}
    </div>
  );
};

export default VideoInput;
