import type { PickerEngine } from "./engine.js";

interface ModelContext {
  registerTool(tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute(input: unknown): unknown }, options: { signal: AbortSignal }): void | Promise<void>;
}
export function registerGameTools(engine: PickerEngine, update: () => void, documentObject = document as Document & { modelContext?: ModelContext }) {
  const context = documentObject.modelContext;
  if (!context?.registerTool) return () => {};
  const controller = new AbortController();
  const tools = [
    {
      name: "read_picker_state", title: "Read picker state", description: "Read the current phase, participants, and revealed result. Does not reveal an unrevealed random winner.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) { validateEmpty(input); return engine.snapshot(); },
    },
    {
      name: "reset_picker_round", title: "Reset picker round", description: "End the current round and return to mode selection. Clears all participants and the result.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) { validateEmpty(input); engine.reset(); update(); return { phase: "idle" }; },
    },
  ];
  for (const tool of tools) {
    try { void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}); } catch { /* Draft APIs never block gameplay. */ }
  }
  return () => controller.abort();
}
function validateEmpty(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("Expected an empty object.");
}
