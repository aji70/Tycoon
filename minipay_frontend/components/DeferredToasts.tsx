"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const ToastContainer = dynamic(
  () => import("react-toastify").then((m) => m.ToastContainer),
  { ssr: false }
);

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

/** Toastify base CSS + container — not render-blocking in root layout. */
export default function DeferredToasts() {
  useEffect(() => {
    void import("react-toastify/dist/ReactToastify.css");
  }, []);

  return <ToastContainer {...toastProps} />;
}
