import React from "react";

export type ModelOption = "base" | "small";

interface ModelSelectorProps {
  value?: ModelOption;
  onChange?: (value: ModelOption) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  value = "base",
  onChange,
}) => {
  return (
    <select
      className="select select-bordered w-full text-blue-500"
      value={value}
      onChange={(e) => onChange?.((e.target.value as ModelOption) || "base")}
    >
      <option value="base">最佳速度</option>
      <option value="small">最佳质量</option>
    </select>
  );
};

export default ModelSelector;
