"use client";

import VideoInput from "../components/VideoInput";
import UploadButton from "../components/UploadButton";
import LanguageSelector from "../components/LanguageSelector";
import StatusIndicator, { StatusType } from "../components/StatusIndicator";
import TranscriptStream, { TranscriptSegment } from "../components/TranscriptStream";
import ResultActions from "../components/ResultActions";
import React, { useState, useCallback, useRef, useEffect } from "react";

const DV_BASE = 'http://192.168.191.168:3456';
const TV_BASE = 'http://192.168.191.168:6789';

export default function Home() {
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
        const res = await fetch(`${DV_BASE}/task/${taskId}`);
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

  const connectSSE = (ttsId: string) => {
    // 订阅 TTS SSE
    try {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      const es = new EventSource(`${TV_BASE}/tts/sse?id=${encodeURIComponent(ttsId)}`);
      sseRef.current = es;
      setStatus('transcribing');

      es.onmessage = (e) => {
        const text = e.data || '';
        // 简单解析含 [xxx.s -> yyy.s] 的行作为片段
        const lines = (text.split('\n') as string[]).map((l: string) => l.trim()).filter(Boolean);
        const newSegments: TranscriptSegment[] = [];
        lines.forEach((line: string) => {
          const m = line.match(/\[\s*([\d.]+)s\s*->\s*([\d.]+)s\s*\]\s*(.+)/);
          if (m) {
            const startS = parseFloat(m[1]);
            const endS = parseFloat(m[2]);
            const content = m[3].trim();
            newSegments.push({ start: fmt(startS), end: fmt(endS), text: content });
          } else if (line.toLowerCase().includes('status') && line.toLowerCase().includes('success')) {
            // 标记完成
            setStatus('completed');
          } else {
            // 当作普通转写文本追加
            newSegments.push({ start: '00:00', end: '00:00', text: line });
          }
        });
        if (newSegments.length) {
          setSegments(prev => [...prev, ...newSegments]);
        }
      };

      es.onerror = (err) => {
        console.error('SSE error', err);
        // 不立即关闭，等待服务端发结束
      };
    } catch (err) {
      console.error('connect sse failed', err);
      setStatus('error');
    }
  };

  const startTask = async () => {
    const current = inputRef.current;
    if (!current.type) return;
    setStatus('queueing');

    if (current.type === 'url' && typeof current.value === 'string') {
      // 先调用下载服务
      try {
        setStatus('downloading');
        const body = { url: current.value, quality: 'audio_worst' };
        const res = await fetch(`${DV_BASE}/download`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('submit download failed');
        const rjson = await res.json();
        const dvTaskId = rjson.taskId || rjson.id || rjson.data?.id;
        if (!dvTaskId) throw new Error('download task id missing');

        const dvResult = await pollDvTask(dvTaskId);
        // dvResult.fullPath 指向可访问的音频文件
        const audioUrl = dvResult.fullPath || dvResult.output || dvResult.location;
        if (!audioUrl) throw new Error('download result missing file url');

        // 创建转写任务
        setStatus('transcoding');
        const tRes = await fetch(`${TV_BASE}/tts/task`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: audioUrl, quality: 'medium', languageArray: 'auto' }) });
        if (!tRes.ok) throw new Error('create tts task failed');
        let tjson: any = {};
        try { tjson = await tRes.json(); } catch (e) { /* ignore */ }
        const ttsId = tjson.id || tjson.taskId || tRes.headers.get('Location')?.split('/').pop();
        if (!ttsId) {
          // 如果没有 id，尝试查询最近任务或直接结束
          console.warn('tts id not found, SSE may not work');
        }
        // 订阅 SSE
        if (ttsId) connectSSE(ttsId);

      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }

    if (current.type === 'file' && current.value instanceof File) {
      // 上传文件到 TTS 上传接口
      try {
        setStatus('transcoding');
        const fm = new FormData();
        fm.append('file', current.value);
        fm.append('quality', 'medium');
        fm.append('languageArray', 'auto');
        const upl = await fetch(`${TV_BASE}/tts/upload`, { method: 'POST', body: fm });
        if (!upl.ok) throw new Error('upload failed');
        let ujson: any = {};
        try { ujson = await upl.json(); } catch (e) { /* ignore */ }
        const ttsId = ujson.id || ujson.taskId || upl.headers.get('Location')?.split('/').pop();
        if (ttsId) connectSSE(ttsId);
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }
  };

  const handleDownloadSubtitle = () => {
    if (!outputName) return;
    // 拼接下载地址（按 docs）
    const url = `https://tv.itclass.top/static/${outputName}`;
    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    if (!outputName) return;
    try {
      const res = await fetch(`${TV_BASE}/tts/srt-to-txt?file=${encodeURIComponent(outputName)}`);
      if (!res.ok) throw new Error('srt to txt failed');
      const txt = await res.text();
      await navigator.clipboard.writeText(txt);
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
