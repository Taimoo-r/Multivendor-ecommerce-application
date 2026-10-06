import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FiExternalLink, FiImage, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { Badge, Empty, Img, PageLoader, Rating, Spinner } from "../../components/ui/primitives";
import { errMsg } from "../../lib/api";
import { CATEGORIES } from "../../lib/constants";
import { money, shortDate } from "../../lib/format";
import {
  useCreateEventMutation,
  useCreateProductMutation,
  useDeleteEventMutation,
  useDeleteProductMutation,
  useGetSellerProductsQuery,
  useGetShopEventsQuery,
} from "../../store/api";

const Head = ({ title, text, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {text && <p className="text-sm text-slate mt-1">{text}</p>}
    </div>
    {children}
  </div>
);

// Multi-image picker with previews. `files` is a File[]; max 6 images of up to 5MB.
const ImagePicker = ({ files, onChange }) => {
  const input = useRef(null);
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach(URL.revokeObjectURL);
  }, [files]);

  const add = (list) => {
    const picked = [...list].filter((f) => f.type.startsWith("image/"));
    if (picked.some((f) => f.size > 5 * 1024 * 1024)) toast.error("Images must be 5MB or smaller");
    const ok = picked.filter((f) => f.size <= 5 * 1024 * 1024);
    onChange([...files, ...ok].slice(0, 6));
  };

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {urls.map((u, i) => (
          <div key={u} className="relative aspect-square rounded-xl overflow-hidden bg-surface group">
            <img src={u} alt="" className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute bottom-1.5 left-1.5 badge bg-ink text-white">Main</span>}
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/95 grid place-items-center hover:text-accent" aria-label="Remove image">
              <FiX size={14} />
            </button>
          </div>
        ))}
        {files.length < 6 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              add(e.dataTransfer.files);
            }}
            className="aspect-square rounded-xl border-2 border-dashed border-line hover:border-ink grid place-items-center text-slate text-xs font-semibold"
          >
            <span className="grid place-items-center gap-1"><FiImage size={22} /> Add</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <p className="hint">Up to 6 images, 5MB each. The first one is the main photo.</p>
    </div>
  );
};

const useSellerId = () => useSelector((s) => s.seller.seller._id);

/* ---------- products ---------- */
export function ProductsList() {
  const { data: products = [], isLoading: loading } = useGetSellerProductsQuery(useSellerId());
  const [deleteProduct, { isLoading: deletingAny, originalArgs: deleting }] = useDeleteProductMutation();

  // the mutation invalidates this list and the public catalogue, so both refetch
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try {
      await deleteProduct(p._id).unwrap();
      toast.success("Product deleted");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (loading) return <PageLoader />;
  return (
    <div>
      <Head title="Products" text={`${products.length} products in your shop`}>
        <Link to="/dashboard/products/new" className="btn btn-primary"><FiPlus /> Add product</Link>
      </Head>
      {products.length === 0 ? (
        <div className="card"><Empty title="No products yet" text="Add your first product to start selling." action={<Link to="/dashboard/products/new" className="btn btn-primary">Add product</Link>} /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted border-b border-line bg-surface/60">
              <th className="font-semibold px-5 py-2.5">Product</th>
              <th className="font-semibold px-3 py-2.5">Price</th>
              <th className="font-semibold px-3 py-2.5">Stock</th>
              <th className="font-semibold px-3 py-2.5 hidden md:table-cell">Sold</th>
              <th className="font-semibold px-3 py-2.5 hidden lg:table-cell">Rating</th>
              <th className="px-5 py-2.5" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => (
                <tr key={p._id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <Img sizes="44px" name={p.images?.[0]} alt="" className="w-11 h-11 rounded-lg object-cover bg-surface shrink-0" />
                      <div className="min-w-0"><p className="font-semibold truncate max-w-[280px]">{p.name}</p><p className="text-xs text-muted">{p.category}</p></div>
                    </div>
                  </td>
                  <td className="px-3 py-3 num"><b>{money(p.discountPrice)}</b>{p.originalPrice > p.discountPrice && <span className="text-muted line-through ml-1.5">{money(p.originalPrice)}</span>}</td>
                  <td className="px-3 py-3 num">{p.stock === 0 ? <Badge tone="soft">Out</Badge> : p.stock <= 5 ? <Badge tone="warn">{p.stock} left</Badge> : p.stock}</td>
                  <td className="px-3 py-3 num text-slate hidden md:table-cell">{p.sold_out}</td>
                  <td className="px-3 py-3 hidden lg:table-cell">{p.ratings ? <Rating value={p.ratings} count={p.reviewCount} /> : <span className="text-muted">–</span>}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Link to={`/product/${p._id}`} className="inline-grid w-9 h-9 place-items-center rounded-lg text-muted hover:text-ink hover:bg-surface" aria-label={`View ${p.name}`}><FiExternalLink size={16} /></Link>
                    <button onClick={() => remove(p)} disabled={deletingAny && deleting === p._id} className="w-9 h-9 rounded-lg text-muted hover:text-accent hover:bg-surface" aria-label={`Delete ${p.name}`}>{deletingAny && deleting === p._id ? <Spinner className="w-4 h-4" /> : <FiTrash2 size={16} />}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Field = ({ label, id, hint, children, className = "" }) => (
  <div className={className}>
    <label className="label" htmlFor={id}>{label}</label>
    {children}
    {hint && <p className="hint">{hint}</p>}
  </div>
);

export function CreateProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", category: "", description: "", tags: "", originalPrice: "", discountPrice: "", stock: "" });
  const [files, setFiles] = useState([]);
  const [createProduct, { isLoading: busy }] = useCreateProductMutation();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length) return toast.error("Please add at least one image");
    if (form.originalPrice && Number(form.originalPrice) < Number(form.discountPrice)) {
      return toast.error("The original price can't be lower than the sale price");
    }
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== "" && body.append(k, v));
      files.forEach((f) => body.append("images", f));
      await createProduct(body).unwrap();
      toast.success("Product created");
      navigate("/dashboard/products");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="max-w-3xl">
      <Head title="Add a product" text="Good photos and a clear description sell products." />
      <form onSubmit={submit} className="card p-6 grid sm:grid-cols-2 gap-5">
        <Field label="Product name" id="pname" className="sm:col-span-2"><input id="pname" required className="field" value={form.name} onChange={set("name")} /></Field>
        <Field label="Category" id="pcat">
          <select id="pcat" required className="field" value={form.category} onChange={set("category")}>
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Tags" id="ptags" hint="Comma separated, helps search"><input id="ptags" className="field" value={form.tags} onChange={set("tags")} placeholder="wireless, bluetooth" /></Field>
        <Field label="Description" id="pdesc" className="sm:col-span-2" hint="Use a new line for each paragraph.">
          <textarea id="pdesc" required rows={6} className="field" value={form.description} onChange={set("description")} />
        </Field>
        <Field label="Original price ($)" id="pop" hint="Optional. Shown crossed out"><input id="pop" type="number" min="0" step="0.01" className="field num" value={form.originalPrice} onChange={set("originalPrice")} /></Field>
        <Field label="Sale price ($)" id="pdp"><input id="pdp" required type="number" min="0.01" step="0.01" className="field num" value={form.discountPrice} onChange={set("discountPrice")} /></Field>
        <Field label="Stock" id="pst"><input id="pst" required type="number" min="0" className="field num" value={form.stock} onChange={set("stock")} /></Field>
        <div className="sm:col-span-2"><span className="label">Images</span><ImagePicker files={files} onChange={setFiles} /></div>
        <div className="sm:col-span-2 flex justify-end gap-3 pt-2 border-t border-line">
          <Link to="/dashboard/products" className="btn btn-outline">Cancel</Link>
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Create product"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- live sales ---------- */
export function EventsList() {
  const { data: events = [], isLoading: loading } = useGetShopEventsQuery(useSellerId());
  const [deleteEvent, { isLoading: deletingAny, originalArgs: deleting }] = useDeleteEventMutation();

  const remove = async (ev) => {
    if (!window.confirm(`Delete "${ev.name}"?`)) return;
    try {
      await deleteEvent(ev._id).unwrap();
      toast.success("Sale deleted");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (loading) return <PageLoader />;
  const tone = { Running: "ok", Upcoming: "warn", Ended: "neutral" };
  return (
    <div>
      <Head title="Live sales" text="Limited-time, limited-stock deals shown on the Live sales page.">
        <Link to="/dashboard/events/new" className="btn btn-primary"><FiPlus /> New sale</Link>
      </Head>
      {events.length === 0 ? (
        <div className="card"><Empty title="No sales yet" text="Run a flash sale to drive traffic to your shop." action={<Link to="/dashboard/events/new" className="btn btn-primary">Create a sale</Link>} /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <article key={ev._id} className="card p-4 flex gap-4">
              <Img sizes="96px" name={ev.images?.[0]} alt="" className="w-24 h-24 rounded-xl object-cover bg-surface shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-snug line-clamp-2">{ev.name}</h3>
                  <Badge tone={tone[ev.status]}>{ev.status}</Badge>
                </div>
                <p className="text-sm mt-1 num"><b>{money(ev.discountPrice)}</b> <span className="text-muted line-through">{money(ev.originalPrice)}</span> · {ev.stock} left</p>
                <p className="text-xs text-slate mt-1">{shortDate(ev.start_Date)} → {shortDate(ev.Finish_Date)}</p>
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <Link to={`/product/${ev._id}`} className="text-link font-semibold hover:underline">View</Link>
                  <button onClick={() => remove(ev)} disabled={deletingAny && deleting === ev._id} className="text-accent font-semibold hover:underline">{deletingAny && deleting === ev._id ? "Deleting…" : "Delete"}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const localInput = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function CreateEvent() {
  const navigate = useNavigate();
  const now = new Date();
  const [form, setForm] = useState({
    name: "", category: "", description: "", originalPrice: "", discountPrice: "", stock: "",
    start_Date: localInput(now), Finish_Date: localInput(new Date(now.getTime() + 7 * 864e5)),
  });
  const [files, setFiles] = useState([]);
  const [createEvent, { isLoading: busy }] = useCreateEventMutation();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length) return toast.error("Please add at least one image");
    if (new Date(form.Finish_Date) <= new Date(form.start_Date)) return toast.error("The sale must end after it starts");
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== "" && body.append(k, k.endsWith("_Date") ? new Date(v).toISOString() : v));
      files.forEach((f) => body.append("images", f));
      await createEvent(body).unwrap();
      toast.success("Sale created");
      navigate("/dashboard/events");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="max-w-3xl">
      <Head title="Create a live sale" text="A limited-time deal with its own price and stock." />
      <form onSubmit={submit} className="card p-6 grid sm:grid-cols-2 gap-5">
        <Field label="Sale name" id="en" className="sm:col-span-2"><input id="en" required className="field" value={form.name} onChange={set("name")} placeholder="Weekend flash sale: headphones" /></Field>
        <Field label="Category" id="ec">
          <select id="ec" required className="field" value={form.category} onChange={set("category")}>
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Stock for this sale" id="es"><input id="es" required type="number" min="1" className="field num" value={form.stock} onChange={set("stock")} /></Field>
        <Field label="Description" id="ed" className="sm:col-span-2"><textarea id="ed" required rows={4} className="field" value={form.description} onChange={set("description")} /></Field>
        <Field label="Regular price ($)" id="eo"><input id="eo" type="number" min="0" step="0.01" className="field num" value={form.originalPrice} onChange={set("originalPrice")} /></Field>
        <Field label="Sale price ($)" id="ep"><input id="ep" required type="number" min="0.01" step="0.01" className="field num" value={form.discountPrice} onChange={set("discountPrice")} /></Field>
        <Field label="Starts" id="e1"><input id="e1" required type="datetime-local" className="field" value={form.start_Date} onChange={set("start_Date")} /></Field>
        <Field label="Ends" id="e2"><input id="e2" required type="datetime-local" className="field" value={form.Finish_Date} onChange={set("Finish_Date")} /></Field>
        <div className="sm:col-span-2"><span className="label">Images</span><ImagePicker files={files} onChange={setFiles} /></div>
        <div className="sm:col-span-2 flex justify-end gap-3 pt-2 border-t border-line">
          <Link to="/dashboard/events" className="btn btn-outline">Cancel</Link>
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : "Create sale"}</button>
        </div>
      </form>
    </div>
  );
}
