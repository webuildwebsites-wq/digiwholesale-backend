import dotenv from 'dotenv';
dotenv.config({ path: 'D:/DigiBySR/Wholesale-Backend/digiwholesale-backend/.env' });
import mongoose from 'mongoose';

async function run() {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to Atlas!');
    const db = mongoose.connection.db;
    
    const prods = await db.collection('digiproducts').find({
        productName: { $regex: '^\\s*ANISH SINGLE 1\\s*$', $options: 'i' },
        isDeleted: { $ne: true }
    }).project({ sph: 1, cyl: 1, addition: 1, axis: 1, buyingPrice: 1, sellingPrice: 1, price: 1, mrp: 1 }).toArray();
    
    console.log('Total ANISH SINGLE 1 variants:', prods.length);
    
    // Group by sellingPrice
    const bySelling = {};
    prods.forEach(p => {
        const sp = p.sellingPrice ?? p.price ?? 0;
        if (!bySelling[sp]) bySelling[sp] = [];
        bySelling[sp].push(p);
    });
    console.log('Distinct selling prices:', Object.keys(bySelling));
    Object.keys(bySelling).forEach(sp => {
        const list = bySelling[sp];
        const sphs = list.map(p => parseFloat(p.sph)).filter(x => !isNaN(x)).sort((a,b)=>a-b);
        const cyls = list.map(p => parseFloat(p.cyl)).filter(x => !isNaN(x)).sort((a,b)=>a-b);
        console.log(`Selling ₹${sp}: count=${list.length}, SPH=${sphs[0]} to ${sphs[sphs.length-1]}, CYL=${cyls[0]} to ${cyls[cyls.length-1]}`);
    });

    // Check distinct buyingPrice
    const byBuying = {};
    prods.forEach(p => {
        const bp = p.buyingPrice ?? p.price ?? 0;
        if (!byBuying[bp]) byBuying[bp] = [];
        byBuying[bp].push(p);
    });
    console.log('Distinct buying prices:', Object.keys(byBuying));
    Object.keys(byBuying).forEach(bp => {
        const list = byBuying[bp];
        const sphs = list.map(p => parseFloat(p.sph)).filter(x => !isNaN(x)).sort((a,b)=>a-b);
        const cyls = list.map(p => parseFloat(p.cyl)).filter(x => !isNaN(x)).sort((a,b)=>a-b);
        console.log(`Buying ₹${bp}: count=${list.length}, SPH=${sphs[0]} to ${sphs[sphs.length-1]}, CYL=${cyls[0]} to ${cyls[cyls.length-1]}`);
    });

    // Check distinct mrp
    const byMrp = {};
    prods.forEach(p => {
        const m = p.mrp ?? 0;
        if (!byMrp[m]) byMrp[m] = [];
        byMrp[m].push(p);
    });
    console.log('Distinct MRP:', Object.keys(byMrp));
    Object.keys(byMrp).forEach(m => {
        const list = byMrp[m];
        const sphs = list.map(p => parseFloat(p.sph)).filter(x => !isNaN(x)).sort((a,b)=>a-b);
        const cyls = list.map(p => parseFloat(p.cyl)).filter(x => !isNaN(x)).sort((a,b)=>a-b);
        console.log(`MRP ₹${m}: count=${list.length}, SPH=${sphs[0]} to ${sphs[sphs.length-1]}, CYL=${cyls[0]} to ${cyls[cyls.length-1]}`);
    });

    // Check LensHistory
    const lh = await db.collection('lenshistories').find({
        productName: { $regex: '^\\s*ANISH SINGLE 1\\s*$', $options: 'i' }
    }).toArray();
    console.log('LensHistory count for ANISH SINGLE 1:', lh.length);
    lh.forEach(h => {
        console.log(`History: action=${h.action}, priceType=${h.priceType}, buy=${h.buyingPrice}, sell=${h.sellingPrice}, mrp=${h.mrp}, sph=${h.sphRange}, cyl=${h.cylRange}`);
    });

    await mongoose.disconnect();
}
run().catch(e => console.error(e));
