"use client";

type Props = {
  studentProgram: string | null;
  recYear: string;
  setRecYear: (year: string) => void;
  recTerm: string;
  setRecTerm: (term: string) => void;
  recOpen: boolean;
  setRecOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recommended: any[];
  enlistedCodes: Set<string>;
  recTotalUnits: number;
  recOverBy: number;
  recToAdd: any[];
  recUnitsToAdd: number;
  isAddingSet: boolean;
  onEnlistSet: () => void;
  yearOptions: string[];
  terms: string[];
};

export default function RecommendedPanel({
  studentProgram,
  recYear,
  setRecYear,
  recTerm,
  setRecTerm,
  recOpen,
  setRecOpen,
  recommended,
  enlistedCodes,
  recTotalUnits,
  recOverBy,
  recToAdd,
  recUnitsToAdd,
  isAddingSet,
  onEnlistSet,
  yearOptions,
  terms,
}: Props) {
  return (
    <section className="mb-6 border border-emerald-900/15 border-l-4 border-l-emerald-700 bg-white shadow-xs">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-2 bg-emerald-800" />
          <div>
            <h2 className="text-base font-bold uppercase tracking-tight text-zinc-900">
              Recommended Subjects
            </h2>
            <p className="text-xs text-zinc-500">{studentProgram}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={recYear}
            onChange={(e) => setRecYear(e.target.value)}
            className="border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-bold focus:border-emerald-800 focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={recTerm}
            onChange={(e) => setRecTerm(e.target.value)}
            className="border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-bold focus:border-emerald-800 focus:outline-none"
          >
            {terms.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => setRecOpen((o) => !o)}
            aria-expanded={recOpen}
            className="border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-emerald-50"
          >
            {recOpen ? "Hide ▴" : "Show ▾"}
          </button>
        </div>
      </div>

      {recOpen && (
        <>
          {recommended.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-zinc-600">
              No recommended subjects for {recYear}, {recTerm}.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recommended.map((s) => {
                const added = enlistedCodes.has(s.code);
                const closed = s.slots <= 0;
                return (
                  <li key={s.code} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900">
                        {s.code}
                        <span className="ml-2 font-mono text-xs font-medium text-zinc-500">
                          {s.units} units
                        </span>
                      </p>
                      <p className="truncate text-xs text-zinc-600">{s.title}</p>
                    </div>
                    {added ? (
                      <span className="shrink-0 border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                        Added
                      </span>
                    ) : closed ? (
                      <span className="shrink-0 border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-800">
                        Closed
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-xs text-zinc-500">
                        {s.slots} slots
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {recommended.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-zinc-200 bg-emerald-950/[0.03] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-zinc-600">
                Set total: <span className="font-mono text-emerald-950">{recTotalUnits} units</span>
                {recOverBy > 0 && (
                  <span className="ml-2 text-red-700">Over your limit by {recOverBy} units</span>
                )}
              </p>
              <button
                onClick={onEnlistSet}
                disabled={isAddingSet || recToAdd.length === 0 || recOverBy > 0}
                className="border-l-4 border-emerald-400 bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                {isAddingSet
                  ? "Adding..."
                  : recToAdd.length === 0
                    ? recommended.every((s) => enlistedCodes.has(s.code))
                      ? "All subjects added ✓"
                      : "Nothing available to add"
                    : `Add all ${recToAdd.length} subjects (${recUnitsToAdd} units)`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}