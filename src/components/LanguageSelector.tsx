import React from 'react';

const LanguageSelector: React.FC = () => {
  return (
    <select className="select select-bordered w-full">
      <option value="auto">自动识别</option>
      <option value="zh">中文</option>
      <option value="en">英文</option>
      <option value="ja">日语</option>
      <option value="ko">韩语</option>
      {/* 可根据需要添加更多语言 */}
    </select>
  );
};

export default LanguageSelector;
