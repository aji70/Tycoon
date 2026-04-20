/**
 * Returns an Express handler that dispatches req.params.action to the matching
 * method on the controller. Supports both camelCase and kebab-case action names
 * (e.g. "ai-counter" maps to controller.aiCounter).
 *
 * Usage:
 *   router.post("/:action", dispatch(controller, ["buy", "sell", "aiCounter"]));
 */
function kebabToCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function dispatch(controller, actions) {
  // Build a lookup: both the original name and its kebab equivalent resolve to the method name
  const map = new Map();
  for (const action of actions) {
    map.set(action, action);
    const kebab = action.replace(/([A-Z])/g, "-$1").toLowerCase();
    if (kebab !== action) map.set(kebab, action);
  }

  return (req, res) => {
    const raw = req.params.action;
    const methodName = map.get(raw) ?? map.get(kebabToCamel(raw));
    if (!methodName || typeof controller[methodName] !== "function") {
      return res.status(404).json({ success: false, message: `Unknown action: ${raw}` });
    }
    return controller[methodName](req, res);
  };
}
