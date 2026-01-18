"use client";
import { useState } from "react";

const FeedbackButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md shadow hover:bg-blue-500 transition"
        onClick={() => setOpen(true)}
        aria-label="用户反馈"
      >
        用户反馈
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl mx-4 animate-[fadeIn_200ms_ease-out]">
            {/* 卡片容器 */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* 顶部栏 */}
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                <h3 className="text-base font-semibold text-blue-700">
                  意见反馈
                </h3>
                <button
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                  onClick={() => setOpen(false)}
                  aria-label="关闭反馈"
                >
                  ×
                </button>
              </div>
              {/* 内容区域 */}
              <div className="p-4">
                <iframe
                  src="https://feedback.itclass.top/"
                  title="用户反馈"
                  className="w-full h-[60vh] md:h-[65vh] rounded-lg border border-gray-200"
                  style={{ background: "#fff" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
