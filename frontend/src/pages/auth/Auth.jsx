import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FiCamera, FiCheckCircle, FiEye, FiEyeOff, FiMail } from "react-icons/fi";
import { Spinner } from "../../components/ui/primitives";
import { Logo } from "../../components/layout/Header";
import { api, errMsg } from "../../lib/api";
import { useTitle } from "../../lib/hooks";
import { setSeller, setUser } from "../../store/auth";

/* ---------- shared pieces ---------- */
const Shell = ({ title, subtitle, seller = false, children, footer }) => (
  <div className="min-h-[calc(100vh-108px)] grid lg:grid-cols-2">
    <div className="hidden lg:block relative bg-ink">
      <img
        src={seller ? "/banners/banner-tech.jpg" : "/banners/banner-home.jpg"}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-ink/45" />
      <div className="relative h-full p-12 flex flex-col justify-between text-white">
        <Logo light />
        <div>
          <p className="text-3xl font-bold leading-tight max-w-sm">
            {seller ? "Run your shop. Keep 90% of every sale." : "Independent brands, one simple cart."}
          </p>
          <p className="mt-3 text-white/75 max-w-sm">
            {seller
              ? "Products, flash sales, coupons and orders in one dashboard."
              : "Free shipping over $50 from each shop and 30-day returns."}
          </p>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-[420px]">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-slate mt-2">{subtitle}</p>}
        <div className="mt-7">{children}</div>
        {footer && <div className="mt-6 text-sm text-slate text-center">{footer}</div>}
      </div>
    </div>
  </div>
);

const Field = ({ label, id, children, hint }) => (
  <div>
    <label className="label" htmlFor={id}>{label}</label>
    {children}
    {hint && <p className="hint">{hint}</p>}
  </div>
);

const PasswordInput = ({ id, value, onChange, autoComplete = "current-password", placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="field pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-0 top-0 h-full w-11 grid place-items-center text-muted hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <FiEyeOff size={18} /> : <FiEye size={18} />}
      </button>
    </div>
  );
};

const AvatarPicker = ({ file, onChange, label }) => {
  const input = useRef(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative w-16 h-16 rounded-full bg-surface border border-dashed border-muted grid place-items-center text-muted overflow-hidden hover:border-ink"
        aria-label={label}
      >
        {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <FiCamera size={20} />}
      </button>
      <div className="text-sm">
        <button type="button" onClick={() => input.current?.click()} className="font-semibold text-link hover:underline">
          {file ? "Change" : label}
        </button>
        <p className="text-xs text-muted">PNG or JPG, up to 5MB</p>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </div>
  );
};

const Submit = ({ busy, children }) => (
  <button disabled={busy} className="btn btn-primary btn-lg btn-block">
    {busy ? <Spinner /> : children}
  </button>
);

const Sent = ({ email, onRetry }) => (
  <div className="text-center py-4">
    <div className="mx-auto w-14 h-14 rounded-full bg-ok-soft text-ok grid place-items-center"><FiMail size={24} /></div>
    <h2 className="text-xl font-bold mt-4">Check your inbox</h2>
    <p className="text-slate mt-2">We sent a link to <b className="text-ink">{email}</b>. It expires soon, so open it right away.</p>
    {onRetry && <button onClick={onRetry} className="text-sm text-link hover:underline mt-5">Use a different email</button>}
  </div>
);

const useRedirectedBack = () => {
  const { state } = useLocation();
  return state?.from || "/";
};

/* ---------- buyer ---------- */
export function Login() {
  useTitle("Sign in");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const back = useRedirectedBack();
  const { status } = useSelector((s) => s.auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to={back} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/user/login-user", { email, password });
      dispatch(setUser(data.user));
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}`);
      navigate(back, { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          New to VendorZone? <Link to="/sign-up" className="font-semibold text-ink hover:underline">Create an account</Link>
          <br />
          <span className="inline-block mt-2">Selling? <Link to="/shop-login" className="font-semibold text-ink hover:underline">Seller login</Link></span>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" id="email">
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="field" />
        </Field>
        <Field label="Password" id="password">
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right -mt-1">
          <Link to="/forgot-password" className="text-sm font-semibold text-link hover:underline">Forgot password?</Link>
        </div>
        <Submit busy={busy}>Sign in</Submit>
      </form>
    </Shell>
  );
}

export function Signup() {
  useTitle("Create account");
  const { status } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");

  if (status === "authed") return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (file) body.append("file", file);
      await api.post("/user/create-user", body);
      setSentTo(form.email);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Shell
      title="Create your account"
      subtitle="Save your cart, track orders and check out faster."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-ink hover:underline">Sign in</Link></>}
    >
      {sentTo ? (
        <Sent email={sentTo} onRetry={() => setSentTo("")} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AvatarPicker file={file} onChange={setFile} label="Add a photo (optional)" />
          <Field label="Full name" id="name">
            <input id="name" required value={form.name} onChange={set("name")} autoComplete="name" className="field" />
          </Field>
          <Field label="Email" id="email">
            <input id="email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" className="field" />
          </Field>
          <Field label="Password" id="password" hint="At least 6 characters">
            <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Submit busy={busy}>Create account</Submit>
        </form>
      )}
    </Shell>
  );
}

// one component serves both /activation/:token and /seller/activation/:token
export function Activation({ seller = false }) {
  useTitle("Activating");
  const { activation_token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [state, setState] = useState("working"); // working | ok | error
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode runs effects twice; a token can only be used once
    ran.current = true;
    api
      .post(seller ? "/shop/activation" : "/user/activation", { activation_token })
      .then(({ data }) => {
        if (seller) dispatch(setSeller(data.user));
        else dispatch(setUser(data.user));
        setState("ok");
        setTimeout(() => navigate(seller ? "/dashboard" : "/", { replace: true }), 1800);
      })
      .catch((err) => {
        setMessage(errMsg(err));
        setState("error");
      });
  }, [activation_token, seller, dispatch, navigate]);

  return (
    <div className="container-x min-h-[60vh] grid place-items-center text-center">
      <div>
        {state === "working" && (<><Spinner className="w-8 h-8" /><p className="mt-4 text-slate">Activating your {seller ? "shop" : "account"}…</p></>)}
        {state === "ok" && (
          <>
            <FiCheckCircle size={48} className="mx-auto text-ok" />
            <h1 className="text-2xl font-bold mt-4">You're all set!</h1>
            <p className="text-slate mt-1">Your {seller ? "shop is live" : "account is ready"}. Taking you in…</p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-2xl font-bold">We couldn't activate that link</h1>
            <p className="text-slate mt-2 max-w-sm mx-auto">{message}</p>
            <Link to={seller ? "/shop-create" : "/sign-up"} className="btn btn-primary mt-6">Start again</Link>
          </>
        )}
      </div>
    </div>
  );
}

// forgot + reset password, for buyers and sellers
const ACCOUNT = {
  user: { api: "user", login: "/login", forgot: "/forgot-password" },
  shop: { api: "shop", login: "/shop-login", forgot: "/shop-forgot-password" },
};

export function ForgotPassword({ type = "user" }) {
  useTitle("Forgot password");
  const account = ACCOUNT[type];
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/${account.api}/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      seller={type === "shop"}
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={<Link to={account.login} className="font-semibold text-ink hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <Sent email={email} onRetry={() => setSent(false)} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" id="email">
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="field" />
          </Field>
          <Submit busy={busy}>Send reset link</Submit>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword({ type = "user" }) {
  useTitle("Reset password");
  const account = ACCOUNT[type];
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await api.post(`/${account.api}/reset-password/${token}`, { password });
      toast.success("Password updated. Please sign in.");
      navigate(account.login, { replace: true });
    } catch (err) {
      const message = errMsg(err);
      if (/link/i.test(message)) setExpired(true);
      toast.error(message);
      setBusy(false);
    }
  };

  return (
    <Shell seller={type === "shop"} title="Choose a new password">
      {expired ? (
        <div className="text-center">
          <p className="text-slate">This reset link is invalid or has expired.</p>
          <Link to={account.forgot} className="btn btn-primary mt-5">Request a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" id="password" hint="At least 6 characters">
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" id="confirm">
            <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <Submit busy={busy}>Update password</Submit>
        </form>
      )}
    </Shell>
  );
}

/* ---------- seller ---------- */
export function ShopLogin() {
  useTitle("Seller login");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status } = useSelector((s) => s.seller);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/shop/login-shop", { email, password });
      dispatch(setSeller(data.user));
      toast.success("Welcome back");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Shell
      seller
      title="Seller login"
      subtitle="Manage your products, orders and sales."
      footer={
        <>
          New seller? <Link to="/shop-create" className="font-semibold text-ink hover:underline">Open a shop</Link>
          <br />
          <span className="inline-block mt-2">Shopping instead? <Link to="/login" className="font-semibold text-ink hover:underline">Buyer sign in</Link></span>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Shop email" id="email">
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="field" />
        </Field>
        <Field label="Password" id="password">
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right -mt-1">
          <Link to="/shop-forgot-password" className="text-sm font-semibold text-link hover:underline">Forgot password?</Link>
        </div>
        <Submit busy={busy}>Sign in</Submit>
      </form>
    </Shell>
  );
}

export function ShopCreate() {
  useTitle("Open a shop");
  const { status } = useSelector((s) => s.seller);
  const [form, setForm] = useState({ name: "", email: "", phoneNumber: "", address: "", zipCode: "", password: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");

  if (status === "authed") return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please add a shop logo");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      body.append("file", file);
      await api.post("/shop/create-shop", body);
      setSentTo(form.email);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      seller
      title="Open your shop"
      subtitle="Free to start. We keep 10% of each sale, you keep the rest."
      footer={<>Already selling? <Link to="/shop-login" className="font-semibold text-ink hover:underline">Seller login</Link></>}
    >
      {sentTo ? (
        <Sent email={sentTo} onRetry={() => setSentTo("")} />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AvatarPicker file={file} onChange={setFile} label="Upload shop logo" />
          <Field label="Shop name" id="name"><input id="name" required value={form.name} onChange={set("name")} className="field" /></Field>
          <Field label="Email" id="email"><input id="email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" className="field" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" id="phone"><input id="phone" required inputMode="tel" value={form.phoneNumber} onChange={set("phoneNumber")} autoComplete="tel" className="field num" /></Field>
            <Field label="Postal code" id="zip"><input id="zip" required inputMode="numeric" value={form.zipCode} onChange={set("zipCode")} autoComplete="postal-code" className="field num" /></Field>
          </div>
          <Field label="Address" id="address"><input id="address" required value={form.address} onChange={set("address")} autoComplete="street-address" className="field" /></Field>
          <Field label="Password" id="password" hint="At least 6 characters">
            <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Submit busy={busy}>Create shop</Submit>
        </form>
      )}
    </Shell>
  );
}
