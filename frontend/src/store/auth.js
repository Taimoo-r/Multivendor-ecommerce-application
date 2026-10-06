import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../lib/api";
import { vzApi } from "./api";

export const loadUser = createAsyncThunk("auth/loadUser", async () => {
  const { data } = await api.get("/user/load-user");
  return data.user;
});
// Logging out also drops the signed-in account's cached data (orders, seller pages).
export const logoutUser = createAsyncThunk("auth/logoutUser", async (_, { dispatch }) => {
  await api.post("/user/logout");
  dispatch(vzApi.util.invalidateTags(["Orders"]));
});
export const loadSeller = createAsyncThunk("seller/loadSeller", async () => {
  const { data } = await api.get("/shop/getSeller");
  return data.seller;
});
export const logoutSeller = createAsyncThunk("seller/logoutSeller", async (_, { dispatch }) => {
  await api.post("/shop/logout");
  dispatch(vzApi.util.invalidateTags(["SellerProducts", "Orders", "Coupons", "Stats"]));
});

// status: "loading" until the first request answers, then "authed" | "guest"
const userSlice = createSlice({
  name: "auth",
  initialState: { user: null, status: "loading" },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.status = action.payload ? "authed" : "guest";
    },
  },
  extraReducers: (b) => {
    b.addCase(loadUser.fulfilled, (s, a) => {
      s.user = a.payload;
      s.status = "authed";
    })
      .addCase(loadUser.rejected, (s) => {
        s.user = null;
        s.status = "guest";
      })
      .addCase(logoutUser.fulfilled, (s) => {
        s.user = null;
        s.status = "guest";
      });
  },
});

const sellerSlice = createSlice({
  name: "seller",
  initialState: { seller: null, status: "loading" },
  reducers: {
    setSeller(state, action) {
      state.seller = action.payload;
      state.status = action.payload ? "authed" : "guest";
    },
  },
  extraReducers: (b) => {
    b.addCase(loadSeller.fulfilled, (s, a) => {
      s.seller = a.payload;
      s.status = "authed";
    })
      .addCase(loadSeller.rejected, (s) => {
        s.seller = null;
        s.status = "guest";
      })
      .addCase(logoutSeller.fulfilled, (s) => {
        s.seller = null;
        s.status = "guest";
      });
  },
});

export const { setUser } = userSlice.actions;
export const { setSeller } = sellerSlice.actions;
export const authReducer = userSlice.reducer;
export const sellerReducer = sellerSlice.reducer;
