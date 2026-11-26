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
        className="absolute -top-44 left-1/3 h-[560px] w-[860px] rounded-full opacity-55 blur-[130px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0, 113, 227, 0.11) 0%, rgba(99, 102, 241, 0.05) 45%, rgba(255, 255, 255, 0) 75%)",
        }}
      />
      <div
        className="absolute top-1/3 -right-32 h-[440px] w-[440px] rounded-full opacity-45 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(16, 185, 129, 0.07) 0%, rgba(0, 113, 227, 0.04) 50%, rgba(255, 255, 255, 0) 75%)",
        }}
      />
    </div>
  );
}
