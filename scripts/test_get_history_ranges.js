import dotenv from 'dotenv';
dotenv.config({ path: 'D:/DigiBySR/Wholesale-Backend/digiwholesale-backend/.env' });
import mongoose from 'mongoose';

const parsePower = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = String(val).replace(/\+/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const formatPower = (num) => {
  if (num === null || num === undefined) return '';
  return num === 0 ? '0.00' : (num > 0 ? `+${num.toFixed(2)}` : num.toFixed(2));
};

const computePriceRanges = (products, priceField) => {
  if (!products || products.length === 0) return [];
  const groups = new Map();
  products.forEach((p) => {
    let priceVal = p[priceField];
    if (priceVal === undefined || priceVal === null || priceVal === '') {
      priceVal = p.price ?? 0;
    }
    priceVal = Number(priceVal) || 0;

    if (!groups.has(priceVal)) groups.set(priceVal, []);
    groups.get(priceVal).push(p);
  });

  const result = [];
  const sortedPrices = Array.from(groups.keys()).sort((a, b) => a - b);
  sortedPrices.forEach((price) => {
    const list = groups.get(price);
    const sphs = list.map((p) => parsePower(p.sph)).filter((x) => x !== null).sort((a, b) => a - b);
    const cyls = list.map((p) => parsePower(p.cyl)).filter((x) => x !== null).sort((a, b) => a - b);
    const adds = list.map((p) => parsePower(p.addition)).filter((x) => x !== null && x > 0).sort((a, b) => a - b);

    const sphRange = sphs.length > 0 ? `${formatPower(sphs[0])} to ${formatPower(sphs[sphs.length - 1])}` : '';
    const cylRange = cyls.length > 0 ? `${formatPower(cyls[0])} to ${formatPower(cyls[cyls.length - 1])}` : '';
    const additionRange = adds.length > 0 ? `${formatPower(adds[0])} to ${formatPower(adds[adds.length - 1])}` : '';

    result.push({
      price,
      sphRange,
      cylRange,
      additionRange,
      count: list.length,
    });
  });
  return result;
};

async function test() {
  await mongoose.connect(process.env.MONGODB_URL);
  const db = mongoose.connection.db;

  const prods = await db.collection('digiproducts').find({
    productName: { $regex: '^\\s*ANISH SINGLE 1\\s*$', $options: 'i' },
    isDeleted: { $ne: true }
  }).toArray();

  const sp = computePriceRanges(prods, 'sellingPrice');
  const bp = computePriceRanges(prods, 'buyingPrice');
  const mrp = computePriceRanges(prods, 'mrp');

  console.log('SP:', sp);
  console.log('BP:', bp);
  console.log('MRP:', mrp);

  await mongoose.disconnect();
}
test().catch(e => console.error(e));
