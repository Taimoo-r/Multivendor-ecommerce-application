const express = require("express");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const {isAuthenticated} = require("../middleware/auth");
const Order = require("../model/order");
const Product = require("../model/product");

//create new order
router.post("/create-order", isAuthenticated, catchAsyncErrors(async(req, res, next) => {
    try {
        
        const {cart, shippingAddress, user, totalPrice, paymentInfo} = req.body;

        const shopItemMap = new Map();

        for(const item of cart){
            const shopId = item.shopId;
            if(!shopItemMap.has(shopId)){
                shopItemMap.set(shopId, []);
            }
            shopItemMap.get(shopId).push(item);
        }

        //create order for each shop
        const orders = []

        for(const [shopId, items] of shopItemMap){
            const order = await Order.create({cart: items, shippingAddress, user, totalPrice, paymentInfo});
            orders.push(order);
        }

        res.status(201).json({
            success: true,
            orders,
        });

    } catch (error) {
        return next(new ErrorHandler(error.message, 400));
    }
})
);

module.exports = router;