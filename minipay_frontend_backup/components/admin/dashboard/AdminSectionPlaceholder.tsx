"use client";

export default function AdminSectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-2 text-slate-400 text-sm leading-relaxed">{description}</p>
      ) : (
        <p className="mt-2 text-slate-500 text-sm">This section is planned; data and actions will ship in the next steps.</p>
      )}
    </div>
  );
}
