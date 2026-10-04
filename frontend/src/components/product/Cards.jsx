import { Link } from "react-router-dom";
import { FiHeart, FiShoppingBag, FiStar } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import { Countdown, Img, Price, Rating } from "../ui/primitives";
import { percentOff, compact } from "../../lib/format";
import { useAddToCart, useWishlist } from "../../lib/hooks";

export const ProductCard = ({ product, kind = "Product" }) => {
  const add = useAddToCart();
  const wish = useWishlist();
  const off = percentOff(product.originalPrice, product.discountPrice);
  const soldOut = product.stock < 1;
  const liked = wish.has(product._id);
  const reviews = product.reviews?.length || 0;

  return (
    <article className="group relative">
      <div className="relative aspect-square bg-surface rounded-xl overflow-hidden">
        <Link to={`/product/${product._id}`} className="block w-full h-full" aria-label={product.name}>
          <Img
            name={product.images?.[0]}
            alt={product.name}
            className={`w-full h-full object-cover transition duration-300 ${product.images?.[1] ? "group-hover:opacity-0" : "group-hover:scale-105"} ${soldOut ? "opacity-50" : ""}`}
          />
          {product.images?.[1] && (
            <Img
              name={product.images[1]}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-0 transition duration-300 group-hover:opacity-100"
            />
          )}
        </Link>

        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 pointer-events-none">
          {soldOut ? (
            <span className="badge bg-ink text-white">Sold out</span>
          ) : (
            off > 0 && <span className="badge bg-accent text-white">-{off}%</span>
          )}
        </div>

        <button
          onClick={() => wish.toggle(product)}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 grid place-items-center text-ink hover:scale-105 transition"
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={liked}
        >
          {liked ? <FaHeart size={14} className="text-accent" /> : <FiHeart size={15} />}
        </button>

        {!soldOut && (
          <button
            onClick={() => add(product, 1, kind)}
            className="absolute inset-x-2.5 bottom-2.5 h-10 rounded-lg bg-ink text-white text-sm font-semibold inline-flex items-center justify-center gap-2 opacity-100 translate-y-0 lg:opacity-0 lg:translate-y-2 lg:group-hover:opacity-100 lg:group-hover:translate-y-0 lg:focus-visible:opacity-100 lg:focus-visible:translate-y-0 transition"
          >
            <FiShoppingBag size={15} /> Add to cart
          </button>
        )}
      </div>

      <div className="pt-3">
        <Link
          to={`/product/${product._id}`}
          className="block text-sm font-medium leading-snug line-clamp-2 hover:underline min-h-[2.5em]"
        >
          {product.name}
        </Link>
        <div className="mt-1.5 flex items-center gap-2 min-h-[18px]">
          {product.ratings > 0 ? (
            <Rating value={product.ratings} count={reviews} />
          ) : (
            <span className="text-xs text-muted">No reviews yet</span>
          )}
        </div>
        <div className="mt-1.5">
          <Price price={product.discountPrice} was={product.originalPrice} size="sm" />
        </div>
        {product.shop?.name && (
          <p className="text-xs text-muted mt-1 truncate">by {product.shop.name}</p>
        )}
      </div>
    </article>
  );
};

export const ProductGrid = ({
  products,
  cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
}) => (
  <div className={`grid ${cols} gap-x-4 gap-y-8`}>
    {products.map((p) => (
      <ProductCard key={p._id} product={p} />
    ))}
  </div>
);

export const ProductSkeletons = ({
  n = 5,
  cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
}) => (
  <div className={`grid ${cols} gap-x-4 gap-y-8`}>
    {Array.from({ length: n }).map((_, i) => (
      <div key={i}>
        <div className="skeleton aspect-square rounded-xl" />
        <div className="skeleton h-4 mt-3 w-4/5" />
        <div className="skeleton h-3 mt-2 w-2/5" />
        <div className="skeleton h-4 mt-2 w-1/3" />
      </div>
    ))}
  </div>
);

// Flash-sale card
export const EventCard = ({ event }) => {
  const off = percentOff(event.originalPrice, event.discountPrice);
  const left = Math.max(0, event.stock);
  const claimed = event.sold_out || 0;
  const pct = Math.min(100, Math.round((claimed / Math.max(1, claimed + left)) * 100));
  const upcoming = event.status === "Upcoming";
  const ended = event.status === "Ended";

  return (
    <article className="card overflow-hidden flex flex-col sm:flex-row group">
      <Link
        to={`/product/${event._id}`}
        className="relative sm:w-[44%] aspect-[4/3] sm:aspect-auto sm:min-h-[220px] bg-surface block shrink-0"
      >
        <Img
          name={event.images?.[0]}
          alt={event.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
        />
        {off > 0 && !ended && (
          <span className="badge bg-accent text-white absolute top-3 left-3">-{off}%</span>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-xs text-slate">
          {event.shop?.name && <span className="font-semibold text-ink-2">{event.shop.name}</span>}
          <span className="text-muted">/</span>
          <span>{event.category}</span>
        </div>
        <h3 className="text-lg font-bold mt-1.5 leading-snug">
          <Link to={`/product/${event._id}`} className="hover:underline">
            {event.name}
          </Link>
        </h3>
        <p className="text-sm text-slate mt-1.5 line-clamp-2">{event.description}</p>

        <div className="mt-3">
          <Price price={event.discountPrice} was={event.originalPrice} size="lg" />
        </div>

        {!upcoming && !ended && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-slate mt-1.5 num">
              {compact(claimed)} claimed · {left} left
            </p>
          </div>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between gap-3 flex-wrap">
          {upcoming ? (
            <span className="text-sm text-slate">
              Starts <b className="text-ink">{new Date(event.start_Date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>
            </span>
          ) : ended ? (
            <span className="badge bg-surface-2 text-slate">Ended</span>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate">
              Ends in <Countdown to={event.Finish_Date} compact />
            </div>
          )}
          <Link to={`/product/${event._id}`} className="btn btn-primary btn-sm">
            {upcoming ? "Preview" : "View deal"}
          </Link>
        </div>
      </div>
    </article>
  );
};

export const ShopCard = ({ shop }) => (
  <Link
    to={`/shop/${shop._id}`}
    className="card p-4 flex items-center gap-3.5 hover:border-ink transition group"
  >
    <Img
      name={shop.avatar}
      alt=""
      className="w-14 h-14 rounded-xl object-cover bg-surface shrink-0"
    />
    <div className="min-w-0">
      <h3 className="font-bold truncate group-hover:underline">{shop.name}</h3>
      <div className="flex items-center gap-1.5 text-xs text-slate mt-0.5">
        {shop.stats?.rating > 0 && (
          <>
            <FiStar className="text-[#f5a524] fill-[#f5a524]" size={12} />
            <span className="font-semibold text-ink-2 num">{shop.stats.rating.toFixed(1)}</span>
            <span>·</span>
          </>
        )}
        <span className="num">{shop.stats?.products || 0} products</span>
      </div>
    </div>
  </Link>
);
