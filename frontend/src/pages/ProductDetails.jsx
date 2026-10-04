import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FaHeart } from "react-icons/fa";
import { FiHeart, FiPackage, FiRotateCcw, FiShield, FiShoppingBag, FiTruck } from "react-icons/fi";
import {
  Breadcrumbs,
  Countdown,
  Empty,
  Img,
  PageLoader,
  Price,
  QtyStepper,
  Rating,
  Stars,
} from "../components/ui/primitives";
import Row from "../components/product/Row";
import { api, errMsg } from "../lib/api";
import { FREE_SHIPPING_OVER } from "../lib/constants";
import { money, percentOff, timeAgo } from "../lib/format";
import { useAddToCart, useCatalog, useItemIndex, useTitle, useWishlist } from "../lib/hooks";
import { fetchCatalog } from "../store/catalog";

const ReviewForm = ({ product, onDone }) => {
  const dispatch = useDispatch();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error("Please choose a star rating");
    setBusy(true);
    try {
      await api.put("/product/create-new-review", { productId: product._id, rating, comment });
      toast.success("Thanks for your review!");
      await dispatch(fetchCatalog());
      onDone?.();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 mb-8 bg-surface border-transparent">
      <h4 className="font-bold">Rate this product</h4>
      <p className="text-sm text-slate">You've received this item, so your review is marked as a verified purchase.</p>
      <div className="flex gap-1 my-3" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            className="p-0.5"
          >
            <svg width="28" height="28" viewBox="0 0 24 24">
              <path
                d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z"
                fill={(hover || rating) >= n ? "#f5a524" : "#d9dee5"}
              />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder="What did you like or dislike? (optional)"
        className="field"
      />
      <button disabled={busy} className="btn btn-primary mt-3">
        {busy ? "Posting…" : "Post review"}
      </button>
    </form>
  );
};

const Reviews = ({ product, canReview }) => {
  const reviews = [...(product.reviews || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const count = reviews.length;
  const dist = [5, 4, 3, 2, 1].map((n) => [n, reviews.filter((r) => r.rating === n).length]);

  return (
    <div>
      {canReview && <ReviewForm product={product} />}
      {count === 0 ? (
        <p className="text-slate py-6">No reviews yet. Be the first once you've received it.</p>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-10">
          <div>
            <p className="text-5xl font-bold num">{(product.ratings || 0).toFixed(1)}</p>
            <div className="mt-1.5"><Stars value={product.ratings} /></div>
            <p className="text-sm text-slate mt-1.5 num">{count} review{count > 1 ? "s" : ""}</p>
            <div className="mt-5 space-y-1.5">
              {dist.map(([n, c]) => (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 num">{n}</span>
                  <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#f5a524]" style={{ width: `${(c / count) * 100}%` }} />
                  </div>
                  <span className="w-5 text-right text-muted num">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-line">
            {reviews.map((r, i) => (
              <li key={i} className="py-5 first:pt-0">
                <div className="flex items-center gap-3">
                  <Img name={r.user?.avatar} alt="" className="w-9 h-9 rounded-full object-cover bg-surface" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.user?.name || "Customer"}</p>
                    <p className="text-xs text-muted">Verified purchase · {timeAgo(r.createdAt)}</p>
                  </div>
                  <div className="ml-auto"><Stars value={r.rating} /></div>
                </div>
                {r.comment && <p className="text-[15px] mt-2.5 text-ink-2">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const index = useItemIndex();
  const { products, shops, status } = useCatalog();
  const user = useSelector((s) => s.auth.user);
  const add = useAddToCart();
  const wish = useWishlist();
  const item = index.get(id);

  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("description");
  const [canReview, setCanReview] = useState(false);

  useTitle(item?.name);
  useEffect(() => {
    setActive(0);
    setQty(1);
    setTab("description");
  }, [id]);

  // may this buyer review it? (they need a delivered order containing it)
  const itemId = item?._id;
  const itemKind = item?.kind;
  useEffect(() => {
    setCanReview(false);
    if (!user || !itemId || itemKind !== "Product") return;
    api
      .get(`/order/get-all-orders/${user._id}`)
      .then(({ data }) =>
        setCanReview(
          data.orders.some((o) => o.status === "Delivered" && o.cart.some((l) => l.productId === itemId))
        )
      )
      .catch(() => {});
  }, [user, itemId, itemKind]);

  const related = useMemo(
    () =>
      item
        ? products
            .filter((p) => p.category === item.category && p._id !== item._id)
            .sort((a, b) => b.sold_out - a.sold_out)
            .slice(0, 10)
        : [],
    [products, item]
  );

  if (status === "idle" || status === "loading") return <PageLoader />;
  if (!item) {
    return (
      <div className="container-x">
        <Empty
          title="We couldn't find that product"
          text="It may have been removed, or the link is incorrect."
          action={<Link to="/products" className="btn btn-primary">Browse products</Link>}
        />
      </div>
    );
  }

  const isEvent = item.kind === "Event";
  const shop = shops.find((s) => s._id === item.shopId);
  const off = percentOff(item.originalPrice, item.discountPrice);
  const soldOut = item.stock < 1;
  const live = !isEvent || item.status === "Running";
  const reviews = item.reviews || [];
  const liked = wish.has(item._id);

  const tabs = [
    ["description", "Description"],
    ...(!isEvent ? [["reviews", `Reviews (${reviews.length})`]] : []),
    ["seller", "Seller"],
  ];

  const buyNow = () => {
    if (add(item, qty, item.kind, { open: false })) navigate("/checkout");
  };

  return (
    <div className="container-x">
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: isEvent ? "Live sales" : item.category, to: isEvent ? "/events" : `/products?category=${encodeURIComponent(item.category)}` },
          { label: item.name },
        ]}
      />

      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-14">
        {/* gallery */}
        <div className="grid sm:grid-cols-[72px_1fr] gap-3 h-fit lg:sticky lg:top-40">
          <div className="order-2 sm:order-1 flex sm:flex-col gap-2.5 overflow-x-auto no-scrollbar">
            {item.images?.map((img, i) => (
              <button
                key={img}
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={active === i}
                className={`w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden bg-surface border-2 ${active === i ? "border-ink" : "border-transparent hover:border-line"}`}
              >
                <Img name={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <div className="order-1 sm:order-2 relative aspect-square rounded-2xl overflow-hidden bg-surface">
            <Img name={item.images?.[active]} alt={item.name} className="w-full h-full object-cover" />
            {off > 0 && !soldOut && <span className="badge bg-accent text-white absolute top-4 left-4">-{off}%</span>}
          </div>
        </div>

        {/* details */}
        <div>
          {isEvent && (
            <div className="rounded-xl bg-accent-soft p-3.5 mb-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-bold text-accent">
                {item.status === "Upcoming" ? "Live sale · starting soon" : item.status === "Ended" ? "This sale has ended" : "Live sale"}
              </span>
              {item.status === "Running" && (
                <span className="inline-flex items-center gap-2 text-xs text-ink-2">Ends in <Countdown to={item.Finish_Date} compact /></span>
              )}
              {item.status === "Upcoming" && (
                <span className="text-xs text-ink-2">Starts {new Date(item.start_Date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            {shop && (
              <Link to={`/shop/${shop._id}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                <Img name={shop.avatar} alt="" className="w-6 h-6 rounded-md object-cover" /> {shop.name}
              </Link>
            )}
            <span className="text-muted">/</span>
            <span className="text-slate">{item.category}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mt-3">{item.name}</h1>

          {!isEvent && (
            <button onClick={() => setTab("reviews")} className="mt-3 flex items-center gap-2" aria-label="See reviews">
              {item.ratings > 0 ? <Rating value={item.ratings} count={reviews.length} size="md" /> : <span className="text-sm text-muted">No reviews yet</span>}
              <span className="text-sm text-link hover:underline">· {item.sold_out} sold</span>
            </button>
          )}

          <div className="mt-5 pb-5 border-b border-line">
            <Price price={item.discountPrice} was={item.originalPrice} size="xl" />
            {off > 0 && (
              <p className="text-sm text-ok font-semibold mt-1.5">You save {money(item.originalPrice - item.discountPrice)}</p>
            )}
          </div>

          <p className="mt-5 text-ink-2 line-clamp-3">{item.description?.split("\n")[0]}</p>

          <div className="mt-5 flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${soldOut ? "bg-accent" : item.stock <= 5 ? "bg-warn" : "bg-ok"}`} />
            <span className="font-semibold">
              {soldOut ? "Out of stock" : item.stock <= 5 ? `Only ${item.stock} left` : "In stock"}
            </span>
            {!soldOut && <span className="text-slate">· ships in 1–2 business days</span>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} max={Math.max(1, item.stock)} onChange={setQty} />
            <button
              onClick={() => add(item, qty, item.kind)}
              disabled={soldOut || !live}
              className="btn btn-primary btn-lg flex-1 min-w-[160px]"
            >
              <FiShoppingBag /> Add to cart
            </button>
            <button
              onClick={() => wish.toggle(item)}
              className="btn btn-outline btn-lg !px-0 w-[50px]"
              aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={liked}
            >
              {liked ? <FaHeart className="text-accent" /> : <FiHeart />}
            </button>
          </div>
          <button onClick={buyNow} disabled={soldOut || !live} className="btn btn-accent btn-lg btn-block mt-3">
            Buy it now
          </button>

          <ul className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            {[
              [FiTruck, `Free shipping over ${money(FREE_SHIPPING_OVER)} from this shop`],
              [FiRotateCcw, "30-day returns"],
              [FiShield, "Secure checkout with Stripe"],
              [FiPackage, "Packed and shipped by the seller"],
            ].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-2.5 text-slate">
                <Icon size={17} className="text-ink shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-14">
        <div role="tablist" className="flex gap-7 border-b border-line overflow-x-auto no-scrollbar">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`pb-3 text-[15px] font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-ink text-ink" : "border-transparent text-slate hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="py-8" role="tabpanel">
          {tab === "description" && (
            <div className="max-w-3xl space-y-4 text-[15px] leading-relaxed text-ink-2">
              {item.description?.split("\n").map((para, i) => <p key={i}>{para}</p>)}
              {item.tags && (
                <p className="text-sm text-muted pt-2">Tags: {item.tags}</p>
              )}
            </div>
          )}
          {tab === "reviews" && <Reviews product={item} canReview={canReview} />}
          {tab === "seller" && shop && (
            <div className="card p-6 max-w-2xl flex gap-5 items-start">
              <Img name={shop.avatar} alt="" className="w-20 h-20 rounded-xl object-cover bg-surface shrink-0" />
              <div>
                <h3 className="text-lg font-bold">{shop.name}</h3>
                <p className="text-sm text-slate mt-1">{shop.address}</p>
                <p className="text-[15px] text-ink-2 mt-3">{shop.description}</p>
                <div className="flex gap-6 text-sm mt-4 num">
                  <span><b>{shop.stats?.products}</b> products</span>
                  <span><b>{shop.stats?.rating || "–"}</b> rating</span>
                  <span><b>{shop.stats?.sold}</b> sold</span>
                </div>
                <Link to={`/shop/${shop._id}`} className="btn btn-outline btn-sm mt-4">Visit shop</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">You may also like</h2>
          <Row products={related} />
        </section>
      )}
    </div>
  );
}
