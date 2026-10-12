"use client";
import { groupColors } from "@/lib/model";
export const colorNames = ["Grön", "Blå", "Lila", "Orange", "Rosa", "Grå"];
export function GroupColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset className="group-color-picker">
      <legend>Gruppfärg</legend>
      {groupColors.map((color, index) => (
        <label
          key={color}
          style={{ backgroundColor: color }}
          title={colorNames[index]}
        >
          <input
            type="radio"
            name="group-color"
            aria-label={colorNames[index]}
            checked={value === color}
            onChange={() => onChange(color)}
          />
          <span aria-hidden>{value === color ? "✓" : ""}</span>
        </label>
      ))}
    </fieldset>
  );
}
