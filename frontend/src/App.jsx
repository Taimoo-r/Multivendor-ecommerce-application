import React, { useEffect, useState } from 'react'
import "./index.css"
import {BrowserRouter, Routes, Route} from 'react-router-dom'
import { ToastContainer, toast, Bounce } from 'react-toastify';
import axios from 'axios';
import { server } from './server';
import Store from './redux/store';
import { loadUser } from './redux/actions/user';
import {
  LoginPage,
  SignUpPage,
  ActivationPage,
  HomePage,
  ProductsPage,
  BestSellingPage,
  EventsPage,
  FAQPage,
  OrderSuccessPage,
  ProductDetailsPage,
  CheckOutPage,
  PaymentPage,
  ProfilePage,
  ShopCreatePage,
  SellerActivationPage,
  ShopLoginPage,
  // OrderDetailsPage,
  // TrackOrderPage,
  // UserInbox,
} from "./routes/Routes.js";
import "react-toastify/dist/ReactToastify.css";
import { loadSeller } from "./redux/actions/user.js";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import { ShopHomePage } from "./routes/ShopRoutes.js";
import SellerProtectedRoute from "./routes/SellerProtectedRoute";
import {
  ShopDashboardPage,
  ShopCreateProduct,
  ShopAllProducts,
  ShopCreateEvent,
  ShopAllEvents,
  ShopAllCoupons,
  // ShopPreviewPage,
  // ShopAllOrders,
  // ShopOrderDetails,
  // ShopAllRefunds,
  // ShopSettingPage,
  // ShopWithdrawMoneyPage,
  // ShopInboxPage,
} from "./routes/ShopRoutes.js";
// import {
  // AdminDashboardPage,
  // AdminDashboardUsers,
  // AdminDashboardSellers,
  // AdminDashboardOrders,
  // AdminDashboardProducts,
  // AdminDashboardEvents,
  // AdminDashboardWithdraw,
// } from "./routes/AdminRoutes";
// import ProtectedAdminRoute from "./routes/ProtectedAdminRoute";
import { getAllProducts } from "./redux/actions/product.js";
import { getAllEvents } from "./redux/actions/event";
// import { Elements } from "@stripe/react-stripe-js";
// import { loadStripe } from "@stripe/stripe-js";

export default function App() {
  const [stripeApikey, setStripeApiKey] = useState("");

  // async function getStripeApikey() {
  //   try {
  //     const { data } = await axios.get(`${server}/payment/stripeapikey`);
  //     setStripeApiKey(data.stripeApikey);
  //   } catch (error) {
  //     console.error("Error fetching Stripe API key:", error);
  //   }
  // }

  useEffect(() => {
    Store.dispatch(loadUser());
    Store.dispatch(loadSeller());
    Store.dispatch(getAllProducts());
    Store.dispatch(getAllEvents());
    // getStripeApikey();
  }, []);

  // const stripePromise = stripeApikey ? loadStripe(stripeApikey) : null;

  return (
    <BrowserRouter>
      {/* <Elements stripe={stripePromise}> */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route
            path="/activation/:activation_token"
            element={<ActivationPage />}
          />
          <Route
            path="/seller/activation/:activation_token"
            element={<SellerActivationPage />}
          />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/best-selling" element={<BestSellingPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/faq" element={<FAQPage />} /> 
          <Route path="/product/:id" element={<ProductDetailsPage />} />
          <Route path="/order/success" element={<OrderSuccessPage />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckOutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute>
                <PaymentPage />
              </ProtectedRoute>
            }
          />

          {/* Shop Routes */}
          <Route path="/shop-create" element={<ShopCreatePage />} />
          <Route path="/shop-login" element={<ShopLoginPage />} />
          <Route
            path="/shop/:id"
            element={
              <SellerProtectedRoute>
                <ShopHomePage />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <SellerProtectedRoute>
                <ShopDashboardPage />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-create-product"
            element={
              <SellerProtectedRoute>
                <ShopCreateProduct />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-products"
            element={
              <SellerProtectedRoute>
                <ShopAllProducts />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-create-event"
            element={
              <SellerProtectedRoute>
                <ShopCreateEvent />
              </SellerProtectedRoute>
            }
          />
          <Route
             path="/dashboard-events"
             element={
               <SellerProtectedRoute>
                 <ShopAllEvents />
               </SellerProtectedRoute>
             }
          />
          <Route
            path="/dashboard-coupons"
            element={
             <SellerProtectedRoute>
              <ShopAllCoupons />
             </SellerProtectedRoute>
           }
          />
          {/* 
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <UserInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/order/:id"
            element={
              <ProtectedRoute>
                <OrderDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/track/order/:id"
            element={
              <ProtectedRoute>
                <TrackOrderPage />
              </ProtectedRoute>
            }
          />
          {/*<Route path="/shop/preview/:id" element={<ShopPreviewPage />} />

          <Route
            path="/settings"
            element={
              <SellerProtectedRoute>
                <ShopSettingPage />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-orders"
            element={
              <SellerProtectedRoute>
                <ShopAllOrders />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-refunds"
            element={
              <SellerProtectedRoute>
                <ShopAllRefunds />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <SellerProtectedRoute>
                <ShopOrderDetails />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-withdraw-money"
            element={
              <SellerProtectedRoute>
                <ShopWithdrawMoneyPage />
              </SellerProtectedRoute>
            }
          />
          <Route
            path="/dashboard-messages"
            element={
              <SellerProtectedRoute>
                <ShopInboxPage />
              </SellerProtectedRoute>
            }
          /> */}
          {/* Admin Routes */}
          {/* <Route
            path="/admin/dashboard"
            element={
                <AdminDashboardPage />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin-users"
            element={
                <AdminDashboardUsers />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin-sellers"
            element={
                <AdminDashboardSellers />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin-orders"
            element={
                <AdminDashboardOrders />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin-products"
            element={
                <AdminDashboardProducts />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin-events"
            element={
                <AdminDashboardEvents />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />
          <Route
            path="/admin-withdraw-request"
            element={
                <AdminDashboardWithdraw />
              // <ProtectedAdminRoute>
              // </ProtectedAdminRoute>
            }
          />  */}
        </Routes>
      {/* </Elements> */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </BrowserRouter>
  );
}

// function App() {

//   useEffect(() => {
//     Store.dispatch(loadUser());
//   }, []);

//   return (
//     <>
//       <BrowserRouter>
//         <Routes>
//           <Route path='/' element={<HomePage/>}/>
//           <Route path='/login' element={<LoginPage/>}/>
//           <Route path = '/sign-up' element={<SignUpPage/>}/>
//           <Route path='/activation/:url' element={<ActivationPage/>}/>
//         </Routes>
//         <ToastContainer
//         position="top-right"
//         autoClose={5000}
//         hideProgressBar={false}
//         newestOnTop={false}
//         closeOnClick
//         rtl={false}
//         pauseOnFocusLoss
//         draggable
//         pauseOnHover
//         theme="light"
//         transition={Bounce}
//       />
//       </BrowserRouter>
//     </>
//   )
// }

// export default App
