"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Property } from "@/types/game";

interface TradeModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: any[];
  offerProperties: number[];
  requestProperties: number[];
  setOfferProperties: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestProperties: React.Dispatch<React.SetStateAction<number[]>>;
  offerCash: number;
  requestCash: number;
  setOfferCash: React.Dispatch<React.SetStateAction<number>>;
  setRequestCash: React.Dispatch<React.SetStateAction<number>>;
  toggleSelect: (id: number, arr: number[], setter: any) => void;
  targetPlayerAddress?: string | null;
}

/** Portal into fullscreen element when active so modal is visible in fullscreen (desktop), else body */
function getPortalTarget(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (document.fullscreenElement as HTMLElement) || document.body;
}

const PropertyCard = ({
  prop,
  isSelected,
  onClick,
  accent,
}: {
  prop: Property;
  isSelected: boolean;
  onClick: () => void;
  accent: "offer" | "request";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      w-full text-left p-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
      ${isSelected
        ? accent === "offer"
          ? "border-emerald-400 bg-emerald-500/20 shadow-sm shadow-emerald-500/30 focus:ring-emerald-400"
          : "border-amber-400 bg-amber-500/20 shadow-sm shadow-amber-500/30 focus:ring-amber-400"
        : "border-slate-600/80 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/50 focus:ring-slate-400"
      }
    `}
  >
    {prop.color && (
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0 border border-white/10"
        style={{ backgroundColor: prop.color }}
      />
    )}
    <span className="text-sm font-medium text-slate-200 truncate">{prop.name}</span>
  </button>
);

export const TradeModal: React.FC<TradeModalProps> = (props) => {
  const {
    title,
    onClose,
    onSubmit,
    my_properties,
    properties,
    game_properties,
    offerProperties,
    requestProperties,
    setOfferProperties,
    setRequestProperties,
    offerCash,
    requestCash,
    setOfferCash,
    setRequestCash,
    toggleSelect,
    targetPlayerAddress,
  } = props;

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() => getPortalTarget());

  useEffect(() => {
    setPortalTarget(getPortalTarget());
    const onFullscreenChange = () => setPortalTarget(getPortalTarget());
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!props.open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [props.open, handleKeyDown]);

  if (!props.open) return null;

  const safeGameProps = game_properties ?? [];
  const safeProperties = properties ?? [];
  const safeMyProperties = my_properties ?? [];

  const targetOwnedProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    const ownedGameProps = safeGameProps.filter(
      (gp: any) => gp.address === targetPlayerAddress
    );
    return safeProperties.filter((p: any) =>
      ownedGameProps.some((gp: any) => gp.property_id === p.id)
    );
  }, [safeGameProps, safeProperties, targetPlayerAddress]);

  const offerPropNames = useMemo(
    () => safeMyProperties.filter((p) => offerProperties.includes(p.id)).map((p) => p.name),
    [safeMyProperties, offerProperties]
  );
  const requestPropNames = useMemo(
    () => targetOwnedProps.filter((p) => requestProperties.includes(p.id)).map((p) => p.name),
    [targetOwnedProps, requestProperties]
  );
  const hasOffer = offerPropNames.length > 0 || (offerCash ?? 0) > 0;
  const hasRequest = requestPropNames.length > 0 || (requestCash ?? 0) > 0;

  const modalContent = (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-modal-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm z-[2147483647]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-600/50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80 bg-slate-800/50 flex-shrink-0">
          <h2 id="trade-modal-title" className="text-xl font-bold text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Close trade"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Two columns: You give | You get */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <p className="text-slate-400 text-sm mb-4">
            Choose properties and cash you want to give and what you want in return.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* You give (offer) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  You give
                </h3>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {safeMyProperties.length > 0 ? (
                  safeMyProperties.map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={offerProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                      accent="offer"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center rounded-lg bg-slate-800/50">
                    You have no properties to offer
                  </p>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1.5">Cash to offer ($)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={offerCash ?? ""}
                  onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  aria-label="Cash amount to offer"
                />
              </label>
            </div>

            {/* You get (request) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                  You get
                </h3>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(targetOwnedProps ?? []).length > 0 ? (
                  (targetOwnedProps ?? []).map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={requestProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                      accent="request"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center rounded-lg bg-slate-800/50">
                    Other player has no properties
                  </p>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1.5">Cash to request ($)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={requestCash ?? ""}
                  onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                  aria-label="Cash amount to request"
                />
              </label>
            </div>
          </div>

          {/* Deal summary */}
          {(hasOffer || hasRequest) && (
            <div className="mt-4 p-4 rounded-xl bg-slate-800/60 border border-slate-600/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Deal summary
              </p>
              <div className="flex flex-col sm:flex-row sm:gap-6 gap-1 text-sm text-slate-200">
                {hasOffer && (
                  <span>
                    <span className="text-slate-500">You give:</span>{" "}
                    {offerPropNames.length > 0 ? offerPropNames.join(", ") : "—"}
                    {(offerCash ?? 0) > 0 && (
                      <>
                        {offerPropNames.length > 0 && " + "}
                        <strong className="text-emerald-300">${offerCash}</strong>
                      </>
                    )}
                  </span>
                )}
                {hasRequest && (
                  <span>
                    <span className="text-slate-500">You get:</span>{" "}
                    {requestPropNames.length > 0 ? requestPropNames.join(", ") : "—"}
                    {(requestCash ?? 0) > 0 && (
                      <>
                        {requestPropNames.length > 0 && " + "}
                        <strong className="text-amber-300">${requestCash}</strong>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700/80 bg-slate-800/30 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Send deal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  const target = portalTarget ?? (typeof document !== "undefined" ? document.body : null);
  return target ? createPortal(modalContent, target) : modalContent;
};
