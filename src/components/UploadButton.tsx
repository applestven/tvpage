import React from 'react';

const UploadButton: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  return (
    <button className="btn btn-primary w-full" disabled={disabled}>
      上传视频
    </button>
  );
};

export default UploadButton;
