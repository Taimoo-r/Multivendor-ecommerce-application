import { useRef } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { ProductCard, ProductSkeletons } from "./Cards";

// Horizontal product scroller with snap + arrows on desktop
export default function Row({ products, loading = false }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (loading) return <ProductSkeletons n={5} />;
  if (!products.length) return null;

  const arrow =
    "hidden lg:grid absolute top-[34%] -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-line shadow-md place-items-center hover:bg-surface z-10";
  return (
    <div className="relative group/row">
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 pb-1"
      >
        {products.map((p) => (
          <div key={p._id} className="snap-start shrink-0 w-[46%] xs:w-[40%] sm:w-[31%] lg:w-[23.5%] xl:w-[19%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {products.length > 5 && (
        <>
          <button onClick={() => scroll(-1)} className={`${arrow} -left-5`} aria-label="Scroll left">
            <FiChevronLeft size={20} />
          </button>
          <button onClick={() => scroll(1)} className={`${arrow} -right-5`} aria-label="Scroll right">
            <FiChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  );
}
