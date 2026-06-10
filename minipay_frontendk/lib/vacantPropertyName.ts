/** Fixed px size for square property name labels (never scales with container). */
export const SQUARE_NAME_FONT_PX = 9;

/** Text-only badge styles for square property names (2D + 3D). */
export const squareNameTextStyle: Record<string, string | number> = {
  fontSize: `${SQUARE_NAME_FONT_PX}px`,
  fontWeight: 700,
  lineHeight: 1.15,
  background: "rgba(0,0,0,0.45)",
  borderRadius: "2px",
  padding: "1px 2px",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  textOverflow: "clip",
  wordBreak: "break-word",
};
