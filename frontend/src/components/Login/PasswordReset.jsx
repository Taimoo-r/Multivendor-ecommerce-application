import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { LoaderIcon } from "react-hot-toast";
import axios from "axios";
import { toast } from "react-toastify";
import { server } from "../../server";

// `type` is "user" (buyers) or "shop" (sellers); it picks the API and login route.
const ACCOUNT = {
  user: { api: "user", login: "/login", forgot: "/forgot-password" },
  shop: { api: "shop", login: "/shop-login", forgot: "/shop-forgot-password" },
};

const inputClass =
  "appearance-none block w-full px-3 py-2 rounded-md bg-white/30 border border-white/50 text-gray-900 placeholder-gray-600 shadow-inner backdrop-blur-sm focus:outline-none focus:bg-white/40 focus:ring-2 focus:ring-orange-300 focus:border-orange-300 sm:text-sm transition";
const buttonClass =
  "w-full h-[44px] flex justify-center items-center py-2 px-4 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-200/60 ring-1 ring-white/40 transition";

const Shell = ({ title, children }) => (
  <div className="min-h-screen bg-gradient-to-br from-orange-100 via-gray-50 to-amber-150 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
        {title}
      </h2>
    </div>
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div className="py-8 px-4 sm:px-10 rounded-2xl border border-white/40 bg-white/25 backdrop-blur-3xl shadow-2xl ring-1 ring-white/30">
        {children}
      </div>
    </div>
  </div>
);

export const ForgotPassword = ({ type = "user" }) => {
  const account = ACCOUNT[type];
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${server}/${account.api}/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Forgot your password?">
      {sent ? (
        <p className="text-center text-gray-800">
          If that email is registered, a reset link is on its way. It expires in
          15 minutes.
        </p>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <p className="text-sm text-gray-700">
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <div className="mt-1">
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className={buttonClass}>
            {loading ? <LoaderIcon /> : "Send reset link"}
          </button>
        </form>
      )}
      <div className="flex items-center justify-center mt-6">
        <Link to={account.login} className="text-sky-600 hover:text-sky-500">
          Back to login
        </Link>
      </div>
    </Shell>
  );
};

export const ResetPassword = ({ type = "user" }) => {
  const account = ACCOUNT[type];
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    if (password !== confirm) {
      return toast.error("Passwords don't match");
    }
    setLoading(true);
    try {
      await axios.post(`${server}/${account.api}/reset-password/${token}`, {
        password,
      });
      toast.success("Password updated. Please log in.");
      navigate(account.login);
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong";
      if (err.response?.status === 400 && /link/i.test(message)) {
        setExpired(true);
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const Eye = visible ? AiOutlineEye : AiOutlineEyeInvisible;

  return (
    <Shell title="Choose a new password">
      {expired ? (
        <div className="text-center space-y-4">
          <p className="text-gray-800">
            This reset link is invalid or has expired.
          </p>
          <Link
            to={account.forgot}
            className="text-sky-600 hover:text-sky-500"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              New password
            </label>
            <div className="mt-1 relative">
              <input
                type={visible ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <Eye
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2 top-2 cursor-pointer text-gray-700 hover:text-gray-900"
                size={25}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="confirm"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm password
            </label>
            <div className="mt-1">
              <input
                type={visible ? "text" : "password"}
                name="confirm"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className={buttonClass}>
            {loading ? <LoaderIcon /> : "Update password"}
          </button>
        </form>
      )}
    </Shell>
  );
};
