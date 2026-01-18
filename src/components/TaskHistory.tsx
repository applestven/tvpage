import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

export interface TaskItem {
  id: string;
  ttsId?: string; // 远端任务ID
  sourceType?: 'url' | 'file';
  videoSource: string;
  status: 'queueing' | 'downloading' | 'transcoding' | 'uploading' | 'transcribing' | 'completed' | 'error';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  resultUrl?: string;
}

export interface TaskHistoryHandle {
  addTask: (videoSource: string, sourceType?: 'url' | 'file', id?: string) => string;
  updateTaskStatus: (
    taskId: string,
    status: TaskItem['status'],
    progress?: number,
    resultUrl?: string
  ) => void;
  setTaskTtsId: (taskId: string, ttsId: string) => void;
}

interface TaskHistoryProps {
  onRetry?: (task: TaskItem) => void;
}

const TASK_HISTORY_KEY = 'taskHistory';

const TaskHistory = forwardRef<TaskHistoryHandle, TaskHistoryProps>(({ onRetry }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 从本地存储加载任务历史
  useEffect(() => {
    const storedTasks = localStorage.getItem(TASK_HISTORY_KEY);
    if (storedTasks) {
      try {
        const parsedTasks = JSON.parse(storedTasks).map((task: any) => ({
          ...task,
          id: task.id,
          ttsId: task.ttsId,
          sourceType: task.sourceType,
          videoSource: task.videoSource,
          status: task.status,
          progress: task.progress,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          resultUrl: task.resultUrl,
        }));
        setTasks(parsedTasks);
      } catch (e) {
        console.error('Failed to parse task history:', e);
      }
    }
  }, []);

  // 处理点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 保存任务历史到本地存储
  const saveTasks = (updatedTasks: TaskItem[]) => {
    // 序列化日期对象为字符串
    const serializableTasks = updatedTasks.map(task => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
    }));
    localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(serializableTasks));
    setTasks(updatedTasks);
  };

  // 添加新任务
  const addTask = (videoSource: string, sourceType?: 'url' | 'file', id?: string): string => {
    const newTask: TaskItem = {
      id: id || `task-${Date.now()}`,
      sourceType,
      videoSource,
      status: 'queueing',
      progress: 0,
      createdAt: new Date(),
    };

    // 读取最新 localStorage，避免闭包中的旧 tasks
    let latest: TaskItem[] = [];
    const stored = localStorage.getItem(TASK_HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        latest = parsed.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        }));
      } catch {
        latest = tasks;
      }
    } else {
      latest = tasks;
    }

    const updated = [newTask, ...latest];
    // 写入 storage
  const serializable = updated.map(t => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt ? t.completedAt.toISOString() : undefined,
    }));
    localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(serializable));
    // 更新内存状态
    setTasks(updated);

    return newTask.id;
  };

  // 更新任务状态
  const updateTaskStatus = (
    taskId: string,
    status: TaskItem['status'],
    progress?: number,
    resultUrl?: string
  ) => {
    // 读取最新，避免并发覆盖
    let latest: TaskItem[] = tasks;
    const stored = localStorage.getItem(TASK_HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        latest = parsed.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        }));
      } catch {/* ignore */}
    }

    const updatedTasks = latest.map(task => {
      if (task.id === taskId) {
        const updatedTask: TaskItem = {
          ...task,
          status,
          progress: progress !== undefined ? progress : task.progress,
        } as TaskItem;
        if (status === 'completed' || status === 'error') {
          updatedTask.completedAt = new Date();
        }
        if (resultUrl) updatedTask.resultUrl = resultUrl;
        return updatedTask;
      }
      return task as TaskItem;
    });

    saveTasks(updatedTasks);
  };

  // 记录 ttsId
  const setTaskTtsId = (taskId: string, ttsId: string) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ttsId } : t);
    saveTasks(updatedTasks);
  };

  // 删除任务
  const removeTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    // 序列化日期对象为字符串
    const serializableTasks = updatedTasks.map(task => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : undefined,
    }));
    localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(serializableTasks));
    setTasks(updatedTasks);
  };

  // 清空所有任务
  const clearAllTasks = () => {
    localStorage.removeItem(TASK_HISTORY_KEY);
    setTasks([]);
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取状态文本
  const getStatusText = (status: TaskItem['status']) => {
    switch (status) {
      case 'queueing': return '排队中';
      case 'downloading': return '下载中';
      case 'transcoding': return '转码中';
      case 'uploading': return '上传中';
      case 'transcribing': return '转录中';
      case 'completed': return '已完成';
      case 'error': return '错误';
      default: return status;
    }
  };

  // 状态图标（仅图标显示，颜色与状态一致）
  const StatusIcon: React.FC<{ status: TaskItem['status'] }> = ({ status }) => {
    const color = getStatusColor(status);
    const label = getStatusText(status);
    const base = 'inline-flex items-center justify-center w-6 h-6 rounded-full';
    const iconClass = `${base} ${color}`;
    if (status === 'completed') {
      return (
        <span className={iconClass} title={label} aria-label={label}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879A1 1 0 106.293 10.293l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className={iconClass} title={label} aria-label={label}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.293 7.293a1 1 0 011.414 0L10 7.586l.293-.293a1 1 0 111.414 1.414L11.414 9l.293.293a1 1 0 11-1.414 1.414L10 10.414l-.293.293a1 1 0 11-1.414-1.414L8.586 9l-.293-.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }
    if (status === 'queueing') {
      return (
        <span className={iconClass} title={label} aria-label={label}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6a1 1 0 011 1v2.382l1.447.724a1 1 0 01-.894 1.788l-2-1A1 1 0 019 10V7a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </span>
      );
    }
    // 进行中统一用旋转指示
    return (
      <span className={iconClass} title={label} aria-label={label}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 animate-spin">
          <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25"></circle>
          <path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75"></path>
        </svg>
      </span>
    );
  };

  // 获取状态颜色
  const getStatusColor = (status: TaskItem['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'queueing': return 'text-yellow-600 bg-yellow-50';
      case 'downloading':
      case 'transcoding':
      case 'uploading':
      case 'transcribing':
        return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 弹窗开启时，拉取未完成任务的详情刷新
  useEffect(() => {
    if (!isOpen) return;
    let aborted = false;
    const refresh = async () => {
      const list = [...tasks];
      let changed = false;
      await Promise.all(list.map(async (task, idx) => {
        const realId = task.ttsId || task.id;
        if (!realId) return;
        if (task.status === 'completed' || task.status === 'error') return;
        try {
          const res = await fetch(`/api/tv/tts/${realId}`);
          if (!res.ok) return;
          const data = await res.json();
          if (aborted) return;
          // 映射状态
          let nextStatus: TaskItem['status'] = task.status;
          if (data.status === 'pending') nextStatus = 'queueing';
          else if (data.status === 'running') nextStatus = 'transcribing';
          else if (data.status === 'success') nextStatus = 'completed';
          else if (data.status === 'failed') nextStatus = 'error';

          const updated: TaskItem = { ...list[idx] };
          updated.status = nextStatus;
          if (typeof data.progress === 'number') {
            updated.progress = Math.max(0, Math.min(100, Math.round(data.progress)));
          }
          if (data.output_name) {
            updated.resultUrl = `/api/tv/static/${data.output_name}`;
          }
          if ((nextStatus === 'completed' || nextStatus === 'error') && !updated.completedAt) {
            updated.completedAt = new Date();
          }
          list[idx] = updated;
          changed = true;
        } catch (e) {
          // 忽略
        }
      }));
      if (!aborted && changed) saveTasks(list);
    };
    refresh();
    return () => { aborted = true; };
  }, [isOpen, tasks]);

  // 通过 ref 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addTask,
    updateTaskStatus,
    setTaskTtsId
  }));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
        aria-label="任务历史"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />

          {/* 居中弹窗 */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              {/* 头部 */}
              <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
                <h3 className="font-bold text-lg">任务历史</h3>
                <div className="flex items-center gap-3">
                  {tasks.length > 0 && (
                    <button onClick={clearAllTasks} className="text-white/90 hover:text-white text-sm">清空全部</button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="text-white hover:text-blue-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 内容区：表格 */}
              <div className="p-4">
                {tasks.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">暂无任务记录</div>
                ) : (
                  <div className="overflow-auto max-h-[70vh]">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-700">
                          <th className="px-3 py-2">来源</th>
                          <th className="px-3 py-2">状态</th>
                          <th className="px-3 py-2">进度</th>
                          <th className="px-3 py-2">操作</th>
                        </tr>
                      </thead>
                      <tbody className="align-top">
                        {tasks.map((task) => {
                          const statusText = getStatusText(task.status);
                          const statusColor = getStatusColor(task.status);
                          const isCompleted = task.status === 'completed';
                          const isFailed = task.status === 'error';
                          return (
                            <tr key={task.id} className="border-t">
                              <td className="px-3 py-2 max-w-xs">
                                <div className="truncate" title={task.videoSource}>{task.videoSource}</div>
                                {task.id && (
                                  <div className="mt-1 text-[11px] text-gray-400">ID: {task.id}</div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <StatusIcon status={task.status} />
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {task.progress > 0 && task.progress < 100 ? `${task.progress}%` : isCompleted ? '100%' : '-'}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {/* 下载字幕 */}
                                  <button
                                    className={`p-1.5 rounded border ${isCompleted ? 'border-blue-300 text-blue-700 hover:bg-blue-50' : 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60'}`}
                                    disabled={!isCompleted}
                                    title="下载字幕"
                                    aria-label="下载字幕"
                                    onClick={() => {
                                      if (!isCompleted || !task.resultUrl) return;
                                      window.open(task.resultUrl, '_blank');
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                      <path d="M3 14a1 1 0 011-1h2v2H4a1 1 0 01-1-1zM7 13h6v2H7v-2zM15 13h1a1 1 0 010 2h-1v-2z" />
                                      <path d="M10 3a1 1 0 011 1v6.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3A1 1 0 016.707 9.293L8 10.586V4a1 1 0 011-1z" />
                                    </svg>
                                  </button>
                                  {/* 复制文本 */}
                                  <button
                                    className={`p-1.5 rounded border ${isCompleted ? 'border-blue-300 text-blue-700 hover:bg-blue-50' : 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60'}`}
                                    disabled={!isCompleted}
                                    title="复制文本"
                                    aria-label="复制文本"
                                    onClick={async () => {
                                      if (!isCompleted || !task.resultUrl) return;
                                      try {
                                        const fileName = task.resultUrl.split('/').pop() || '';
                                        const base = task.resultUrl.replace(/\/static\/[^/]+$/, '');
                                        const res = await fetch(`${base}/tts/srt-to-txt?file=${encodeURIComponent(fileName)}`);
                                        if (!res.ok) throw new Error('srt to txt failed');
                                        const txt = await res.text();
                                        if (navigator.clipboard?.writeText) {
                                          await navigator.clipboard.writeText(txt);
                                        }
                                      } catch (e) {
                                        console.error(e);
                                      }
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                      <path d="M6 4a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V4z" />
                                      <path d="M4 6a2 2 0 012-2v10a4 4 0 004 4H6a2 2 0 01-2-2V6z" />
                                    </svg>
                                  </button>
                                  {/* 重试 */}
                                  <button
                                    className={`p-1.5 rounded border ${isFailed ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-gray-200 text-gray-400 cursor-not-allowed opacity-60'}`}
                                    disabled={!isFailed}
                                    title="重试"
                                    aria-label="重试"
                                    onClick={() => {
                                      if (isFailed) {
                                        if (onRetry) onRetry(task);
                                        else updateTaskStatus(task.id, 'queueing', 0);
                                      }
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                      <path d="M2 10a8 8 0 1113.657 5.657 1 1 0 11-1.414-1.414A6 6 0 1010 4v2a1 1 0 11-2 0V3a1 1 0 011-1h3a1 1 0 110 2h-1.1A8.001 8.001 0 012 10z" />
                                    </svg>
                                  </button>
                                  {/* 删除 */}
                                  <button
                                    className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                    title="删除"
                                    aria-label="删除"
                                    onClick={() => removeTask(task.id)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                      <path fillRule="evenodd" d="M6 8a1 1 0 112 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 112 0v6a1 1 0 11-2 0V8zm-2-5a2 2 0 00-2 2H5a1 1 0 000 2h10a1 1 0 100-2h-1a2 2 0 00-2-2H8zM6 18a2 2 0 01-2-2V7h12v9a2 2 0 01-2 2H6z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

TaskHistory.displayName = 'TaskHistory';

export default TaskHistory;