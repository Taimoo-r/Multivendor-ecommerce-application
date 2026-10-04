import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../lib/api";

export const fetchCatalog = createAsyncThunk("catalog/fetch", async () => {
  const [p, e, s] = await Promise.all([
    api.get("/product/get-all-products"),
    api.get("/event/get-all-events"),
    api.get("/shop/get-all-shops"),
  ]);
  return {
    products: p.data.product,
    events: e.data.allEvents,
    shops: s.data.shops,
  };
});

const catalogSlice = createSlice({
  name: "catalog",
  initialState: { products: [], events: [], shops: [], status: "idle" },
  extraReducers: (b) => {
    b.addCase(fetchCatalog.pending, (s) => {
      if (s.status === "idle") s.status = "loading";
    })
      .addCase(fetchCatalog.fulfilled, (s, a) => {
        Object.assign(s, a.payload, { status: "ready" });
      })
      .addCase(fetchCatalog.rejected, (s) => {
        s.status = "error";
      });
  },
});

export const catalogReducer = catalogSlice.reducer;
