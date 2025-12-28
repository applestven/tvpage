import React from 'react';

interface UploadButtonProps {
  disabled?: boolean;
  active?: boolean;
}

const UploadButton: React.FC<UploadButtonProps> = ({ disabled, active }) => {
  return (
    <button 
      className={`w-full py-3 px-6 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 ${
        active 
          ? 'bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-400 hover:to-blue-400 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform hover:-translate-y-0.5' 
          : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
      }`} 
      disabled={disabled || !active}
    >
      {active ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      )}
      开始转写
    </button>
  );
};

export default UploadButton;
