import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FiAlertCircle, FiCamera, FiPlus, FiTrash2 } from "react-icons/fi";
import { Empty, Img, Modal, PageLoader, Spinner, StatusBadge } from "../../components/ui/primitives";
import { api, errMsg } from "../../lib/api";
import { ORDER_STEPS } from "../../lib/constants";
import { compact, money, moneyExact, shortDate } from "../../lib/format";
import { useCatalog } from "../../lib/hooks";
import { setSeller } from "../../store/auth";

const Head = ({ title, text, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {text && <p className="text-sm text-slate mt-1">{text}</p>}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, sub, tone }) => (
  <div className="card p-5">
    <p className="text-sm text-slate">{label}</p>
    <p className={`text-3xl font-bold mt-2 num ${tone === "accent" ? "text-accent" : ""}`}>{value}</p>
    {sub && <p className="text-xs text-muted mt-1.5">{sub}</p>}
  </div>
);

/* ---------- overview ---------- */
const RevenueChart = ({ months }) => {
  const max = Math.max(...months.map((m) => m.revenue), 1);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step || 100;
  return (
    <div role="img" aria-label="Revenue over the last six months" className="relative h-52 pl-10">
      {[1, 0.5, 0].map((t) => (
        <div key={t} className="absolute left-0 right-0 flex items-center" style={{ bottom: `calc(28px + (100% - 28px) * ${t})`, transform: "translateY(50%)" }}>
          <span className="w-9 pr-2 text-right text-[11px] text-muted num">{compact(top * t)}</span>
          <span className="flex-1 border-t border-line" />
        </div>
      ))}
      <div className="absolute left-10 right-0 top-0 bottom-0 flex items-end gap-2 sm:gap-4">
        {months.map((m, i) => (
          <div key={m.key} className="flex-1 h-full flex flex-col justify-end items-center group" title={`${m.label}: ${moneyExact(m.revenue)} from ${m.orders} orders`}>
            <span className="mb-1 text-[11px] font-semibold num opacity-0 group-hover:opacity-100 transition">{m.revenue ? money(m.revenue) : ""}</span>
            <div
              className={`w-full max-w-[56px] rounded-t-md transition ${i === months.length - 1 ? "bg-accent" : "bg-ink group-hover:bg-ink-2"}`}
              style={{ height: `calc((100% - 48px) * ${m.revenue / top})`, minHeight: m.revenue ? 4 : 2 }}
            />
            <span className="h-7 pt-2 text-xs text-slate">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function Overview() {
  const { seller } = useSelector((s) => s.seller);
  const { products } = useCatalog();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/order/seller-stats").then(({ data }) => setStats(data.stats)).catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!stats) return <PageLoader />;
  const low = products.filter((p) => p.shopId === seller._id && p.stock <= 5).sort((a, b) => a.stock - b.stock);

  return (
    <div>
      <Head title={`Welcome back, ${seller.name}`} text="Here's how your shop is doing.">
        <Link to="/dashboard/products/new" className="btn btn-primary"><FiPlus /> Add product</Link>
      </Head>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Revenue (delivered)" value={money(stats.revenue)} sub="Before the 10% marketplace fee" />
        <Stat label="Available balance" value={money(stats.balance)} sub="Paid out after delivery" />
        <Stat label="Orders" value={stats.orders} sub={`${stats.delivered} delivered`} />
        <Stat label="Needs action" value={stats.pending} sub="Processing or packed" tone={stats.pending ? "accent" : undefined} />
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4 mt-4">
        <section className="card p-5">
          <h2 className="font-bold">Revenue, last 6 months</h2>
          <div className="mt-4"><RevenueChart months={stats.months} /></div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Catalogue</h2>
          <dl className="grid grid-cols-3 gap-3 mt-4 text-center num">
            {[["Products", stats.products], ["Sales", stats.events], ["Coupons", stats.coupons]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-surface py-3"><dd className="text-2xl font-bold">{v}</dd><dt className="text-xs text-slate">{l}</dt></div>
            ))}
          </dl>
          <h3 className="text-sm font-bold mt-5 mb-2 flex items-center gap-1.5"><FiAlertCircle className="text-warn" /> Low stock</h3>
          {low.length === 0 ? (
            <p className="text-sm text-slate">Everything is well stocked.</p>
          ) : (
            <ul className="space-y-2">
              {low.slice(0, 4).map((p) => (
                <li key={p._id} className="flex items-center gap-3 text-sm">
                  <Img name={p.images?.[0]} alt="" className="w-9 h-9 rounded-md object-cover bg-surface" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className={`font-bold num ${p.stock === 0 ? "text-accent" : "text-warn"}`}>{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-bold">Recent orders</h2>
          <Link to="/dashboard/orders" className="text-sm font-semibold text-link hover:underline">View all</Link>
        </div>
        <OrdersTable orders={stats.recent} />
      </section>
    </div>
  );
}

/* ---------- orders ---------- */
function OrdersTable({ orders, onOpen }) {
  if (!orders.length) return <p className="px-5 pb-6 text-sm text-slate">No orders yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted border-y border-line bg-surface/60">
            <th className="font-semibold px-5 py-2.5">Order</th>
            <th className="font-semibold px-3 py-2.5 hidden sm:table-cell">Customer</th>
            <th className="font-semibold px-3 py-2.5 hidden sm:table-cell">Date</th>
            <th className="font-semibold px-3 py-2.5">Status</th>
            <th className="font-semibold px-5 py-2.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o._id} onClick={onOpen ? () => onOpen(o) : undefined} className={onOpen ? "cursor-pointer hover:bg-surface/70" : ""}>
              <td className="px-5 py-3 font-semibold num whitespace-nowrap">
                {o.orderRef}
                <span className="block sm:hidden text-xs font-normal text-slate">{o.user?.name}</span>
              </td>
              <td className="px-3 py-3 hidden sm:table-cell">{o.user?.name}</td>
              <td className="px-3 py-3 text-slate hidden sm:table-cell">{shortDate(o.createdAt)}</td>
              <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={o.status} /></td>
              <td className="px-5 py-3 text-right font-semibold num whitespace-nowrap">{moneyExact(o.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Orders() {
  const { seller } = useSelector((s) => s.seller);
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api
        .get(`/order/get-seller-all-orders/${seller._id}`)
        .then(({ data }) => {
          setOrders(data.orders);
          setSelected((s) => (s ? data.orders.find((o) => o._id === s._id) || null : s));
        })
        .catch((e) => toast.error(errMsg(e))),
    [seller._id]
  );
  useEffect(() => {
    load();
  }, [load]);

  const update = async (order, status) => {
    setBusy(true);
    try {
      await api.put(`/order/update-order-status/${order._id}`, { status });
      toast.success(`Marked as ${status.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!orders) return <PageLoader />;
  const shown = orders.filter((o) => filter === "all" || (filter === "open" ? !["Delivered", "Cancelled"].includes(o.status) : o.status === filter));
  const next = (o) => ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];

  return (
    <div>
      <Head title="Orders" text={`${orders.length} orders in total`} />
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {[["all", "All"], ["open", "Open"], ["Delivered", "Delivered"], ["Cancelled", "Cancelled"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap border ${filter === k ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink"}`}>{l}</button>
        ))}
      </div>
      <div className="card overflow-hidden"><OrdersTable orders={shown} onOpen={setSelected} /></div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Order ${selected.orderRef}` : ""} wide>
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={selected.status} />
              <span className="text-sm text-slate">Placed {shortDate(selected.createdAt)} by <b className="text-ink">{selected.user?.name}</b></span>
            </div>
            <ul className="divide-y divide-line border border-line rounded-xl px-4">
              {selected.cart.map((l) => (
                <li key={l.productId} className="flex items-center gap-3 py-3">
                  <Img name={l.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-surface" />
                  <span className="flex-1 min-w-0 text-sm font-medium line-clamp-2">{l.name}</span>
                  <span className="text-sm text-slate num">×{l.qty}</span>
                  <span className="text-sm font-semibold num w-20 text-right">{money(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="grid sm:grid-cols-2 gap-5 text-sm">
              <div>
                <h4 className="font-bold mb-1">Ship to</h4>
                <p className="text-slate leading-relaxed">
                  {selected.user?.name}<br />{selected.shippingAddress.address1}{selected.shippingAddress.address2 ? `, ${selected.shippingAddress.address2}` : ""}<br />
                  {selected.shippingAddress.city}, {selected.shippingAddress.zipCode}<br />{selected.shippingAddress.country}
                  {selected.shippingAddress.phoneNumber && <><br />{selected.shippingAddress.phoneNumber}</>}
                </p>
              </div>
              <dl className="space-y-1.5 num">
                <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd>{moneyExact(selected.subTotal ?? selected.totalPrice)}</dd></div>
                {selected.discount > 0 && <div className="flex justify-between text-ok"><dt>Discount ({selected.couponCode})</dt><dd>-{moneyExact(selected.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-slate">Shipping</dt><dd>{selected.shipping ? moneyExact(selected.shipping) : "Free"}</dd></div>
                <div className="flex justify-between pt-2 border-t border-line font-bold text-base"><dt>Total</dt><dd>{moneyExact(selected.totalPrice)}</dd></div>
                <div className="flex justify-between text-xs"><dt className="text-slate">Payment</dt><dd>{selected.paymentInfo?.type} · {selected.paymentInfo?.status}</dd></div>
              </dl>
            </div>
            {!["Delivered", "Cancelled"].includes(selected.status) && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-line">
                {next(selected) && (
                  <button disabled={busy} onClick={() => update(selected, next(selected))} className="btn btn-primary">
                    {busy ? <Spinner /> : `Mark as ${next(selected).toLowerCase()}`}
                  </button>
                )}
                <button disabled={busy} onClick={() => window.confirm("Cancel this order and restock the items?") && update(selected, "Cancelled")} className="btn btn-outline text-accent">Cancel order</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- coupons ---------- */
export function Coupons() {
  const { seller } = useSelector((s) => s.seller);
  const { products } = useCatalog();
  const mine = products.filter((p) => p.shopId === seller._id);
  const [coupons, setCoupons] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", value: "10", minAmount: "", maxAmount: "", selectedProduct: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api.get(`/coupon/get-coupon/${seller._id}`).then(({ data }) => setCoupons(data.couponCodes)).catch((e) => toast.error(errMsg(e))),
    [seller._id]
  );
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/coupon/create-coupon-code", form);
      toast.success("Coupon created");
      setOpen(false);
      setForm({ name: "", value: "10", minAmount: "", maxAmount: "", selectedProduct: "" });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.name}?`)) return;
    try {
      await api.delete(`/coupon/delete-coupon/${c._id}`);
      toast.success("Coupon deleted");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (!coupons) return <PageLoader />;

  return (
    <div>
      <Head title="Coupons" text="Discount codes customers can use on your products.">
        <button onClick={() => setOpen(true)} className="btn btn-primary"><FiPlus /> New coupon</button>
      </Head>
      {coupons.length === 0 ? (
        <div className="card"><Empty title="No coupons yet" text="Create a code to reward loyal customers." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted border-b border-line bg-surface/60">
              <th className="font-semibold px-5 py-2.5">Code</th><th className="font-semibold px-3 py-2.5">Discount</th>
              <th className="font-semibold px-3 py-2.5 hidden sm:table-cell">Min. spend</th><th className="font-semibold px-3 py-2.5 hidden sm:table-cell">Max. discount</th>
              <th className="font-semibold px-3 py-2.5 hidden md:table-cell">Applies to</th><th className="px-5 py-2.5" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => (
                <tr key={c._id}>
                  <td className="px-5 py-3"><span className="font-mono font-bold bg-surface px-2 py-1 rounded-md">{c.name}</span></td>
                  <td className="px-3 py-3 font-semibold num">{c.value}% off</td>
                  <td className="px-3 py-3 text-slate num hidden sm:table-cell">{c.minAmount ? money(c.minAmount) : "–"}</td>
                  <td className="px-3 py-3 text-slate num hidden sm:table-cell">{c.maxAmount ? money(c.maxAmount) : "–"}</td>
                  <td className="px-3 py-3 text-slate hidden md:table-cell">{c.selectedProduct ? mine.find((p) => p._id === c.selectedProduct)?.name || "One product" : "All my products"}</td>
                  <td className="px-5 py-3 text-right"><button onClick={() => remove(c)} className="p-2 rounded-lg text-muted hover:text-accent hover:bg-surface" aria-label={`Delete ${c.name}`}><FiTrash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New coupon">
        <form onSubmit={create} className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label" htmlFor="cn">Code</label><input id="cn" required className="field uppercase" value={form.name} onChange={set("name")} placeholder="SUMMER15" /></div>
          <div><label className="label" htmlFor="cv">Discount (%)</label><input id="cv" required type="number" min="1" max="90" className="field num" value={form.value} onChange={set("value")} /></div>
          <div><label className="label" htmlFor="cm">Minimum spend ($)</label><input id="cm" type="number" min="0" className="field num" value={form.minAmount} onChange={set("minAmount")} placeholder="Optional" /></div>
          <div><label className="label" htmlFor="cx">Maximum discount ($)</label><input id="cx" type="number" min="0" className="field num" value={form.maxAmount} onChange={set("maxAmount")} placeholder="Optional" /></div>
          <div><label className="label" htmlFor="cp">Applies to</label>
            <select id="cp" className="field" value={form.selectedProduct} onChange={set("selectedProduct")}>
              <option value="">All my products</option>
              {mine.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex justify-end gap-3 mt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Create coupon"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ---------- settings ---------- */
export function Settings() {
  const dispatch = useDispatch();
  const { seller } = useSelector((s) => s.seller);
  const [form, setForm] = useState({
    name: seller.name,
    description: seller.description || "",
    address: seller.address,
    phoneNumber: String(seller.phoneNumber),
    zipCode: String(seller.zipCode),
  });
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const input = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/shop/update-seller-info", form);
      dispatch(setSeller(data.shop));
      toast.success("Shop updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const logo = async (file) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const { data } = await api.put("/shop/update-shop-avatar", body);
      dispatch(setSeller(data.shop));
      toast.success("Logo updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Head title="Shop settings" text="How your shop appears to customers." />
      <div className="card p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            <Img name={seller.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover bg-surface" />
            <button onClick={() => input.current?.click()} disabled={logoBusy} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ink text-white grid place-items-center border-2 border-white" aria-label="Change logo">
              {logoBusy ? <Spinner className="w-4 h-4" /> : <FiCamera size={14} />}
            </button>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => logo(e.target.files?.[0])} />
          </div>
          <div><p className="font-bold text-lg">{seller.name}</p><p className="text-sm text-slate">{seller.email}</p></div>
        </div>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="label" htmlFor="sn">Shop name</label><input id="sn" required className="field" value={form.name} onChange={set("name")} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="sd">Description</label><textarea id="sd" rows={4} className="field" value={form.description} onChange={set("description")} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="sa">Address</label><input id="sa" required className="field" value={form.address} onChange={set("address")} /></div>
          <div><label className="label" htmlFor="sp">Phone</label><input id="sp" required className="field num" value={form.phoneNumber} onChange={set("phoneNumber")} /></div>
          <div><label className="label" htmlFor="sz">Postal code</label><input id="sz" required className="field num" value={form.zipCode} onChange={set("zipCode")} /></div>
          <div className="sm:col-span-2"><button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Save changes"}</button></div>
        </form>
      </div>
    </div>
  );
}
