export type Color = "gray" | "green" | "black" | "white" | "blue" | "pink";

export type Thresholds = {
  blue?: number;  // Azul: vela >= blue
  pink?: number;  // Rosa: vela <= pink
};

export function doesValueMatchColor(v: number, color: Color, t: Thresholds = {}): boolean {
  const blue = t.blue ?? Infinity;
  const pink = t.pink ?? -Infinity;

  switch (color) {
    case "gray":  return true;
    case "white": return v === 1;
    case "green": return v >= 2;
    case "black": return v > 1 && v < 2;
    case "blue":  return v >= blue;
    case "pink":  return v <= pink;
  }
}

export function mapValueToColor(v: number, t: Thresholds = {}): Color {
  if (doesValueMatchColor(v, "white", t)) return "white";
  if (doesValueMatchColor(v, "blue",  t)) return "blue";
  if (doesValueMatchColor(v, "pink",  t)) return "pink";
  if (doesValueMatchColor(v, "green", t)) return "green";
  if (doesValueMatchColor(v, "black", t)) return "black";
  return "gray";
}
