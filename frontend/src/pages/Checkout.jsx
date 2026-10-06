import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Country } from "country-state-city";
import { FiCheck, FiCreditCard, FiDollarSign, FiLock, FiTag, FiX } from "react-icons/fi";
import { Breadcrumbs, Img, Spinner } from "../components/ui/primitives";
import { api, errMsg } from "../lib/api";
import { money } from "../lib/format";
import { useCart, useTitle } from "../lib/hooks";

const EMPTY = { address1: "", address2: "", city: "", country: "United States", zipCode: "" };

const Step = ({ n, title, done, children }) => (
  <section className="card p-5 sm:p-6">
    <h2 className="flex items-center gap-3 text-lg font-bold mb-5">
      <span className={`w-7 h-7 rounded-full grid place-items-center text-sm ${done ? "bg-ok text-white" : "bg-ink text-white"}`}>
        {done ? <FiCheck size={15} /> : n}
      </span>
      {title}
    </h2>
    {children}
  </section>
);

function CheckoutForm() {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const user = useSelector((s) => s.auth.user);
  const cart = useCart();
  useTitle("Checkout");

  const saved = user.addresses || [];
  const [choice, setChoice] = useState(saved.length ? saved[0]._id : "new");
  const [form, setForm] = useState(EMPTY);
  const [phone, setPhone] = useState(user.phoneNumber ? String(user.phoneNumber) : "");
  const [method, setMethod] = useState("card");
  const [cardReady, setCardReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");

  const countries = useMemo(() => Country.getAllCountries().map((c) => c.name), []);
  const items = cart.active.map((l) => ({ _id: l._id, qty: l.qty }));
  const itemsKey = JSON.stringify(items);

  // ask the server for the real totals whenever the cart or coupon changes; a newer
  // change aborts the request still in flight for the older one
  useEffect(() => {
    if (!items.length) return;
    const ctrl = new AbortController();
    api
      .post("/order/quote", { cart: items, couponCode: coupon }, { signal: ctrl.signal })
      .then(({ data }) => {
        setQuote(data.summary);
        setQuoteError("");
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        if (coupon) {
          toast.error(errMsg(e));
          setCoupon("");
        } else {
          setQuoteError(errMsg(e));
        }
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, coupon]);

  const address = () => {
    if (choice !== "new") {
      const a = saved.find((x) => x._id === choice);
      return a && { address1: a.address1, address2: a.address2, city: a.city, country: a.country, zipCode: a.zipCode };
    }
    return form;
  };

  const shown = quote || { subTotal: cart.subTotal, shipping: cart.shipping, discount: 0, total: cart.total };

  const placeOrder = async (e) => {
    e.preventDefault();
    const shippingAddress = address();
    if (!shippingAddress || ["address1", "city", "country", "zipCode"].some((k) => !String(shippingAddress[k] || "").trim())) {
      return toast.error("Please complete your delivery address");
    }
    if (method === "card" && !cardReady) return toast.error("Please enter your card details");

    setBusy(true);
    try {
      let paymentInfo = { type: "Cash On Delivery" };
      if (method === "card") {
        const { data } = await api.post("/payment/process", { cart: items, couponCode: coupon });
        const result = await stripe.confirmCardPayment(data.client_secret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: { name: user.name, email: user.email },
          },
        });
        if (result.error) throw new Error(result.error.message);
        paymentInfo = { type: "Credit Card", id: result.paymentIntent.id };
      }

      const { data } = await api.post("/order/create-order", {
        cart: items,
        shippingAddress: { ...shippingAddress, phoneNumber: phone },
        couponCode: coupon,
        paymentInfo,
      });
      // the success page empties the cart; clearing it here would bounce us back to /cart first
      navigate("/order/success", { replace: true, state: { orders: data.orders, summary: data.summary } });
    } catch (err) {
      toast.error(err.message && !err.response ? err.message : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const applyCoupon = (e) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCoupon(code);
    setCouponInput("");
  };

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={placeOrder} className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
      <div className="space-y-5">
        <Step n={1} title="Delivery address" done={choice !== "new" || !!form.address1}>
          {saved.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {saved.map((a) => (
                <label key={a._id} className={`block p-4 rounded-xl border cursor-pointer text-sm ${choice === a._id ? "border-ink bg-surface" : "border-line hover:border-[#c9d0d9]"}`}>
                  <input type="radio" name="addr" checked={choice === a._id} onChange={() => setChoice(a._id)} className="sr-only" />
                  <span className="flex items-center justify-between font-bold">{a.addressType}{choice === a._id && <FiCheck />}</span>
                  <span className="block text-slate mt-1.5 leading-snug">
                    {a.address1}{a.address2 ? `, ${a.address2}` : ""}<br />{a.city}, {a.zipCode}<br />{a.country}
                  </span>
                </label>
              ))}
              <label className={`flex items-center justify-center p-4 rounded-xl border border-dashed cursor-pointer text-sm font-semibold ${choice === "new" ? "border-ink bg-surface" : "border-line hover:border-ink"}`}>
                <input type="radio" name="addr" checked={choice === "new"} onChange={() => setChoice("new")} className="sr-only" />
                + Use a new address
              </label>
            </div>
          )}
          {choice === "new" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="a1">Address</label>
                <input id="a1" className="field" value={form.address1} onChange={setF("address1")} autoComplete="address-line1" placeholder="Street and number" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="a2">Apartment, suite (optional)</label>
                <input id="a2" className="field" value={form.address2} onChange={setF("address2")} autoComplete="address-line2" />
              </div>
              <div>
                <label className="label" htmlFor="ct">City</label>
                <input id="ct" className="field" value={form.city} onChange={setF("city")} autoComplete="address-level2" />
              </div>
              <div>
                <label className="label" htmlFor="zp">Postal code</label>
                <input id="zp" className="field" value={form.zipCode} onChange={setF("zipCode")} autoComplete="postal-code" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="co">Country</label>
                <select id="co" className="field" value={form.country} onChange={setF("country")} autoComplete="country-name">
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="mt-4 max-w-xs">
            <label className="label" htmlFor="ph">Phone for the courier (optional)</label>
            <input id="ph" className="field num" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
        </Step>

        <Step n={2} title="Payment">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ["card", FiCreditCard, "Credit or debit card", "Pay securely with Stripe"],
              ["cod", FiDollarSign, "Cash on delivery", "Pay when your order arrives"],
            ].map(([k, Icon, t, s]) => (
              <label key={k} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${method === k ? "border-ink bg-surface" : "border-line hover:border-[#c9d0d9]"}`}>
                <input type="radio" name="pay" checked={method === k} onChange={() => setMethod(k)} className="sr-only" />
                <Icon size={20} className="mt-0.5" />
                <span><span className="block font-bold text-sm">{t}</span><span className="block text-xs text-slate mt-0.5">{s}</span></span>
              </label>
            ))}
          </div>
          {method === "card" && (
            <div className="mt-5">
              <label className="label">Card details</label>
              <div className="field !h-auto py-3.5">
                <CardElement
                  onChange={(e) => setCardReady(e.complete)}
                  options={{
                    hidePostalCode: true,
                    style: {
                      base: { fontSize: "15px", fontFamily: "DM Sans, system-ui, sans-serif", color: "#0a1a1c", "::placeholder": { color: "#7d8b9c" } },
                      invalid: { color: "#c11d17" },
                    },
                  }}
                />
              </div>
              <p className="hint flex items-center gap-1.5"><FiLock size={12} /> Test mode: use card 4242 4242 4242 4242, any future date and any CVC.</p>
            </div>
          )}
        </Step>
      </div>

      {/* summary */}
      <aside className="card p-6 lg:sticky lg:top-40">
        <h2 className="text-lg font-bold">Order summary</h2>
        <ul className="mt-4 divide-y divide-line max-h-72 overflow-y-auto -mx-1 px-1">
          {cart.active.map((l) => (
            <li key={l._id} className="flex gap-3 py-3 first:pt-0">
              <div className="relative">
                <Img sizes="56px" name={l.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-surface" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-ink text-white text-[11px] font-bold grid place-items-center num">{l.qty}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium line-clamp-2 leading-snug">{l.name}</p>
                <p className="text-xs text-muted mt-0.5">{l.shopName}</p>
              </div>
              <p className="text-sm font-semibold num">{money(l.price * l.qty)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-4 border-t border-line">
          {quote?.couponCode ? (
            <div className="flex items-center justify-between rounded-lg bg-ok-soft text-ok px-3 py-2.5 text-sm font-semibold">
              <span className="flex items-center gap-2"><FiTag /> {quote.couponCode} applied</span>
              <button type="button" onClick={() => setCoupon("")} aria-label="Remove coupon"><FiX /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyCoupon(e)}
                placeholder="Coupon code"
                aria-label="Coupon code"
                className="field !h-10 uppercase placeholder:normal-case"
              />
              <button type="button" onClick={applyCoupon} className="btn btn-outline btn-sm !h-10">Apply</button>
            </div>
          )}
        </div>

        <dl className="mt-4 space-y-2.5 text-[15px]">
          <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd className="font-semibold num">{money(shown.subTotal)}</dd></div>
          {shown.discount > 0 && (
            <div className="flex justify-between text-ok"><dt>Discount</dt><dd className="font-semibold num">-{money(shown.discount)}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-slate">Shipping</dt><dd className="font-semibold num">{shown.shipping === 0 ? "Free" : money(shown.shipping)}</dd></div>
          <div className="flex justify-between pt-3 border-t border-line text-lg"><dt className="font-bold">Total</dt><dd className="font-bold num">{money(shown.total)}</dd></div>
        </dl>

        {quoteError && <p className="text-sm text-accent mt-3" role="alert">{quoteError}</p>}

        <button disabled={busy || !!quoteError || (method === "card" && !stripe)} className="btn btn-accent btn-lg btn-block mt-5">
          {busy ? <><Spinner /> Processing…</> : method === "card" ? `Pay ${money(shown.total)}` : "Place order"}
        </button>
        <p className="hint text-center">By placing your order you agree to our terms and returns policy.</p>
      </aside>
    </form>
  );
}

export default function Checkout() {
  const cart = useCart();
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    api
      .get("/payment/stripeapikey")
      .then(({ data }) => data.stripeApikey && setStripePromise(loadStripe(data.stripeApikey)))
      .catch(() => {});
  }, []);

  if (cart.active.length === 0) return <Navigate to="/cart" replace />;

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
      <h1 className="text-2xl sm:text-3xl font-bold pb-6">Checkout</h1>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
      <p className="text-sm text-slate mt-8">
        Need to change something? <Link to="/cart" className="text-link hover:underline">Back to cart</Link>
      </p>
    </div>
  );
}
