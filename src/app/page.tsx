"use client";

import VideoInput from "../components/VideoInput";
import UploadButton from "../components/UploadButton";
import LanguageSelector from "../components/LanguageSelector";
import StatusIndicator, { StatusType } from "../components/StatusIndicator";
import TranscriptStream from "../components/TranscriptStream";
import ResultActions from "../components/ResultActions";
import React, { useState } from "react";

export default function Home() {
  // 状态占位
  const [status, setStatus] = useState<StatusType>("queueing");
  const [queue, setQueue] = useState<number>(2);
  const [percent, setPercent] = useState<number>(35);
  const [resultReady, setResultReady] = useState<boolean>(false);

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
              <VideoInput />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">2. 语言选择</h2>
              <p className="text-xs text-blue-700 mb-2">请选择视频语音的语言</p>
              <LanguageSelector />
            </div>
            <div>
              <UploadButton disabled={false} />
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
              <TranscriptStream />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">7. 结果操作</h2>
              <ResultActions disabled={!resultReady} />
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
