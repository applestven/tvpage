import React from 'react';

interface Props { disabled?: boolean; onDownload?: () => void; onCopy?: () => void | Promise<void> }
const ResultActions: React.FC<Props> = ({ disabled, onDownload, onCopy }) => {
  return (
    <div className="flex gap-2 mt-4">
      <button className="btn btn-primary flex-1" disabled={disabled} onClick={onDownload}>下载字幕</button>
      <button className="btn btn-outline flex-1" disabled={disabled} onClick={onCopy}>复制文本</button>
    </div>
  );
};

export default ResultActions;
