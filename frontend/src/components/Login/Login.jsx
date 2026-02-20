import React from 'react'
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {AiOutlineEye, AiOutlineEyeInvisible} from 'react-icons/ai'
import axios from 'axios';
import { server } from "../../server";
import { toast } from "react-toastify"
import { LoaderIcon } from 'react-hot-toast';

const Login = () => {

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    await axios
      .post(
        `${server}/user/login-user`,
        {
          email,
          password,
        },
        { withCredentials: true }
      )
      .then((res) => {
        console.log(res.data)
        setLoading(false);
        toast.success("Login Success!");
        navigate("/");
        window.location.reload(true);
      })
      .catch((err) => {
        setLoading(false);
        console.error(err);
        toast.error(err.response?.data?.message);
      });
  };



    return (
      <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-orange-100 via-gray-50 to-amber-150 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          {/* Soft glow wash */}
          <div className="absolute -inset-10 bg-[radial-gradient(circle_at_20%_10%,rgba(251,146,60,0.18),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.15),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(255,159,67,0.14),transparent_40%)]"></div>
          {/* Animated orange stripes */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(100deg,rgba(251,146,60,0.12)_0px,rgba(251,146,60,0.12)_2px,transparent_2px,transparent_22px)] opacity-70 animate-orange-stripes"></div>
          {/* Floating gradient orbs */}
          <div className="absolute -top-4 -left-4 w-64 h-64 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(251,146,60,0.55),rgba(251,146,60,0.15)_60%,transparent_80%)] blur-2xl animate-float-slow"></div>
          <div className="absolute bottom-0 -right-4 w-72 h-72 rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(245,158,11,0.5),rgba(251,146,60,0.18)_60%,transparent_80%)] blur-2xl animate-drift-slower"></div>
        </div>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Login to your account
          </h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="py-8 px-4 sm:px-10 rounded-2xl border border-white/40 bg-white/25 bg-clip-padding backdrop-blur-3xl backdrop-saturate-200 shadow-2xl ring-1 ring-white/30 transition hover:bg-white/30">
            <form className="space-y-6" onSubmit={handleSubmit}>
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    
                    className="appearance-none block w-full px-3 py-2 rounded-md bg-white/30 border border-white/50 text-gray-900 placeholder-gray-600 shadow-inner backdrop-blur-sm focus:outline-none focus:bg-white/40 focus:ring-2 focus:ring-orange-300 focus:border-orange-300 sm:text-sm transition"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    type={visible ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    onChange={(e) => setPassword(e.target.value)}
                    value={password}
                    
                    className="appearance-none block w-full px-3 py-2 rounded-md bg-white/30 border border-white/50 text-gray-900 placeholder-gray-600 shadow-inner backdrop-blur-sm focus:outline-none focus:bg-white/40 focus:ring-2 focus:ring-orange-300 focus:border-orange-300 sm:text-sm transition"
                  />
                  {visible ? (
                    <AiOutlineEye
                      onClick={() => setVisible(prev => !prev)}
                      className="absolute right-2 top-2 cursor-pointer text-gray-700 hover:text-gray-900"
                      size={25}
                      
                    />
                  ) : (
                    <AiOutlineEyeInvisible
                      onClick={() => setVisible(prev => !prev)}
                      className="absolute right-2 top-2 cursor-pointer text-gray-700 hover:text-gray-900"
                      size={25}
                      
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="remember-me" className="flex items-center">
                  <input
                    type="checkbox"
                    name="remember-me"
                    id="remember-me"
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-white/60 bg-white/40 rounded backdrop-blur-sm"
                  />
                  <span className="ml-2 text-sm text-gray-800">Remember me</span>
                </label>
                <div className="text-sm">
                  <a
                    href=".forgot-password"
                    className="font-medium text-orange-600 hover:text-orange-500"
                  >
                    Forgot your password?
                  </a>
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  className="group relative w-full h-[44px] flex justify-center items-center py-2 px-4 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-200/60 ring-1 ring-white/40 transition"
                >{
                  loading ? <LoaderIcon/> : "Submit"
                }
                </button>
              </div>
              <div className="flex items-center justify-center mt-4">
                <h4 className="mr-2 text-gray-700">Don't have an account?</h4>
                <Link to="/sign-up" className="text-sky-600 hover:text-sky-500">
                  Sign Up
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

export default Login;
