import Stripe from 'stripe';
import dotenv from "dotenv";

dotenv.config({ path: "../../config.env" });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCustomer = async (email, name) => {
    const customer = await stripe.customers.create({
        name: name,
        email: email,
    });
    console.log(customer.id);
    return customer;
};

export const createPaymentIntent = async (amount, currency, customer, desc, confirm, email) => {
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: currency,
        payment_method_types: ['card'],
        customer: customer,
        description: desc,
        confirm: confirm,
        receipt_email: email,
    });
    console.log(paymentIntent.client_secret);
    return paymentIntent;
};


// // Create a new customer and then create an invoice item then invoice it:
// stripe.customers
//   .create({
//     email: 'customer@example.com',
//   })
//   .then((customer) => {
//     // have access to the customer object
//     return stripe.invoiceItems
//       .create({
//         customer: customer.id, // set the customer id
//         amount: 2500, // 25
//         currency: 'usd',
//         description: 'One-time setup fee',
//       })
//       .then((invoiceItem) => {
//         return stripe.invoices.create({
//           collection_method: 'send_invoice',
//           customer: invoiceItem.customer,
//         });
//       })
//       .then((invoice) => {
//         // New invoice created on a new customer
//       })
//       .catch((err) => {
//         // Deal with an error
//       });
//   });
