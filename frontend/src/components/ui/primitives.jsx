import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { FiX, FiMinus, FiPlus, FiChevronRight } from "react-icons/fi";
import { imgUrl } from "../../lib/api";
import { money, percentOff } from "../../lib/format";
import { useLockScroll } from "../../lib/hooks";

/* ---------- images ---------- */
export const Img = ({ name, alt = "", className = "", ...rest }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [name]);
  if (!name || failed) {
    return (
      <div
        className={`grid place-items-center bg-surface-2 text-muted ${className}`}
        role="img"
        aria-label={alt}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="9" cy="9" r="1.6" />
          <path d="m21 16-5-5-8 8" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={imgUrl(name)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
};

/* ---------- ratings ---------- */
const STAR_PATH = "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z";
const StarShape = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="block max-w-none">
    <path d={STAR_PATH} fill={color} />
  </svg>
);

// grey star with a gold copy clipped to the filled fraction (no shared SVG ids)
const Star = ({ fill }) => (
  <span className="relative inline-block w-[14px] h-[14px]">
    <span className="absolute inset-0"><StarShape color="#d9dee5" /></span>
    <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
      <StarShape color="#f5a524" />
    </span>
  </span>
);

export const Stars = ({ value = 0 }) => (
  <span className="inline-flex" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <Star key={i} fill={Math.max(0, Math.min(1, value - i))} />
    ))}
  </span>
);

export const Rating = ({ value = 0, count, size = "sm" }) => (
  <span
    className={`inline-flex items-center gap-1.5 ${size === "sm" ? "text-xs" : "text-sm"}`}
    aria-label={`Rated ${value} out of 5`}
  >
    <Stars value={value} />
    {count !== undefined && <span className="text-muted num">({count})</span>}
  </span>
);

/* ---------- price ---------- */
export const Price = ({ price, was, size = "md" }) => {
  const off = percentOff(was, price);
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl", xl: "text-3xl" };
  return (
    <span className="inline-flex items-baseline gap-2 flex-wrap">
      <span className={`font-bold num ${sizes[size]}`}>{money(price)}</span>
      {off > 0 && (
        <>
          <span className="text-muted line-through text-sm num">{money(was)}</span>
          {size !== "sm" && (
            <span className="text-accent text-sm font-semibold">-{off}%</span>
          )}
        </>
      )}
    </span>
  );
};

/* ---------- quantity ---------- */
export const QtyStepper = ({ value, onChange, max = 99, small = false }) => (
  <div
    className={`inline-flex items-center border border-line rounded-lg bg-white ${small ? "h-9" : "h-11"}`}
  >
    <button
      type="button"
      onClick={() => onChange(Math.max(1, value - 1))}
      disabled={value <= 1}
      className="w-9 h-full grid place-items-center text-ink-2 hover:bg-surface rounded-l-lg disabled:opacity-40"
      aria-label="Decrease quantity"
    >
      <FiMinus size={14} />
    </button>
    <span className="w-9 text-center text-sm font-semibold num" aria-live="polite">
      {value}
    </span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="w-9 h-full grid place-items-center text-ink-2 hover:bg-surface rounded-r-lg disabled:opacity-40"
      aria-label="Increase quantity"
    >
      <FiPlus size={14} />
    </button>
  </div>
);

/* ---------- layout bits ---------- */
export const SectionHead = ({ title, subtitle, to, linkText = "View all", children }) => (
  <div className="flex items-end justify-between gap-4 mb-5">
    <div>
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-slate mt-1">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-3 shrink-0">
      {children}
      {to && (
        <Link
          to={to}
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-link hover:underline"
        >
          {linkText} <FiChevronRight size={16} />
        </Link>
      )}
    </div>
  </div>
);

export const Breadcrumbs = ({ items }) => (
  <nav aria-label="Breadcrumb" className="text-sm text-slate flex flex-wrap items-center gap-1.5 py-4">
    {items.map((it, i) => (
      <span key={i} className="inline-flex items-center gap-1.5">
        {i > 0 && <FiChevronRight size={14} className="text-muted" />}
        {it.to ? (
          <Link to={it.to} className="hover:text-ink hover:underline">
            {it.label}
          </Link>
        ) : (
          <span className="text-ink font-medium">{it.label}</span>
        )}
      </span>
    ))}
  </nav>
);

export const Empty = ({ icon, title, text, action }) => (
  <div className="text-center py-16 px-4">
    {icon && (
      <div className="mx-auto w-14 h-14 rounded-full bg-surface grid place-items-center text-slate mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-bold">{title}</h3>
    {text && <p className="text-slate mt-1 max-w-sm mx-auto">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Spinner = ({ className = "" }) => (
  <span
    className={`inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
    role="status"
    aria-label="Loading"
  />
);

export const PageLoader = () => (
  <div className="min-h-[50vh] grid place-items-center text-slate">
    <Spinner className="w-7 h-7" />
  </div>
);

export const Badge = ({ tone = "neutral", children }) => {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    red: "bg-accent text-white",
    soft: "bg-accent-soft text-accent",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    dark: "bg-ink text-white",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
};

export const StatusBadge = ({ status }) => {
  const tone =
    status === "Delivered" ? "ok" : status === "Cancelled" ? "soft" : status === "Processing" ? "warn" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
};

/* ---------- overlays ---------- */
const Overlay = ({ open, onClose, children, align = "center", z = 70 }) => {
  useLockScroll(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: z }}>
      <div className="absolute inset-0 bg-ink/50 anim-fade" onClick={onClose} aria-hidden="true" />
      <div
        className={`absolute inset-0 flex pointer-events-none ${
          align === "right" ? "justify-end" : align === "left" ? "justify-start" : "items-center justify-center p-4"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export const Modal = ({ open, onClose, title, children, wide = false }) => (
  <Overlay open={open} onClose={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`pointer-events-auto bg-white rounded-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto anim-pop`}
    >
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-surface" aria-label="Close">
          <FiX size={20} />
        </button>
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  </Overlay>
);

export const Drawer = ({ open, onClose, title, children, side = "right", footer }) => (
  <Overlay open={open} onClose={onClose} align={side} z={80}>
    <aside
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`pointer-events-auto bg-white h-full w-full max-w-[420px] flex flex-col ${side === "right" ? "anim-right" : "anim-left"}`}
    >
      <div className="flex items-center justify-between px-5 h-16 border-b border-line shrink-0">
        <h3 className="text-lg font-bold">{title}</h3>
        <button onClick={onClose} className="p-2 -mr-2 rounded-lg hover:bg-surface" aria-label="Close">
          <FiX size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="border-t border-line p-5 shrink-0">{footer}</div>}
    </aside>
  </Overlay>
);

/* ---------- countdown ---------- */
const parts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    done: s === 0,
  };
};

export const Countdown = ({ to, compact = false }) => {
  const [t, setT] = useState(() => parts(new Date(to) - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setT(parts(new Date(to) - Date.now())), 1000);
    return () => clearInterval(id);
  }, [to]);
  if (t.done) return <span className="text-sm font-semibold text-slate">Ended</span>;
  const cells = [
    ["d", t.d],
    ["h", t.h],
    ["m", t.m],
    ["s", t.s],
  ].filter(([k]) => k !== "d" || t.d > 0);
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Time remaining">
      {cells.map(([k, v]) => (
        <span
          key={k}
          className={`inline-flex items-baseline gap-0.5 rounded-md bg-ink text-white num font-bold ${compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm"}`}
        >
          {String(v).padStart(2, "0")}
          <span className="text-[10px] font-medium opacity-70">{k}</span>
        </span>
      ))}
    </span>
  );
};
