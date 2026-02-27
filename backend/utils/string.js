export const safeJsonParse = (str) => {
  try {
    if (!str) return [];
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("Invalid JSON detected:", str);
    return [];
  }
};
