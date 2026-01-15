import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

export interface TaskItem {
  id: string;
  videoSource: string;
  status: 'queueing' | 'downloading' | 'transcoding' | 'uploading' | 'transcribing' | 'completed' | 'error';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  resultUrl?: string;
}

export interface TaskHistoryHandle {
  addTask: (videoSource: string) => string;
  updateTaskStatus: (
    taskId: string,
    status: TaskItem['status'],
    progress?: number,
    resultUrl?: string
  ) => void;
}

const TASK_HISTORY_KEY = 'taskHistory';

const TaskHistory = forwardRef<TaskHistoryHandle>((_, ref) => {
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
  const addTask = (videoSource: string): string => {
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      videoSource,
      status: 'queueing',
      progress: 0,
      createdAt: new Date(),
    };
    
    saveTasks([newTask, ...tasks]);
    return newTask.id;
  };

  // 更新任务状态
  const updateTaskStatus = (
    taskId: string,
    status: TaskItem['status'],
    progress?: number,
    resultUrl?: string
  ) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = {
          ...task,
          status,
          progress: progress !== undefined ? progress : task.progress,
        };
        
        if (status === 'completed' || status === 'error') {
          updatedTask.completedAt = new Date();
        }
        
        if (resultUrl) {
          updatedTask.resultUrl = resultUrl;
        }
        
        return updatedTask;
      }
      return task;
    });
    
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

  // 通过 ref 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    addTask,
    updateTaskStatus
  }));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors relative z-60"
        aria-label="任务历史"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-[70vh] overflow-hidden flex flex-col transform transition-transform duration-100 ease-in-out"
          style={{ top: '100%' }}
        >
          <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold text-lg">任务历史</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-blue-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="p-4 flex justify-between items-center border-b">
            <p className="text-sm text-gray-600">
              共 <span className="font-semibold">{tasks.length}</span> 个任务
            </p>
            {tasks.length > 0 && (
              <button 
                onClick={clearAllTasks}
                className="text-sm text-red-600 hover:text-red-800"
              >
                清空全部
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-grow">
            {tasks.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>暂无任务记录</p>
              </div>
            ) : (
              <div className="divide-y">
                {tasks.map((task) => (
                  <div key={task.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {task.videoSource.length > 30 
                            ? task.videoSource.substring(0, 30) + '...' 
                            : task.videoSource}
                        </p>
                        <div className="mt-1 flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
                          {task.progress > 0 && task.progress < 100 && (
                            <span className="ml-2 text-xs text-gray-500">
                              {task.progress}%
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(task.createdAt)}
                          {task.completedAt && ` - ${formatDate(task.completedAt)}`}
                        </p>
                      </div>
                      <button 
                        onClick={() => removeTask(task.id)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    
                    {task.resultUrl && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <a 
                          href={task.resultUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center"
                        >
                          查看结果
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TaskHistory.displayName = 'TaskHistory';

export default TaskHistory;