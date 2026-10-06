import { useState } from "react";
import { FiZap } from "react-icons/fi";
import { Breadcrumbs, Empty } from "../components/ui/primitives";
import { EventCard } from "../components/product/Cards";
import { useTitle } from "../lib/hooks";
import { useGetEventsQuery } from "../store/api";

const TABS = [
  ["Running", "Live now"],
  ["Upcoming", "Starting soon"],
  ["Ended", "Ended"],
];

export default function Events() {
  useTitle("Live sales");
  const { data: events = [], isLoading: loading } = useGetEventsQuery();
  const [tab, setTab] = useState("Running");

  const counts = Object.fromEntries(TABS.map(([k]) => [k, events.filter((e) => e.status === k).length]));
  const list = events.filter((e) => e.status === tab);

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Live sales" }]} />
      <div className="pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Live sales</h1>
        <p className="text-slate mt-1.5 max-w-xl">
          Limited-stock deals from our shops. When the timer or the stock runs out, the price goes back up.
        </p>
      </div>

      <div role="tablist" className="flex gap-2 pb-6 overflow-x-auto no-scrollbar">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap border ${tab === k ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink"}`}
          >
            {label} <span className={`ml-1 num ${tab === k ? "text-white/70" : "text-muted"}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[260px] rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty
          icon={<FiZap size={24} />}
          title={tab === "Running" ? "No live sales right now" : tab === "Upcoming" ? "Nothing scheduled yet" : "No past sales"}
          text="New deals are added all the time. Check back soon."
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {list.map((e) => (
            <EventCard key={e._id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
