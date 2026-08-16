import React from "react";

interface NotebookPaperProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export default function NotebookPaper({ children, className = "", id }: NotebookPaperProps) {
  return (
    <div
      id={id || "glass-canvas-container"}
      className={`relative w-full min-h-[580px] glass-canvas rounded-3xl overflow-hidden ${className}`}
    >
      {/* Google Expressive Top Accent Line */}
      <div className="h-1.5 w-full google-gradient-bar" />

      {/* Decorative ambient glass refraction bubbles */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

      {/* Left Frosted Indicator Sidebar */}
      <div className="absolute left-0 top-1.5 bottom-0 w-3 bg-gradient-to-r from-blue-500/20 via-blue-500/5 to-transparent pointer-events-none hidden sm:block" />

      {/* Interactive Content */}
      <div className="relative p-6 sm:p-8 md:p-10 z-20 min-h-full flex flex-col h-full">
        {children}
      </div>
    </div>
  );
}
