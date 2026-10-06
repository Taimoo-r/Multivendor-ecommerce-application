import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App";
import store from "./store";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2600,
            style: {
              background: "#0a1a1c",
              color: "#fff",
              fontSize: "14px",
              borderRadius: "10px",
              padding: "10px 14px",
            },
            success: { iconTheme: { primary: "#fff", secondary: "#0a1a1c" } },
            error: { iconTheme: { primary: "#fff", secondary: "#c11d17" } },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
