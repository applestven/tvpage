"use client";

import VideoInput from "../components/VideoInput";
import UploadButton from "../components/UploadButton";
import LanguageSelector from "../components/LanguageSelector";
import StatusIndicator, { StatusType } from "../components/StatusIndicator";
import TranscriptStream, {
  TranscriptSegment,
} from "../components/TranscriptStream";
import ResultActions from "../components/ResultActions";
import TaskHistory, {
  TaskHistoryHandle,
  TaskItem,
} from "../components/TaskHistory";
import FeedbackButton from "@/components/FeedbackButton";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { fetchWithRetry, withRetry } from "../lib/fetchWithRetry";

// 根据部署架构：浏览器 -> Next.js（公网） -> tv/dv（ZeroTier 内网）
// 前端应通过 Next.js 的 API 路径访问内网服务，由 Next.js 在服务器端代理到真实内网地址。
// 这样浏览器只访问同域的 /api 路径，避免直接暴露内网地址。
const DV_API = "/api/dv";
const TV_API = "/api/tv";

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
  const inputRef = useRef<{
    type: "url" | "file" | null;
    value: string | File | null;
  }>({ type: null, value: null });

  // 转写流与结果
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const [outputName, setOutputName] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  // store duration (ms) reported by SSE messages
  const durationRef = useRef<number | null>(null);

  // 引用任务历史组件
  const taskHistoryRef = useRef<TaskHistoryHandle>(null);
  // 当前任务ID（用于把任务详情写回历史）
  const currentTaskIdRef = useRef<string | null>(null);
  // track success count for closing SSE connection
  const successCountRef = useRef<number>(0);

  useEffect(() => {
    // 初始化：查询 TTS 队列状态，仅当有排队时展示数量
    const initQueue = async () => {
      try {
        const res = await fetchWithRetry(`${TV_API}/tts/queue/status`);
        if (res.ok) {
          const data = await res.json();
          // 兼容字段：running/queued/concurrency/queuedTaskIds
          const queued = Number(data?.queued ?? 0);
          setQueue(queued);
          if (queued > 0) setStatus("queueing");
        }
      } catch (e) {
        // 忽略初始化队列查询失败，不影响页面其它功能
        console.warn("初始化队列状态失败", e);
      }
    };
    initQueue();

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

  const handleInputChange = useCallback(
    (
      hasInput: boolean,
      type: "url" | "file" | null,
      value: string | File | null
    ) => {
      setHasVideoInput(hasInput);
      inputRef.current = { type, value };
      // 重置之前的任务状态
      setResultReady(false);
      setSegments([]);
      segmentsRef.current = [];
      setPercent(0);
      setOutputName(null);
      successCountRef.current = 0; // 重置成功计数
    },
    []
  );

  // 将秒数数值格式化为 mm:ss 或 hh:mm:ss
  const fmt = (sNum: number) => {
    const s = Math.floor(sNum);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0)
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(
        2,
        "0"
      )}:${String(ss).padStart(2, "0")}`;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  // parse time strings like "03:54" or numeric seconds like "12.34" (optionally with trailing 's')
  const timeStrToMs = (t: string) => {
    if (!t) return 0;
    t = String(t).trim();
    // mm:ss or hh:mm:ss
    if (t.includes(":")) {
      const parts = t.split(":").map((p) => Number(p));
      if (parts.length === 2) {
        return (parts[0] * 60 + parts[1]) * 1000;
      }
      if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
      }
    }
    // numeric seconds (maybe with trailing 's')
    const m = t.match(/([\d.]+)s?$/);
    if (m) {
      const v = Number(m[1]);
      // heuristics: if value looks like milliseconds (>10k), treat as ms
      if (v > 10000) return Math.round(v);
      return Math.round(v * 1000);
    }
    // fallback
    const n = Number(t);
    if (!Number.isNaN(n)) {
      if (n > 10000) return Math.round(n);
      return Math.round(n * 1000);
    }
    return 0;
  };

  // 轮询 DV 下载任务详情
  const pollDvTask = async (taskId: string) => {
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    while (true) {
      try {
        const res = await fetchWithRetry(`${DV_API}/task/${taskId}`);
        if (!res.ok) throw new Error("dv task fetch failed");
        const data = await res.json();
        // 请求成功，重置错误计数
        consecutiveErrors = 0;
        // data.status: pending, running, success, failed
        if (data.status === "pending" || data.status === "running") {
          setStatus("downloading");
          // 如果返回了正在执行的数量或其它可用字段，可以解析更新
        }
        if (data.status === "success") {
          // 返回的 fullPath 指向下载服务器可访问的文件
          return data;
        }
        if (data.status === "failed") {
          throw new Error(data.error || "download failed");
        }
      } catch (err) {
        consecutiveErrors++;
        console.error(
          `轮询失败 (${consecutiveErrors}/${maxConsecutiveErrors}):`,
          err
        );
        if (consecutiveErrors >= maxConsecutiveErrors) {
          setStatus("error");
          throw err;
        }
      }
      // 等待 2s 再轮询
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  // 查询 TTS 任务详情
  const fetchTaskDetail = async (ttsId: string) => {
    try {
      const detailRes = await fetchWithRetry(`${TV_API}/tts/${ttsId}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        if (detailData.output_name) {
          setOutputName(detailData.output_name);
          setResultReady(true);
          // 将结果写入历史
          const taskId = currentTaskIdRef.current;
          if (taskId) {
            const resultUrl = `${TV_API}/static/${detailData.output_name}`;
            taskHistoryRef.current?.updateTaskStatus(
              taskId,
              "completed",
              100,
              resultUrl
            );
          }
        }
      }
    } catch (err) {
      console.error("获取任务详情失败:", err);
    }
  };

  // 轮询 TTS 任务状态
  const pollTTSTask = async (ttsId: string) => {
    while (!stoppedRef.current) {
      try {
        const res = await fetch(`${TV_API}/tts/${ttsId}`);
        if (!res.ok)
          throw new Error(`tts task fetch failed with status ${res.status}`);
        const data = await res.json();
        // data.status: pending, running, success, failed
        if (data.status === "running") {
          setStatus("transcribing");
          // 如果返回了进度信息，可以更新进度
          if (data.progress !== undefined) {
            setPercent(Math.min(100, Math.max(0, data.progress)));
            // 同步到历史
            const taskId = currentTaskIdRef.current;
            if (taskId) {
              taskHistoryRef.current?.updateTaskStatus(
                taskId,
                "transcribing",
                Math.min(100, Math.max(0, data.progress))
              );
            }
          }

          // 当状态为running时，启动SSE连接并停止轮询
          connectSSE(ttsId);
          return; // 停止轮询
        } else if (data.status === "success") {
          if (stoppedRef.current) return; // 避免重复处理

          setStatus("completed");
          setPercent(100);
          setOutputName(data.output_name);
          setResultReady(true);
          // 同步到历史
          const taskId = currentTaskIdRef.current;
          if (taskId && data.output_name) {
            const resultUrl = `${TV_API}/static/${data.output_name}`;
            taskHistoryRef.current?.updateTaskStatus(
              taskId,
              "completed",
              100,
              resultUrl
            );
          }
          return data;
        } else if (data.status === "failed") {
          if (stoppedRef.current) return; // 避免在SSE已处理的情况下重复处理

          setStatus("error");
          // 同步到历史
          const taskId = currentTaskIdRef.current;
          if (taskId) {
            taskHistoryRef.current?.updateTaskStatus(taskId, "error");
          }
          throw new Error(data.error || "tts task failed");
        }
      } catch (err) {
        console.error("轮询TTS任务失败:", err);
        if (!stoppedRef.current) {
          // 仅在任务未被其他方式停止时设置错误
          setStatus("error");
          const taskId = currentTaskIdRef.current;
          if (taskId) {
            taskHistoryRef.current?.updateTaskStatus(taskId, "error");
          }
        }
        break;
      }
      // 等待 3s 再轮询
      await new Promise((r) => setTimeout(r, 3000));
    }
  };

  const connectSSE = (ttsId: string) => {
    // 先终止旧连接
    stoppedRef.current = false;
    successCountRef.current = 0; // 重置成功计数

    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    // SSE 也通过 Next.js 路径代理到内网服务
    const es = new EventSource(
      `${TV_API}/tts/sse?id=${encodeURIComponent(ttsId)}`
    );
    sseRef.current = es;

    setStatus("transcribing");

    // reset duration for this run
    durationRef.current = null;
    setPercent(0);

    es.onmessage = (e) => {
      if (stoppedRef.current) return;

      let data: any;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      /** ===============================
       * 1️⃣ Whisper CLI / 转写服务 输出（logs）
       * 支持多种时间戳格式：
       * - Whisper 样式: [12.34s -> 13.56s] text
       * - ttx 样式:    [03:54 → 03:56] text
       * =============================== */
      // 检查 logs 或 content 数组
      const logLines = Array.isArray(data.logs)
        ? data.logs
        : Array.isArray(data.content)
        ? data.content
        : [];

      if (logLines.length > 0) {
        const newSegs: TranscriptSegment[] = [];

        for (const line of logLines) {
          if (printedRef.current.has(line)) continue;
          printedRef.current.add(line);

          // 1) Whisper style seconds '[12.34s -> 13.56s] some text'
          let m = line.match(/\[\s*([\d.]+)s\s*->\s*([\d.]+)s\s*\]\s*(.+)/);
          if (m) {
            const startMs = Math.round(parseFloat(m[1]) * 1000);
            const endMs = Math.round(parseFloat(m[2]) * 1000);
            newSegs.push({
              start: fmt(startMs / 1000),
              end: fmt(endMs / 1000),
              text: m[3].trim(),
            });
            // update percent if duration known
            if (durationRef.current) {
              const p = Math.min(
                100,
                Math.round((startMs / durationRef.current) * 100)
              );
              setPercent(p);
            }
            continue;
          }

          // 2) Bracket time style '[03:54 → 03:56] optional text'
          m = line.match(
            /\[\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:→|->|-)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]\s*(.*)/
          );
          if (m) {
            const startMs = timeStrToMs(m[1]);
            const endMs = timeStrToMs(m[2]);
            newSegs.push({
              start: fmt(startMs / 1000),
              end: fmt(endMs / 1000),
              text: m[3].trim(),
            });
            if (durationRef.current) {
              const p = Math.min(
                100,
                Math.round((startMs / durationRef.current) * 100)
              );
              setPercent(p);
            }
            continue;
          }

          // 3) fallback: no timestamp match — skip
        }

        if (newSegs.length) {
          setSegments((prev) => {
            const next = [...prev, ...newSegs];
            segmentsRef.current = next;
            return next;
          });
        }
      }

      /** ===============================
       * 2️⃣ 其它 SSE 消息字段（duration / status / error）
       * =============================== */
      // 支持 upstream 在任意消息中下发总时长字段 duration
      if (data.duration !== undefined && data.duration !== null) {
        const raw = Number(data.duration);
        if (!Number.isNaN(raw)) {
          // 如果看起来像秒则转换为毫秒（阈值：<= 10000 视为秒）
          durationRef.current =
            raw > 10000 ? Math.round(raw) : Math.round(raw * 1000);
          // 尝试用已存在的 segments 更新进度（使用最后一段的 start）
          if (durationRef.current && segmentsRef.current.length > 0) {
            const last = segmentsRef.current[segmentsRef.current.length - 1];
            const lastStartMs = timeStrToMs(last.start);
            if (lastStartMs > 0) {
              const p = Math.min(
                100,
                Math.round((lastStartMs / durationRef.current) * 100)
              );
              setPercent(p);
            }
          }
        }
      }

      // 停止 / 结束规则（与 CLI 一致）
      if (data.status === "success") {
        successCountRef.current += 1;
        // 为了保证最后的转写结果能完整传递完，只有在成功次数达到3次后才真正结束 SSE 连接
        if (successCountRef.current >= 3) {
          console.log("成功次数达到3次，结束SSE");
          stoppedRef.current = true;
          setStatus("completed");
          setPercent(100);

          es.close();
          sseRef.current = null;

          // 查询任务详情获取 output_name
          fetchTaskDetail(ttsId);
          return;
        }
      }

      if (data.status === "failed") {
        stoppedRef.current = true;
        console.error("transcribe failed:", data.error);
        setStatus("error");

        es.close();
        sseRef.current = null;
        return;
      }
    };

    es.onerror = (err) => {
      if (stoppedRef.current) return;
      console.error("SSE error", err);
      // 和 CLI 一样：不立即 close，等 success / failed
    };
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

    // 获取视频源描述
    const videoSource =
      current.type === "url"
        ? (current.value as string)
        : (current.value as File).name;
    setStatus("queueing");

    if (current.type === "url" && typeof current.value === "string") {
      // 先调用下载服务
      try {
        setStatus("downloading");

        // 提交下载任务（带重试和超时）
        const dvTaskId = await withRetry(async () => {
          const body = { url: current.value, quality: "audio_low" };
          const res = await fetchWithRetry(`${DV_API}/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error("submit download failed");
          const rjson = await res.json();
          const taskId = rjson.taskId || rjson.id || rjson.data?.id;
          if (!taskId) throw new Error("download task id missing");
          return taskId;
        });

        const dvResult = await pollDvTask(dvTaskId);
        // dvResult.fullPath 指向可访问的音频文件
        // 注意：dvResult 返回的路径应为 Next.js 能代理访问的地址或者外部可访问地址。
        const audioUrl =
          dvResult.fullPath || dvResult.output || dvResult.location;
        if (!audioUrl) throw new Error("download result missing file url");
        console.log("audioUrl result:", dvResult);
        // 创建转写任务（带重试和超时）
        setStatus("transcoding");
        const ttsId = await withRetry(async () => {
          const tRes = await fetchWithRetry(`${TV_API}/tts/task`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: audioUrl,
              quality: "small",
              languageArray: "auto",
            }),
          });
          if (!tRes.ok) throw new Error("create tts task failed");
          let tjson: any = {};
          try {
            tjson = await tRes.json();
          } catch (e) {
            /* ignore */
          }
          const id =
            tjson.id ||
            tjson.taskId ||
            tRes.headers.get("Location")?.split("/").pop();
          if (!id) throw new Error("tts id not found");
          return id;
        });

        // 用真实ID创建历史记录
        if (ttsId) {
          taskHistoryRef.current?.addTask(videoSource, "url", ttsId);
          currentTaskIdRef.current = ttsId;
          taskHistoryRef.current?.updateTaskStatus(ttsId, "transcribing", 0);
        }

        // 同时启动SSE和轮询，看哪个先返回结果
        {
          connectSSE(ttsId);

          // 启动轮询作为备用方案
          pollTTSTask(ttsId).catch((error) => {
            console.error("轮询TTS任务失败:", error);
          });
          if (currentTaskIdRef.current) {
            taskHistoryRef.current?.updateTaskStatus(
              currentTaskIdRef.current,
              "transcribing",
              0
            );
          }
        }
      } catch (err) {
        console.error("任务失败（已重试3次）:", err);
        setStatus("error");
        if (currentTaskIdRef.current) {
          taskHistoryRef.current?.updateTaskStatus(
            currentTaskIdRef.current,
            "error"
          );
        }
      }
    }

    if (current.type === "file" && current.value instanceof File) {
      // 上传文件到 TTS 上传接口
      try {
        // 正在上传音频文件
        setStatus("uploading");

        // 上传文件（带重试，但不设置超时，因为上传可能耗时较长）
        const ttsId = await withRetry(async () => {
          const fm = new FormData();
          fm.append("file", current.value as File);
          fm.append("quality", "small");
          fm.append("languageArray", "auto");
          const upl = await fetchWithRetry(`${TV_API}/tts/upload`, {
            method: "POST",
            body: fm,
            isUpload: true, // 上传请求不设置超时
          });
          if (!upl.ok) throw new Error("upload failed");
          let ujson: any = {};
          try {
            ujson = await upl.json();
          } catch (e) {
            /* ignore */
          }
          const id =
            ujson.id ||
            ujson.taskId ||
            upl.headers.get("Location")?.split("/").pop();
          if (!id) throw new Error("tts id not found");
          return id;
        });

        if (ttsId) {
          taskHistoryRef.current?.addTask(videoSource, "file", ttsId);
          currentTaskIdRef.current = ttsId;
          taskHistoryRef.current?.updateTaskStatus(ttsId, "transcribing", 0);
        }

        // 同时启动SSE和轮询，看哪个先返回结果
        if (ttsId) {
          {
            connectSSE(ttsId);

            // 启动轮询作为备用方案
            pollTTSTask(ttsId).catch((error) => {
              console.error("轮询TTS任务失败:", error);
            });
          }
          if (currentTaskIdRef.current) {
            taskHistoryRef.current?.updateTaskStatus(
              currentTaskIdRef.current,
              "transcribing",
              0
            );
          }
        }
      } catch (err) {
        console.error("任务失败（已重试3次）:", err);
        setStatus("error");
        if (currentTaskIdRef.current) {
          taskHistoryRef.current?.updateTaskStatus(
            currentTaskIdRef.current,
            "error"
          );
        }
      }
    }
  };

  const handleDownloadSubtitle = () => {
    if (!outputName) return;
    // 拼接下载地址（按 docs） 注意本地开发需要加端口
    // 通过 Next.js 代理静态文件，遵循部署架构：浏览器 -> Next.js -> tv
    const url = `${TV_API}/static/${outputName}`;
    window.open(url, "_blank");

    // 更新任务历史中的结果链接
    // 这里我们可以尝试找到当前任务并更新结果URL，但这需要追踪当前任务ID
    // 目前的实现中我们没有保持对当前任务ID的引用，所以跳过这一步
  };

  const handleCopyText = async () => {
    if (!outputName) return;
    try {
      const res = await fetchWithRetry(
        `${TV_API}/tts/srt-to-txt?file=${encodeURIComponent(outputName)}`
      );
      if (!res.ok) throw new Error("srt to txt failed");
      const txt = await res.text();

      // 优先使用现代 API，兼容移动端
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
      } else {
        // 降级方案：创建临时 textarea
        const textarea = document.createElement("textarea");
        textarea.value = txt;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      // 简短提示
      alert("已复制到剪切板");
    } catch (err) {
      console.error(err);
      alert("复制失败");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <header className="w-full py-6 px-4 border-b bg-white shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* <span className="text-xl font-bold tracking-tight text-blue-900">
            Video To Text
          </span> */}
          <div className="ml-4">
            <StatusIndicator status={status} queue={queue} percent={percent} />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <a
            href="http://43.139.236.50:5566/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            线路一
          </a>
          <TaskHistory
            ref={taskHistoryRef}
            onRetry={async (task: TaskItem) => {
              taskHistoryRef.current?.updateTaskStatus(task.id, "queueing", 0);
              currentTaskIdRef.current = task.id;

              try {
                if (task.sourceType === "url") {
                  setStatus("downloading");
                  taskHistoryRef.current?.updateTaskStatus(
                    task.id,
                    "downloading",
                    0
                  );

                  const dvTaskId = await withRetry(async () => {
                    const body = {
                      url: task.videoSource,
                      quality: "audio_low",
                    };
                    const res = await fetchWithRetry(`${DV_API}/download`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    if (!res.ok) throw new Error("submit download failed");
                    const rjson = await res.json();
                    const id = rjson.taskId || rjson.id || rjson.data?.id;
                    if (!id) throw new Error("download task id missing");
                    return id;
                  });

                  const dvResult = await pollDvTask(dvTaskId);
                  const audioUrl =
                    dvResult.fullPath || dvResult.output || dvResult.location;
                  if (!audioUrl)
                    throw new Error("download result missing file url");

                  setStatus("transcoding");
                  taskHistoryRef.current?.updateTaskStatus(
                    task.id,
                    "transcoding",
                    0
                  );

                  const ttsId = await withRetry(async () => {
                    const tRes = await fetchWithRetry(`${TV_API}/tts/task`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        url: audioUrl,
                        quality: "small",
                        languageArray: "auto",
                      }),
                    });
                    if (!tRes.ok) throw new Error("create tts task failed");
                    let tjson: any = {};
                    try {
                      tjson = await tRes.json();
                    } catch {}
                    const id =
                      tjson.id ||
                      tjson.taskId ||
                      tRes.headers.get("Location")?.split("/").pop();
                    if (!id) throw new Error("tts id not found");
                    return id;
                  });

                  if (ttsId)
                    taskHistoryRef.current?.setTaskTtsId(task.id, ttsId);
                  connectSSE(ttsId);
                  pollTTSTask(ttsId).catch(() => {});
                  taskHistoryRef.current?.updateTaskStatus(
                    task.id,
                    "transcribing",
                    0
                  );
                } else {
                  // file 场景无法自动访问本地文件，维持失败或引导用户重新上传
                  taskHistoryRef.current?.updateTaskStatus(task.id, "error");
                }
              } catch (e) {
                setStatus("error");
                taskHistoryRef.current?.updateTaskStatus(task.id, "error");
              }
            }}
          />
          <FeedbackButton />
        </div>
      </header>

      {/* 主体内容 */}

      <main className="flex-1 flex flex-col md:flex-row w-full max-w-5xl mx-auto gap-8 py-8 px-4">
        {/* 左侧输入区（卡片分块+主色背景） */}
        <section className="md:w-2/5 w-full flex flex-col gap-6">
          <div className="rounded-2xl shadow-lg bg-white border border-blue-400 p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">
                1. 视频输入
              </h2>
              <p className="text-xs text-blue-700 mb-2">
                粘贴视频链接或上传本地视频（二选一）
              </p>
              <VideoInput onInputChange={handleInputChange} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">
                2. 语言选择
              </h2>
              <p className="text-xs text-blue-700 mb-2">请选择视频语音的语言</p>
              <LanguageSelector />
            </div>
            <div>
              <UploadButton
                disabled={false}
                active={hasVideoInput}
                onClick={startTask}
              />
            </div>
          </div>
        </section>

        {/* 右侧输出区（卡片分块） */}
        <section className="md:w-3/5 w-full flex flex-col gap-6">
          <div className="rounded-2xl shadow bg-white border border-blue-200 p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">
                3. 转写结果
              </h2>
              <TranscriptStream segments={segments} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-blue-900 mb-1">
                4. 结果操作
              </h2>
              <ResultActions
                disabled={!resultReady}
                onDownload={() => {
                  if (!outputName) return;
                  // 拼接下载地址（按 docs） 注意本地开发需要加端口
                  // 通过 Next.js 代理静态文件，遵循部署架构：浏览器 -> Next.js -> tv
                  const url = `${TV_API}/static/${outputName}`;
                  window.open(url, "_blank");
                }}
                onCopy={async () => {
                  if (!outputName) return;
                  try {
                    const res = await fetch(
                      `${TV_API}/tts/srt-to-txt?file=${encodeURIComponent(
                        outputName
                      )}`
                    );
                    if (!res.ok) throw new Error("srt to txt failed");
                    const txt = await res.text();

                    // 优先使用现代 API，兼容移动端
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(txt);
                    } else {
                      // 降级方案：创建临时 textarea
                      const textarea = document.createElement("textarea");
                      textarea.value = txt;
                      textarea.style.position = "fixed";
                      textarea.style.left = "-9999px";
                      textarea.style.top = "0";
                      document.body.appendChild(textarea);
                      textarea.focus();
                      textarea.select();
                      document.execCommand("copy");
                      document.body.removeChild(textarea);
                    }
                    // 简短提示
                    alert("已复制到剪切板");
                  } catch (err) {
                    console.error(err);
                    alert("复制失败");
                  }
                }}
              />
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
