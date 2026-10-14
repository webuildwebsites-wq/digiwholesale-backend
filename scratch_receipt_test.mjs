import mongoose from 'mongoose';
import { generatePaymentReceiptPDF } from './src/core/services/paymentReceiptService.js';

async function test() {
  await mongoose.connect('mongodb+srv://digitalsolutions_db_user:o1rNKhidNpz5K8IO@digiopticsmanufacture.iuilxjp.mongodb.net/digioptics-wholeseller?retryWrites=true&w=majority');
  try {
    const res = await generatePaymentReceiptPDF('BO-1787820674824-5942');
    console.log('Success! fileName:', res.fileName);
    console.log('receiptData:', JSON.stringify(res.receiptData, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
  await mongoose.disconnect();
}
test();
