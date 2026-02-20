import React, { useEffect, useState } from "react";
import { RxCross1 } from "react-icons/rx";
import styles from "../../../styles/style";
import {
  AiFillHeart,
  AiOutlineHeart,
  AiOutlineMessage,
  AiOutlineShoppingCart,
} from "react-icons/ai";
import { backendUrl } from "../../../server";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { addTocart } from "../../../redux/actions/cart";
import {
  addToWishlist,
  removeFromWishlist,
} from "../../../redux/actions/wishlist";

const ProductDetailsCard = ({ setOpen, data }) => {
  const dispatch = useDispatch();
  const { cart } = useSelector((state) => state.cart);
  const { wishlist } = useSelector((state) => state.wishlist);
  const [count, setCount] = useState(1);
  const [isWishlist, setIsWishlist] = useState(false);

  useEffect(() => {
    setIsWishlist(wishlist.some((item) => item._id === data._id));
  }, [wishlist, data._id]);

  const handleToggleWishlist = () => {
    if (isWishlist) {
      dispatch(removeFromWishlist(data));
      toast.success("Removed from wishlist!");
    } else {
      dispatch(addToWishlist(data));
      toast.success("Added to wishlist!");
    }
    setIsWishlist(!isWishlist);
  };

  const handleMessageSubmit = () => {};

  const decrementCount = () => {
    if (count > 1) {
      setCount(count - 1);
    }
  };

  const incrementCount = () => {
    setCount(count + 1);
  };

  const addToCartHandler = (id) => {
    const isItemExists = cart && cart.find((i) => i._id === id);
    if (isItemExists) {
      toast.error("Item is already in the cart!");
    } else {
      if (data.stock < count) {
        toast.error("Product stock limited!");
      } else {
        const cartData = { ...data, qty: count };
        dispatch(addTocart(cartData));
        toast.success("Item added to cart successfully!");
      }
    }
  };

  return (
    <div className="bg-[#fff]">
      {data ? (
        <div className="fixed w-full h-screen top-0 left-0 bg-[#00000030] z-40 flex items-center justify-center">
          <div className="w-[85%] 800px:w-[60%] h-[80vh] overflow-y-scroll 800pv:h-[75vh] bg-white rounded-md shadow-sm relative p-4">
            <RxCross1
              size={30}
              className="absolute right-3 top-3 z-50"
              onClick={() => setOpen(false)}
            />
            <div className="flex flex-col w-full md:flex-row gap-6">
  {/* Left Section (Image + Shop Info) */}
  <div className="w-full md:w-1/2">
    {data.images && data.images[0] ? (
      <img
        src={`${backendUrl}${data.images[0]}`}
        alt={data.name}
        className="w-full h-auto max-h-[400px] object-cover rounded-lg"
      />
    ) : (
      <img
        src={data.imageUrl[0]?.url}
        alt={data.name}
        className="w-full h-auto max-h-[400px] object-contain rounded-lg"
      />
    )}

    {/* Shop Info */}
    <div className="flex items-center mt-4">
      {data.shop?.avatar && (
        <img
          src={`${backendUrl}${data.shop.avatar}`}
          alt={data.shop.name}
          className="w-[50px] h-[50px] rounded-full mr-3 object-cover"
        />
      )}
      <div>
        {data.shop && (
          <>
            <Link to={`/shop/preview/${data.shop._id}`}>
              <h3 className={`${styles.shop_name} text-lg font-semibold`}>
                {data.shop.name}
              </h3>
            </Link>
            <h5 className="text-sm text-gray-600">
              ({data.shop.ratings} Rating)
            </h5>
          </>
        )}
      </div>
    </div>

    {/* Message Button */}
    <button
      className={`${styles.button} bg-black text-white mt-4 rounded-md h-11 w-full flex items-center justify-center`}
      onClick={handleMessageSubmit}
    >
      Send Message <AiOutlineMessage className="ml-2" />
    </button>

    {/* Sold Out */}
    <h5 className="text-[16px] text-red-600 mt-5">
      ({data.totalSell}) Sold Out
    </h5>
  </div>

  {/* Right Section (Product Info) */}
  <div className="w-full md:w-1/2 flex flex-col justify-between">
    <div>
      <h1 className={`${styles.productTitle} text-2xl font-bold`}>
        {data.name}
      </h1>
      <p className="mt-2 text-gray-700">{data.description}</p>

      {/* Price Section */}
      <div className="flex items-center gap-3 mt-4">
        <h4 className={`${styles.productDiscountPrice} text-xl font-bold`}>
          {data.discountPrice} $
        </h4>
        {data.originalPrice && (
          <h3 className={`${styles.price} line-through text-gray-500`}>
            {data.originalPrice} $
          </h3>
        )}
      </div>
    </div>

    {/* Counter & Wishlist */}
    <div className="flex items-center justify-between mt-8">
      <div className="flex items-center">
        <button
          className="bg-gradient-to-r from-teal-400 to-teal-500 text-white font-bold rounded-l px-4 py-2 shadow hover:opacity-80 transition"
          onClick={decrementCount}
        >
          -
        </button>
        <span className="bg-gray-200 text-gray-800 font-medium px-4 py-2">
          {count}
        </span>
        <button
          className="bg-gradient-to-r from-teal-400 to-teal-500 text-white font-bold rounded-r px-4 py-2 shadow hover:opacity-80 transition"
          onClick={incrementCount}
        >
          +
        </button>
      </div>

      {/* Wishlist */}
      {isWishlist ? (
        <AiFillHeart
          size={30}
          className="cursor-pointer"
          onClick={handleToggleWishlist}
          color="red"
          title="Remove from Wishlist"
        />
      ) : (
        <AiOutlineHeart
          size={30}
          className="cursor-pointer"
          onClick={handleToggleWishlist}
          color="#333"
          title="Add to Wishlist"
        />
      )}
    </div>

    {/* Add to Cart */}
    <button
      className={`${styles.button} bg-teal-500 hover:bg-teal-600 mt-6 text-white rounded-md h-11 flex items-center justify-center`}
      onClick={() => addToCartHandler(data._id)}
    >
      Add to Cart <AiOutlineShoppingCart className="ml-2" />
    </button>
  </div>
</div>

          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProductDetailsCard;