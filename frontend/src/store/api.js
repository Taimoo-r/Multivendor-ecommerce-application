import { createApi } from "@reduxjs/toolkit/query/react";
import { api as http } from "../lib/api";

// RTK Query on top of the shared axios instance, so every query gets the
// token-refresh interceptor. `signal` lets RTK Query abort requests nobody needs any more.
const axiosBaseQuery = async ({ url, method = "GET", data, params }, { signal }) => {
  try {
    const res = await http({ url, method, data, params, signal });
    return { data: res.data };
  } catch (e) {
    return {
      error: {
        status: e.response?.status ?? "FETCH_ERROR",
        data: e.response?.data ?? { message: e.message },
        aborted: e.code === "ERR_CANCELED",
      },
    };
  }
};

// Tags:
//   Catalog   anything derived from products (lists, home, facets, shop stats)
//   Item:id   one product/event page
//   Events, Shops, SellerProducts, Orders, Coupons, Stats
export const vzApi = createApi({
  reducerPath: "vzApi",
  baseQuery: axiosBaseQuery,
  keepUnusedDataFor: 120,
  refetchOnReconnect: true,
  tagTypes: ["Catalog", "Item", "Events", "Shops", "SellerProducts", "Orders", "Coupons", "Stats"],
  endpoints: (b) => ({
    // ------------------------------------------------------------ catalogue
    getHome: b.query({
      query: () => ({ url: "/product/home" }),
      providesTags: ["Catalog"],
    }),

    // One page at a time, "load more" fetches the next cursor. The arg is the filter set;
    // changing a filter starts a new cache entry from page one.
    getProducts: b.infiniteQuery({
      query: ({ queryArg, pageParam }) => ({
        url: "/product/list",
        params: { ...queryArg, cursor: pageParam || undefined },
      }),
      infiniteQueryOptions: {
        initialPageParam: "",
        getNextPageParam: (last) => last.nextCursor || undefined,
      },
      providesTags: ["Catalog"],
    }),

    // a single page (header search, related items, small rows)
    searchProducts: b.query({
      query: (params) => ({ url: "/product/list", params }),
      transformResponse: (r) => ({ products: r.products, total: r.total }),
      providesTags: ["Catalog"],
    }),

    getFacets: b.query({
      query: (q) => ({ url: "/product/facets", params: q ? { q } : undefined }),
      transformResponse: (r) => r.counts,
      providesTags: ["Catalog"],
    }),

    getItem: b.query({
      query: (id) => ({ url: `/product/item/${id}` }),
      providesTags: (r, e, id) => [{ type: "Item", id }],
    }),

    // live price and stock for the cart and wishlist
    lookup: b.query({
      query: (ids) => ({ url: "/product/lookup", params: { ids: ids.join(",") } }),
      transformResponse: (r) => r.items,
      keepUnusedDataFor: 30,
      providesTags: (r = []) => r.map((i) => ({ type: "Item", id: i._id })),
    }),

    getEvents: b.query({
      query: () => ({ url: "/event/get-all-events" }),
      transformResponse: (r) => r.allEvents,
      providesTags: ["Events"],
    }),
    getShopEvents: b.query({
      query: (shopId) => ({ url: `/event/get-all-shop-events/${shopId}` }),
      transformResponse: (r) => r.events,
      providesTags: ["Events"],
    }),

    getShops: b.query({
      query: () => ({ url: "/shop/get-all-shops" }),
      transformResponse: (r) => r.shops,
      providesTags: ["Shops"],
    }),
    getShop: b.query({
      query: (id) => ({ url: `/shop/get-shop-info/${id}` }),
      providesTags: ["Shops"],
    }),
    getShopReviews: b.query({
      query: (shopId) => ({ url: `/product/shop-reviews/${shopId}` }),
      transformResponse: (r) => r.reviews,
      providesTags: ["Catalog"],
    }),

    addReview: b.mutation({
      query: (body) => ({ url: "/product/create-new-review", method: "PUT", data: body }),
      invalidatesTags: (r, e, { productId }) => (e ? [] : [{ type: "Item", id: productId }, "Catalog", "Orders"]),
    }),

    // ------------------------------------------------------------ buyer orders
    getMyOrders: b.query({
      query: (userId) => ({ url: `/order/get-all-orders/${userId}`, params: { limit: 100 } }),
      transformResponse: (r) => r.orders,
      providesTags: ["Orders"],
    }),
    cancelOrder: b.mutation({
      query: (id) => ({ url: `/order/cancel-order/${id}`, method: "PUT" }),
      invalidatesTags: (r, e) => (e ? [] : ["Orders", "Catalog"]),
    }),

    // ------------------------------------------------------------ seller
    getSellerProducts: b.query({
      query: (shopId) => ({ url: `/product/get-all-products-shop/${shopId}` }),
      transformResponse: (r) => r.products,
      providesTags: ["SellerProducts"],
    }),
    createProduct: b.mutation({
      query: (form) => ({ url: "/product/create-product", method: "POST", data: form }),
      invalidatesTags: (r, e) => (e ? [] : ["SellerProducts", "Catalog", "Shops", "Stats"]),
    }),
    deleteProduct: b.mutation({
      query: (id) => ({ url: `/product/delete-shop-product/${id}`, method: "DELETE" }),
      invalidatesTags: (r, e, id) => (e ? [] : ["SellerProducts", "Catalog", "Shops", "Stats", { type: "Item", id }]),
    }),
    createEvent: b.mutation({
      query: (form) => ({ url: "/event/create-event", method: "POST", data: form }),
      invalidatesTags: (r, e) => (e ? [] : ["Events", "Stats"]),
    }),
    deleteEvent: b.mutation({
      query: (id) => ({ url: `/event/delete-shop-event/${id}`, method: "DELETE" }),
      invalidatesTags: (r, e, id) => (e ? [] : ["Events", "Stats", { type: "Item", id }]),
    }),

    getSellerStats: b.query({
      query: () => ({ url: "/order/seller-stats" }),
      transformResponse: (r) => r.stats,
      providesTags: ["Stats"],
    }),

    // cursor pages of 50 for the virtualised orders table
    getSellerOrders: b.infiniteQuery({
      query: ({ queryArg, pageParam }) => ({
        url: `/order/get-seller-all-orders/${queryArg.shopId}`,
        params: { limit: 50, status: queryArg.status || undefined, cursor: pageParam || undefined },
      }),
      infiniteQueryOptions: {
        initialPageParam: "",
        getNextPageParam: (last) => last.nextCursor || undefined,
      },
      providesTags: ["Orders"],
    }),
    updateOrderStatus: b.mutation({
      query: ({ id, status }) => ({ url: `/order/update-order-status/${id}`, method: "PUT", data: { status } }),
      // patch the cached pages in place instead of refetching every page
      async onQueryStarted({ id }, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          for (const { endpointName, originalArgs } of vzApi.util.selectInvalidatedBy(getState(), ["Orders"])) {
            if (endpointName !== "getSellerOrders") continue;
            dispatch(
              vzApi.util.updateQueryData("getSellerOrders", originalArgs, (draft) => {
                for (const page of draft.pages) {
                  const i = page.orders.findIndex((o) => o._id === id);
                  if (i > -1) page.orders[i] = data.order;
                }
              })
            );
          }
          dispatch(vzApi.util.invalidateTags(["Stats", "Catalog"]));
        } catch {
          /* the component shows the error */
        }
      },
    }),

    getCoupons: b.query({
      query: (shopId) => ({ url: `/coupon/get-coupon/${shopId}` }),
      transformResponse: (r) => r.couponCodes,
      providesTags: ["Coupons"],
    }),
    createCoupon: b.mutation({
      query: (body) => ({ url: "/coupon/create-coupon-code", method: "POST", data: body }),
      invalidatesTags: (r, e) => (e ? [] : ["Coupons", "Stats"]),
    }),
    deleteCoupon: b.mutation({
      query: (id) => ({ url: `/coupon/delete-coupon/${id}`, method: "DELETE" }),
      invalidatesTags: (r, e) => (e ? [] : ["Coupons", "Stats"]),
    }),
  }),
});

export const {
  useGetHomeQuery,
  useGetProductsInfiniteQuery,
  useSearchProductsQuery,
  useLazySearchProductsQuery,
  useGetFacetsQuery,
  useGetItemQuery,
  useLookupQuery,
  useGetEventsQuery,
  useGetShopEventsQuery,
  useGetShopsQuery,
  useGetShopQuery,
  useGetShopReviewsQuery,
  useAddReviewMutation,
  useGetMyOrdersQuery,
  useCancelOrderMutation,
  useGetSellerProductsQuery,
  useCreateProductMutation,
  useDeleteProductMutation,
  useCreateEventMutation,
  useDeleteEventMutation,
  useGetSellerStatsQuery,
  useGetSellerOrdersInfiniteQuery,
  useUpdateOrderStatusMutation,
  useGetCouponsQuery,
  useCreateCouponMutation,
  useDeleteCouponMutation,
} = vzApi;

// RTK Query errors carry the API's { message, code, details }
export const queryErrMsg = (error) => error?.data?.message || "Something went wrong";
