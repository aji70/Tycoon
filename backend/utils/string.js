export const safeJsonParse = (str) => {
  if (str == null || str === "") return [];
  if (Array.isArray(str)) return str;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("Invalid JSON detected:", str);
    return [];
  }
};
