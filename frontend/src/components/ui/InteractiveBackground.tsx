"use client";

/**
 * Serene Notion & Apple-style ambient background.
 * Keeps data tables, equations, and charts completely free of visual noise.
 */
export function InteractiveBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#fbfbfa]"
      aria-hidden="true"
    >
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0, 113, 227, 0.08) 0%, rgba(99, 102, 241, 0.03) 45%, rgba(255, 255, 255, 0) 75%)",
        }}
      />
    </div>
  );
}
