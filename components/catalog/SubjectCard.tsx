"use client";

type Props = {
  subject: any;
  isAdded: boolean;
  locked: boolean;
  willExceedLimit: boolean;
  onEnlist: (subject: any) => void;
  onDrop: (subject: any) => void;
};

export default function SubjectCard({
  subject,
  isAdded,
  locked,
  willExceedLimit,
  onEnlist,
  onDrop,
}: Props) {
  const isFull = subject.slots <= 0;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-l-4 bg-white p-4 sm:p-5 shadow-xs ${
        isAdded
          ? "border-emerald-300 border-l-emerald-700 bg-emerald-50/40"
          : "border-zinc-200 border-l-zinc-300"
      }`}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-zinc-900">{subject.code}</h3>
          <span className="bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-700">
            {subject.units} units
          </span>
          {subject.isGenEd ? (
            <span className="border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
              Gen Ed
            </span>
          ) : (
            <>
              <span className="bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
                {subject.year}
              </span>
              <span className="bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
                {subject.term}
              </span>
            </>
          )}
          {isAdded && (
            <span className="border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
              Added
            </span>
          )}
          {isFull && (
            <span className="border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-800">
              Closed
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm font-semibold text-zinc-700">{subject.title}</p>
        <p className="mt-1.5 text-xs text-zinc-500">
          Prerequisite:{" "}
          <span className={subject.prereq === "None" ? "text-zinc-500" : "font-bold text-amber-700"}>
            {subject.prereq}
          </span>
        </p>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-zinc-100 pt-3 sm:border-0 sm:pt-0">
        <div className="text-left sm:text-right">
          <p className={`font-mono text-sm font-bold ${isFull ? "text-red-700" : "text-zinc-900"}`}>
            {Math.max(0, subject.slots)} <span className="font-normal text-zinc-500">/ {subject.max}</span>
          </p>
          <p className="text-xs text-zinc-500">Slots left</p>
        </div>

        {locked ? (
          <span className="w-full sm:w-28 shrink-0 border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-center text-sm font-bold text-zinc-500">
            {isAdded ? "Enrolled" : "Locked"}
          </span>
        ) : isAdded ? (
          <button
            onClick={() => onDrop(subject)}
            className="w-full sm:w-28 shrink-0 border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-600 hover:border-red-600 hover:text-white"
          >
            Drop
          </button>
        ) : (
          <button
            disabled={isFull || willExceedLimit}
            onClick={() => onEnlist(subject)}
            className={`w-full sm:w-28 shrink-0 border px-4 py-2.5 text-sm font-bold transition-all ${
              isFull
                ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
                : willExceedLimit
                  ? "cursor-not-allowed border-red-200 bg-red-50 text-red-400"
                  : "border-emerald-900 border-l-4 border-l-emerald-400 bg-emerald-900 text-white hover:bg-emerald-800"
            }`}
          >
            {isFull ? "Closed" : willExceedLimit ? "Unit limit" : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}