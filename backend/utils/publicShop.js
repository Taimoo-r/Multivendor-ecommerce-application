// What the public API may reveal about a shop. Embedded shop copies on products
// and events used to include the owner's email, phone and balance.
const publicShop = (shop) => {
  if (!shop) return shop;
  const s = shop.toObject ? shop.toObject() : shop;
  return {
    _id: s._id,
    name: s.name,
    avatar: s.avatar,
    description: s.description,
    address: s.address,
    createdAt: s.createdAt,
  };
};

// Return a plain object of a product/event with its embedded shop sanitised.
const withPublicShop = (doc) => {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (o.shop) o.shop = publicShop(o.shop);
  return o;
};

module.exports = { publicShop, withPublicShop };
