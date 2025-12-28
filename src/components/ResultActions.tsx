import React from 'react';

const ResultActions: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  return (
    <div className="flex gap-2 mt-4">
      <button className="btn btn-primary flex-1" disabled={disabled}>下载字幕</button>
      <button className="btn btn-outline flex-1" disabled={disabled}>复制文本</button>
    </div>
  );
};

export default ResultActions;
