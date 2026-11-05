"use client";

import { useEffect } from "react";

export function InputModality() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.input ??= "pointer";
    const keyboard = () => { root.dataset.input = "keyboard"; };
    const pointer = () => { root.dataset.input = "pointer"; };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", pointer, true);
    };
  }, []);
  return null;
}
