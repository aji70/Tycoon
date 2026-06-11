"use client";

import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

const toastProps = {
  position: "top-right" as const,
  autoClose: 5000,
  hideProgressBar: false,
  newestOnTop: true,
  closeOnClick: true,
  rtl: false,
  pauseOnFocusLoss: true,
  draggable: true,
  pauseOnHover: true,
  theme: "dark" as const,
  toastStyle: {
    fontFamily: "Orbitron, sans-serif",
    background: "#0E1415",
    color: "#00F0FF",
    border: "1px solid #003B3E",
  },
};

/** Toastify CSS after hydration; container mounts immediately so button toasts never race dynamic import. */
export default function DeferredToasts() {
  useEffect(() => {
    void import("react-toastify/dist/ReactToastify.css");
  }, []);

  return <ToastContainer {...toastProps} />;
}
