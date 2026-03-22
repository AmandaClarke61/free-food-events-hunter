"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onCloseRef.current(), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-cute-text px-5 py-3 text-sm font-bold text-white shadow-lg transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {message}
    </div>,
    document.body
  );
}
