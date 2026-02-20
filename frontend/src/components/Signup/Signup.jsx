import React from 'react'
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {AiOutlineEye, AiOutlineEyeInvisible} from 'react-icons/ai'
import {toast} from 'react-toastify'
import {RxAvatar} from 'react-icons/rx';
import axios from 'axios';
import { server } from '../../server';
import { LoaderIcon } from 'react-hot-toast';

const Signup = () => {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [avatar, setAvatar] = useState(null);
    const [loading, setLoading] = useState(false);
  
    // Function to handle file input change
    const handleFileInputChange = (e) => {
      const file = e.target.files[0];
      setAvatar(file);
    };
  
    // Function to handle form submission
    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
  
      const formData = new FormData();
      formData.append("file", avatar);
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
  
      const config = { headers: { "Content-Type": "multipart/form-data" } };
  
      try {
        const response = await axios.post(
          `${server}/user/create-user`,
          formData,
          config
        );
        console.log(response);
        if (response && response.data) {
          setLoading(false);
          toast.success(response.data.message);
          setName("");
          setEmail("");
          setPassword("");
          setAvatar(null); // Reset avatar input
        } else {
          toast.error("Unexpected response from server.");
        }
      } catch (error) {
        setLoading(false);
        const errorMessage =
          error.response?.data?.message || "Something went wrong!";
        toast.error(errorMessage);
      }
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
            Register as a new user
          </h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="py-8 px-4 sm:px-10 rounded-2xl border border-white/40 bg-white/25 bg-clip-padding backdrop-blur-3xl backdrop-saturate-200 shadow-2xl ring-1 ring-white/30 transition hover:bg-white/30">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                 Full Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    
                    className="appearance-none block w-full px-3 py-2 rounded-md bg-white/30 border border-white/50 text-gray-900 placeholder-gray-600 shadow-inner backdrop-blur-sm focus:outline-none focus:bg-white/40 focus:ring-2 focus:ring-orange-300 focus:border-orange-300 sm:text-sm transition"
                  />
                </div>
              </div>

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

              <div>
                <label htmlFor="avatar"
                className="block text-sm font-medium text-gray-700"
                >
                </label>
                <div className="mt-2 flex items-center">
                    <span className="inline-block h-8 w-8 rounded-full overflow-hidden">
                        {
                            avatar ?
                            (
                                <img src={URL.createObjectURL(avatar)} alt="avatar" className='h-full w-full object-cover rounded-full'/>
                            ) : (
                                <RxAvatar  className="h-8 w-8"/>
                            )}
                        
                    </span>
                    <label htmlFor="file-input"
                    className="ml-5 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <span>Upload a file</span>
                        <input type="file" name="avatar" id="file-input" accept=".jpg, .jpeg, .png"
                        onChange={handleFileInputChange}
                        className='sr-only'
                        />
                    </label>
                </div>
              </div>
              
              <div>
                <button
                  type="submit"
                  className="group relative w-full h-[44px] flex justify-center items-center py-2 px-4 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-200/60 ring-1 ring-white/40 transition"
                >{loading ? <LoaderIcon/> : "Submit"}
                </button>
              </div>
              <div className="flex items-center justify-center mt-4">
                <h4 className="mr-2 text-gray-700">Already have an account?</h4>
                <Link to="/sign-up" className="text-sky-600 hover:text-sky-500">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

export default Signup;
