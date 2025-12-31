"use client";

import VideoInput from "../components/VideoInput";
import UploadButton from "../components/UploadButton";
import LanguageSelector from "../components/LanguageSelector";
import StatusIndicator, { StatusType } from "../components/StatusIndicator";
import TranscriptStream, { TranscriptSegment } from "../components/TranscriptStream";
import ResultActions from "../components/ResultActions";
import React, { useState, useCallback, useRef, useEffect } from "react";

// 根据部署架构：浏览器 -> Next.js（公网） -> tv/dv（ZeroTier 内网）
// 前端应通过 Next.js 的 API 路径访问内网服务，由 Next.js 在服务器端代理到真实内网地址。
// 这样浏览器只访问同域的 /api 路径，避免直接暴露内网地址。
const DV_API = '/api/dv';
const TV_API = '/api/tv';

export default function Home() {
  const stoppedRef = useRef(false);
  const printedRef = useRef<Set<string>>(new Set());
  // 状态占位
  const [status, setStatus] = useState<StatusType>("queueing");
  const [queue, setQueue] = useState<number>(0);
  const [percent, setPercent] = useState<number>(0);
  const [resultReady, setResultReady] = useState<boolean>(false);

  // 视频输入状态
  const [hasVideoInput, setHasVideoInput] = useState<boolean>(false);
  const inputRef = useRef<{ type: 'url' | 'file' | null; value: string | File | null }>({ type: null, value: null });

  // 转写流与结果
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [outputName, setOutputName] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      // cleanup SSE on unmount
      if (sseRef.current) {
        sseRef.current.close();
      }

      stoppedRef.current = true;
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  const handleInputChange = useCallback((hasInput: boolean, type: 'url' | 'file' | null, value: string | File | null) => {
    setHasVideoInput(hasInput);
    inputRef.current = { type, value };
    // 重置之前的任务状态
    setResultReady(false);
    setSegments([]);
    setOutputName(null);
  }, []);

  // 将秒数数值格式化为 mm:ss 或 hh:mm:ss
  const fmt = (sNum: number) => {
    const s = Math.floor(sNum);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  // 轮询 DV 下载任务详情
  const pollDvTask = async (taskId: string) => {
    while (true) {
      try {
        const res = await fetch(`${DV_API}/task/${taskId}`);
        if (!res.ok) throw new Error('dv task fetch failed');
        const data = await res.json();
        // data.status: pending, running, success, failed
        if (data.status === 'pending' || data.status === 'running') {
          setStatus('downloading');
          // 如果返回了正在执行的数量或其它可用字段，可以解析更新
        }
        if (data.status === 'success') {
          // 返回的 fullPath 指向下载服务器可访问的文件
          return data;
        }
        if (data.status === 'failed') {
          throw new Error(data.error || 'download failed');
        }
      } catch (err) {
        console.error(err);
        setStatus('error');
        throw err;
      }
      // 等待 2s 再轮询
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  // 查询 TTS 任务详情
  const fetchTaskDetail = async (ttsId: string) => {
    try {
      const detailRes = await fetch(`${TV_API}/tts/${ttsId}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        if (detailData.output_name) {
          setOutputName(detailData.output_name);
          setResultReady(true);
        }
      }
    } catch (err) {
      console.error('获取任务详情失败:', err);
    }
  };

  const connectSSE = (ttsId: string) => {
  // 先终止旧连接
  stoppedRef.current = false;

  if (sseRef.current) {
    sseRef.current.close();
    sseRef.current = null;
  }

  // SSE 也通过 Next.js 路径代理到内网服务
  const es = new EventSource(`${TV_API}/tts/sse?id=${encodeURIComponent(ttsId)}`);
  sseRef.current = es;

  setStatus('transcribing');

  es.onmessage = (e) => {
    if (stoppedRef.current) return;

    let data: any;
    try {
      data = JSON.parse(e.data);
    } catch {
      return;
    }

    /** ===============================
     * 1️⃣ Whisper CLI 纯输出（logs）
     * =============================== */
    if (Array.isArray(data.logs)) {
      const newSegs: TranscriptSegment[] = [];

      for (const line of data.logs) {
        if (printedRef.current.has(line)) continue;
        printedRef.current.add(line);

        const m = line.match(/\[\s*([\d.]+)s\s*->\s*([\d.]+)s\s*\]\s*(.+)/);
        if (!m) continue;

        newSegs.push({
          start: fmt(parseFloat(m[1])),
          end: fmt(parseFloat(m[2])),
          text: m[3].trim(),
        });
      }

      if (newSegs.length) {
        setSegments(prev => [...prev, ...newSegs]);
      }
    }

    /** ===============================
     * 2️⃣ 停止 / 结束规则（与 CLI 一致）
     * =============================== */
    if (data.status === 'success') {
      stoppedRef.current = true;
      setStatus('completed');

      es.close();
      sseRef.current = null;

      // SSE 停止后查询任务详情获取 output_name
      fetchTaskDetail(ttsId);
      return;
    }

    if (data.status === 'failed') {
      stoppedRef.current = true;
      console.error('transcribe failed:', data.error);
      setStatus('error');

      es.close();
      sseRef.current = null;
      return;
    }
  };

  es.onerror = (err) => {
    if (stoppedRef.current) return;
    console.error('SSE error', err);
    // 和 CLI 一样：不立即 close，等 success / failed
  };
};


  // 通用重试函数
  const withRetry = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`第 ${attempt}/${maxRetries} 次尝试失败:`, lastError.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  };

  const startTask = async () => {
    // 中断上一次 SSE（等价 Ctrl+C）
    stoppedRef.current = true;
    printedRef.current.clear();

    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const current = inputRef.current;
    if (!current.type) return;
    setStatus('queueing');

    if (current.type === 'url' && typeof current.value === 'string') {
      // 先调用下载服务
      try {
        setStatus('downloading');
        
        // 提交下载任务（带重试）
        const dvTaskId = await withRetry(async () => {
          const body = { url: current.value, quality: 'audio_worst' };
          const res = await fetch(`${DV_API}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) throw new Error('submit download failed');
          const rjson = await res.json();
          const taskId = rjson.taskId || rjson.id || rjson.data?.id;
          if (!taskId) throw new Error('download task id missing');
          return taskId;
        });

        const dvResult = await pollDvTask(dvTaskId);
        // dvResult.fullPath 指向可访问的音频文件
        // 注意：dvResult 返回的路径应为 Next.js 能代理访问的地址或者外部可访问地址。
        const audioUrl = dvResult.fullPath || dvResult.output || dvResult.location;
        if (!audioUrl) throw new Error('download result missing file url');

        // 创建转写任务（带重试）
        setStatus('transcoding');
        const ttsId = await withRetry(async () => {
          const tRes = await fetch(`${TV_API}/tts/task`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: audioUrl, quality: 'small', languageArray: 'auto' }) });
          if (!tRes.ok) throw new Error('create tts task failed');
          let tjson: any = {};
          try { tjson = await tRes.json(); } catch (e) { /* ignore */ }
          const id = tjson.id || tjson.taskId || tRes.headers.get('Location')?.split('/').pop();
          if (!id) throw new Error('tts id not found');
          return id;
        });

        // 订阅 SSE
        if (ttsId) connectSSE(ttsId);

      } catch (err) {
        console.error('任务失败（已重试3次）:', err);
        setStatus('error');
      }
    }

    if (current.type === 'file' && current.value instanceof File) {
      // 上传文件到 TTS 上传接口
      try {
        setStatus('transcoding');
        
        // 上传文件（带重试）
        const ttsId = await withRetry(async () => {
          const fm = new FormData();
          fm.append('file', current.value as File);
          fm.append('quality', 'small');
          fm.append('languageArray', 'auto');
          const upl = await fetch(`${TV_API}/tts/upload`, { method: 'POST', body: fm });
          if (!upl.ok) throw new Error('upload failed');
          let ujson: any = {};
          try { ujson = await upl.json(); } catch (e) { /* ignore */ }
          const id = ujson.id || ujson.taskId || upl.headers.get('Location')?.split('/').pop();
          if (!id) throw new Error('tts id not found');
          return id;
        });

        if (ttsId) connectSSE(ttsId);
      } catch (err) {
        console.error('任务失败（已重试3次）:', err);
        setStatus('error');
      }
    }
  };

  const handleDownloadSubtitle = () => {
    if (!outputName) return;
    // 拼接下载地址（按 docs） 注意本地开发需要加端口
    // 通过 Next.js 代理静态文件，遵循部署架构：浏览器 -> Next.js -> tv
    const url = `${TV_API}/static/${outputName}`;
    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    if (!outputName) return;
    try {
      const res = await fetch(`${TV_API}/tts/srt-to-txt?file=${encodeURIComponent(outputName)}`);
      if (!res.ok) throw new Error('srt to txt failed');
      const txt = await res.text();
      
      // 优先使用现代 API，兼容移动端
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
      } else {
        // 降级方案：创建临时 textarea
        const textarea = document.createElement('textarea');
        textarea.value = txt;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      // 简短提示
      alert('已复制到剪切板');
    } catch (err) {
      console.error(err);
      alert('复制失败');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <header className="w-full py-6 px-4 border-b bg-white shadow-sm flex items-center justify-center">
        <span className="text-xl font-bold tracking-tight text-blue-900">Video To Text</span>
      </header>

      {/* 主体内容 */}

      <main className="flex-1 flex flex-col md:flex-row w-full max-w-5xl mx-auto gap-8 py-8 px-4">
        {/* 左侧输入区（卡片分块+主色背景） */}
        <section className="md:w-1/2 w-full flex flex-col gap-6">
          <div className="rounded-2xl shadow-lg bg-white border border-blue-400 p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">1. 视频输入</h2>
              <p className="text-xs text-blue-700 mb-2">粘贴视频链接或上传本地视频（二选一）</p>
              <VideoInput onInputChange={handleInputChange} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">2. 语言选择</h2>
              <p className="text-xs text-blue-700 mb-2">请选择视频语音的语言</p>
              <LanguageSelector />
            </div>
            <div>
              <UploadButton disabled={false} active={hasVideoInput} onClick={startTask} />
            </div>
          </div>
        </section>

        {/* 右侧输出区（卡片分块） */}
        <section className="md:w-1/2 w-full flex flex-col gap-6">
          <div className="rounded-2xl shadow bg-white border border-blue-200 p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">5. 任务状态</h2>
              <StatusIndicator status={status} queue={queue} percent={percent} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">6. 转写结果</h2>
              <TranscriptStream segments={segments} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">7. 结果操作</h2>
              <ResultActions disabled={!resultReady} onDownload={handleDownloadSubtitle} onCopy={handleCopyText} />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-4 text-center text-xs text-gray-400 border-t bg-white">
        © 2025 Video To Text. 仅供学习与演示使用。
      </footer>
    </div>
  );
}
