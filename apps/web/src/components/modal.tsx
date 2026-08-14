"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLockBodyScroll } from "../lib/use-lock-body-scroll";

type ModalProps = {
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
};

export function Modal({ onClose, children, labelledBy }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useLockBodyScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
