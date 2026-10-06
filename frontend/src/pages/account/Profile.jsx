import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FiCamera, FiHeart, FiLock, FiLogOut, FiMapPin, FiPackage, FiPlus, FiUser, FiCheck } from "react-icons/fi";
import { Breadcrumbs, Empty, Img, Modal, PageLoader, Spinner, StatusBadge } from "../../components/ui/primitives";
import { api, errMsg } from "../../lib/api";
import { ORDER_STEPS } from "../../lib/constants";
import { money, moneyExact, shortDate } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { logoutUser, setUser } from "../../store/auth";
import { useCancelOrderMutation, useGetMyOrdersQuery } from "../../store/api";

/* ---------- profile ---------- */
function ProfileTab() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phoneNumber ? String(user.phoneNumber) : "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const input = useRef(null);
  const emailChanged = email.trim().toLowerCase() !== user.email;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/user/update-user-info", {
        name,
        phoneNumber: phone.trim(),
        ...(emailChanged ? { email, password } : {}),
      });
      dispatch(setUser(data.user));
      setPassword("");
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const changeAvatar = async (file) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const { data } = await api.put("/user/update-avatar", body);
      dispatch(setUser(data.user));
      toast.success("Photo updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Profile</h2>
      <div className="flex items-center gap-5 mb-8">
        <div className="relative">
          <Img sizes="80px" name={user.avatar} alt="" className="w-20 h-20 rounded-full object-cover bg-surface" />
          <button
            onClick={() => input.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ink text-white grid place-items-center border-2 border-white"
            aria-label="Change photo"
            disabled={avatarBusy}
          >
            {avatarBusy ? <Spinner className="w-4 h-4" /> : <FiCamera size={14} />}
          </button>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />
        </div>
        <div>
          <p className="font-bold text-lg">{user.name}</p>
          <p className="text-sm text-slate">Member since {shortDate(user.createdAt)}</p>
        </div>
      </div>

      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
        <div>
          <label className="label" htmlFor="pn">Full name</label>
          <input id="pn" className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pp">Phone number</label>
          <input id="pp" className="field num" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+1 555 123 4567" autoComplete="tel" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pe">Email</label>
          <input id="pe" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {emailChanged && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ppw">Current password</label>
            <input id="ppw" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            <p className="hint">Needed to confirm the change of email.</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- orders ---------- */
const Tracker = ({ order }) => {
  if (order.status === "Cancelled") {
    return <p className="text-sm text-accent font-semibold">This order was cancelled.</p>;
  }
  const at = Object.fromEntries((order.statusHistory || []).map((h) => [h.status, h.at]));
  const current = ORDER_STEPS.indexOf(order.status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {ORDER_STEPS.map((s, i) => (
        <li key={s} className="text-center">
          <div className="flex items-center">
            <span className={`flex-1 h-0.5 ${i === 0 ? "opacity-0" : i <= current ? "bg-ink" : "bg-line"}`} />
            <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${i <= current ? "bg-ink text-white" : "bg-surface-2 text-muted"}`}>
              {i <= current ? <FiCheck size={13} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
            </span>
            <span className={`flex-1 h-0.5 ${i === ORDER_STEPS.length - 1 ? "opacity-0" : i < current ? "bg-ink" : "bg-line"}`} />
          </div>
          <p className={`mt-2 text-[11px] sm:text-xs leading-tight ${i <= current ? "font-semibold text-ink" : "text-muted"}`}>{s}</p>
          {at[s] && <p className="text-[10px] text-muted mt-0.5 hidden sm:block">{shortDate(at[s])}</p>}
        </li>
      ))}
    </ol>
  );
};

function OrdersTab() {
  const user = useSelector((s) => s.auth.user);
  const { data: orders, isError } = useGetMyOrdersQuery(user._id);
  const [cancelOrder, { isLoading: cancellingAny, originalArgs: cancellingId }] = useCancelOrderMutation();
  const cancelling = cancellingAny ? cancellingId : null;
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);

  const cancel = async (o) => {
    if (!window.confirm(`Cancel order ${o.orderRef}?`)) return;
    try {
      await cancelOrder(o._id).unwrap();
      toast.success("Order cancelled");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (isError) return <Empty title="Couldn't load your orders" text="Refresh the page to try again." />;
  if (!orders) return <PageLoader />;

  const filters = [
    ["all", "All"],
    ["active", "In progress"],
    ["Delivered", "Delivered"],
    ["Cancelled", "Cancelled"],
  ];
  const isActive = (o) => !["Delivered", "Cancelled"].includes(o.status);
  const shown = orders.filter((o) => (filter === "all" ? true : filter === "active" ? isActive(o) : o.status === filter));

  return (
    <div>
      <h2 className="text-xl font-bold mb-5">My orders</h2>
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
        {filters.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap border ${filter === k ? "bg-ink text-white border-ink" : "bg-white border-line hover:border-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty icon={<FiPackage size={24} />} title="No orders here" text="When you place an order it will show up here." action={<Link to="/products" className="btn btn-primary">Start shopping</Link>} />
      ) : (
        <ul className="space-y-4">
          {shown.map((o) => {
            const expanded = open === o._id;
            return (
              <li key={o._id} className="card overflow-hidden">
                <button onClick={() => setOpen(expanded ? null : o._id)} className="w-full text-left p-4 sm:p-5 flex flex-wrap items-center gap-x-6 gap-y-2" aria-expanded={expanded}>
                  <div className="flex -space-x-2">
                    {o.cart.slice(0, 3).map((l) => (
                      <Img sizes="48px" key={l.productId} name={l.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-surface border-2 border-white" />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold num">{o.orderRef}</p>
                    <p className="text-xs text-slate">{shortDate(o.createdAt)} · {o.shop?.name}</p>
                  </div>
                  <StatusBadge status={o.status} />
                  <p className="ml-auto font-bold num">{moneyExact(o.totalPrice)}</p>
                </button>

                {expanded && (
                  <div className="border-t border-line p-4 sm:p-5 space-y-6 anim-fade">
                    <Tracker order={o} />
                    <ul className="divide-y divide-line border border-line rounded-xl px-4">
                      {o.cart.map((l) => (
                        <li key={l.productId} className="flex items-center gap-3 py-3">
                          <Img sizes="56px" name={l.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-surface" />
                          <div className="flex-1 min-w-0">
                            <Link to={`/product/${l.productId}`} className="text-sm font-semibold hover:underline line-clamp-2">{l.name}</Link>
                            <p className="text-xs text-slate num">{money(l.price)} × {l.qty}</p>
                          </div>
                          {o.status === "Delivered" && l.kind !== "Event" && (
                            <Link to={`/product/${l.productId}`} className="btn btn-outline btn-sm">Write a review</Link>
                          )}
                          <span className="text-sm font-semibold num w-20 text-right">{money(l.price * l.qty)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="grid sm:grid-cols-2 gap-6 text-sm">
                      <div>
                        <h4 className="font-bold mb-1.5">Delivery address</h4>
                        <p className="text-slate leading-relaxed">
                          {o.user?.name}<br />
                          {o.shippingAddress.address1}{o.shippingAddress.address2 ? `, ${o.shippingAddress.address2}` : ""}<br />
                          {o.shippingAddress.city}, {o.shippingAddress.zipCode}<br />{o.shippingAddress.country}
                        </p>
                        <h4 className="font-bold mt-4 mb-1.5">Payment</h4>
                        <p className="text-slate">{o.paymentInfo?.type} · {o.paymentInfo?.status}</p>
                      </div>
                      <dl className="space-y-2 num">
                        <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd>{moneyExact(o.subTotal ?? o.totalPrice)}</dd></div>
                        {o.discount > 0 && <div className="flex justify-between text-ok"><dt>Discount {o.couponCode && `(${o.couponCode})`}</dt><dd>-{moneyExact(o.discount)}</dd></div>}
                        <div className="flex justify-between"><dt className="text-slate">Shipping</dt><dd>{o.shipping ? moneyExact(o.shipping) : "Free"}</dd></div>
                        <div className="flex justify-between pt-2 border-t border-line font-bold text-base"><dt>Total</dt><dd>{moneyExact(o.totalPrice)}</dd></div>
                      </dl>
                    </div>
                    {o.status === "Processing" && (
                      <button onClick={() => cancel(o)} disabled={cancelling === o._id} className="btn btn-outline btn-sm text-accent">
                        {cancelling === o._id ? <Spinner /> : "Cancel order"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- addresses ---------- */
const TYPES = ["Home", "Office", "Default"];

function AddressesTab() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [editing, setEditing] = useState(null); // null | {} (new) | address
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/user/update-user-addresses", editing);
      dispatch(setUser(data.user));
      toast.success("Address saved");
      setEditing(null);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete your ${a.addressType} address?`)) return;
    try {
      const { data } = await api.delete(`/user/delete-user-address/${a._id}`);
      dispatch(setUser(data.user));
      toast.success("Address deleted");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const f = (k) => ({
    value: editing?.[k] || "",
    onChange: (e) => setEditing((a) => ({ ...a, [k]: e.target.value })),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Addresses</h2>
        <button onClick={() => setEditing({ country: "United States", addressType: TYPES.find((t) => !user.addresses.some((a) => a.addressType === t)) || "Default" })} className="btn btn-primary btn-sm">
          <FiPlus /> Add address
        </button>
      </div>
      {user.addresses.length === 0 ? (
        <Empty icon={<FiMapPin size={24} />} title="No saved addresses" text="Save an address to check out faster." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {user.addresses.map((a) => (
            <div key={a._id} className="card p-5 text-sm">
              <p className="font-bold">{a.addressType}</p>
              <p className="text-slate mt-2 leading-relaxed">
                {a.address1}{a.address2 ? `, ${a.address2}` : ""}<br />{a.city}, {a.zipCode}<br />{a.country}
              </p>
              <div className="flex gap-4 mt-4 text-[13px] font-semibold">
                <button onClick={() => setEditing(a)} className="text-link hover:underline">Edit</button>
                <button onClick={() => remove(a)} className="text-accent hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? "Edit address" : "Add address"}>
        {editing && (
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label" htmlFor="at">Label</label>
              <select id="at" className="field" {...f("addressType")} disabled={!!editing._id}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label" htmlFor="ad1">Address</label><input id="ad1" required className="field" {...f("address1")} /></div>
            <div className="col-span-2"><label className="label" htmlFor="ad2">Apartment, suite (optional)</label><input id="ad2" className="field" {...f("address2")} /></div>
            <div><label className="label" htmlFor="adc">City</label><input id="adc" required className="field" {...f("city")} /></div>
            <div><label className="label" htmlFor="adz">Postal code</label><input id="adz" required className="field" {...f("zipCode")} /></div>
            <div className="col-span-2"><label className="label" htmlFor="adco">Country</label><input id="adco" required className="field" {...f("country")} /></div>
            <div className="col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-outline">Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Save address"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ---------- security ---------- */
function SecurityTab() {
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/user/update-user-password", form);
      toast.success(
        data.signedOut
          ? `Password updated. ${data.signedOut} other ${data.signedOut === 1 ? "session was" : "sessions were"} signed out.`
          : "Password updated"
      );
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Password</h2>
      <form onSubmit={save} className="space-y-4 max-w-md">
        <div><label className="label" htmlFor="op">Current password</label><input id="op" type="password" required className="field" value={form.oldPassword} onChange={set("oldPassword")} autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="np">New password</label><input id="np" type="password" required minLength={8} className="field" value={form.newPassword} onChange={set("newPassword")} autoComplete="new-password" /><p className="hint">At least 8 characters</p></div>
        <div><label className="label" htmlFor="cp">Confirm new password</label><input id="cp" type="password" required className="field" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Update password"}</button>
      </form>
    </div>
  );
}

/* ---------- page ---------- */
const TABS = [
  ["profile", "Profile", FiUser],
  ["orders", "Orders", FiPackage],
  ["addresses", "Addresses", FiMapPin],
  ["security", "Password", FiLock],
];

export default function Profile() {
  useTitle("My account");
  const [params, setParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const tab = TABS.some(([k]) => k === params.get("tab")) ? params.get("tab") : "profile";

  const logout = async () => {
    await dispatch(logoutUser());
    toast.success("Signed out");
    navigate("/");
  };

  const link = "flex items-center gap-3 px-3.5 h-11 rounded-lg text-sm font-semibold w-full text-left whitespace-nowrap";
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "My account" }]} />
      <div className="grid lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
        <nav aria-label="Account" className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar lg:overflow-visible h-fit lg:sticky lg:top-40">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setParams({ tab: k })} aria-current={tab === k} className={`${link} ${tab === k ? "bg-ink text-white" : "hover:bg-surface text-ink-2"}`}>
              <Icon size={17} /> {label}
            </button>
          ))}
          <Link to="/wishlist" className={`${link} hover:bg-surface text-ink-2`}><FiHeart size={17} /> Wishlist</Link>
          <button onClick={logout} className={`${link} hover:bg-surface text-accent lg:mt-3 lg:border-t lg:border-line lg:rounded-none lg:pt-3`}><FiLogOut size={17} /> Sign out</button>
        </nav>
        <div className="min-w-0 pb-6">
          {tab === "profile" && <ProfileTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "addresses" && <AddressesTab />}
          {tab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
