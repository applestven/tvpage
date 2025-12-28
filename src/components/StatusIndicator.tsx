import React from 'react';

export type StatusType = 'queueing' | 'downloading' | 'transcoding' | 'transcribing' | 'completed' | 'error';

const statusMap: Record<StatusType, { color: string; text: string }> = {
  queueing: { color: 'bg-blue-200 text-blue-800', text: '正在排队中' },
  downloading: { color: 'bg-blue-100 text-blue-700', text: '正在下载视频' },
  transcoding: { color: 'bg-blue-100 text-blue-700', text: '正在转码音频' },
  transcribing: { color: 'bg-blue-100 text-blue-700', text: '正在转译' },
  completed: { color: 'bg-green-100 text-green-700', text: '已完成' },
  error: { color: 'bg-red-100 text-red-700', text: '出错了' },
};

const StatusIndicator: React.FC<{ status: StatusType; queue?: number; percent?: number }> = ({ status, queue, percent }) => {
  let display = statusMap[status].text;
  if (status === 'queueing' && typeof queue === 'number') {
    display += `，前面还有 ${queue} 个任务`;
  }
  if (status === 'transcribing' && typeof percent === 'number') {
    display += `（已完成 ${percent}%）`;
  }
  return (
    <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow ${statusMap[status].color} z-50`}>{display}</div>
  );
};

export default StatusIndicator;
