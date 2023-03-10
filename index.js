import express from 'express';
import dotenv from 'dotenv';
import { Shopify } from '@shopify/shopify-api';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';

dotenv.config();

const host = 'localhost';
const port = process.env.PORT || 9000;

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_API_SCOPES,
  HOST,
  X_PROJECT_ACCESS_TOKEN,
  X_SHOPIFY_ACCESS_TOKEN,
} = process.env;

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shahidpt0982219@gmail.com',
    pass: 'gnxlakmqnoewvnsa'
  }
});

const shops = {};

Shopify.Context.initialize({
  API_KEY: SHOPIFY_API_KEY,
  API_SECRET_KEY: SHOPIFY_API_SECRET,
  SCOPES: SHOPIFY_API_SCOPES,
  HOST_NAME: HOST.replace(/https:\/\//, ''),
  IS_EMBEDDED_APP: true,
});

const app = express();

var urlencodedParser = bodyParser.urlencoded({ extended: true });


app.use(express.urlencoded({ extended : true }));
app.use(express.json());
app.use(cors());

app.get('/', async (req, res) => {
  //res.send('Hello World !');
  if (typeof shops[req.query.shop] !== 'undefined') {
    // const sessionToken = await getSessionToken(bridgeApp);
    // console.log(sessionToken);
    res.send('Hello World');
  } else {
    res.redirect(`/auth?shop=${req.query.shop}`);
  }
});

app.get('/auth', async (req, res) => {
  const authRoute = await Shopify.Auth.beginAuth(
    req,
    res,
    req.query.shop,
    '/auth/callback',
    false
  );
  res.redirect(authRoute);
});

app.get('/auth/callback', async (req, res) => {
  const shopSession = await Shopify.Auth.validateAuthCallback(
    req,
    res,
    req.query
  );
  console.log(shopSession);
  shops[shopSession.shop] = shopSession;
  res.redirect(`/?shop=${shopSession.shop}&host=${req.query.host}`);
  // res.redirect(
  //   `https://${shopSession.shop}/admin/apps/custom-subscriptions-manager`
  // );
});

// Verify that the request is coming from an authentic source
async function verifyRequest(req, res, next) {
try{	
  console.log(req.query);
  console.log(req.body);
  //let parsedBody = JSON.parse(req.body);
  //console.log(parsedBody);
  // DESTRUCTURE signature and rest of query object
  const { signature, ...restQueryString } = req.query;

  if (signature && restQueryString) {
    // console.log(signature, restQueryString);

    // Prepare the query string for hashing by
    // sorting and concatenating into a string
    const sortedParams = Object.keys(restQueryString)
      .sort()
      .reduce((accumulator, key) => {
        accumulator += key + '=' + restQueryString[key];

        return accumulator;
      }, '');
    // console.log(sortedParams);

    // Calculate the hex digest of sortedParams
    const calculatedSignature = calculateHexDigest(sortedParams);

    console.log(calculatedSignature);
    console.log(signature);

    // Check if both signatures are same. If yes,
    // goto next step. If no, return 400 status error
    if (calculatedSignature === signature) {
      const { logged_in_customer_id, ...rest } = restQueryString;
      if (req.body.customer_id) {
        if (req.body.customer_id === logged_in_customer_id) {
          console.log('Customer id matched');
          next();
        } else {
          console.log('Unauthenticated request. Customer ID mismatch');
          res.status(400).send(`Unauthenticated Request`);
        }
      } else {
        console.log(
          'Unauthenticated request. No customer id found in request.'
        );
        res.status(400).send(`Unauthenticated Request`);
      }
    } else {
      console.log('Unauthenticated request');
      res.status(400).send(`Unauthenticated Request`);
    }
  } else {
    console.log('Unauthenticated request');
    res.status(400).send(`Unauthenticated Request`);
  }
}catch(err){
   console.log(err);
}
}

// Get all subscriptions for an email
app.post(
  '/subscriptions',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      console.log(req.body.customer_id);
      const email = await getCustomerEmail(req.body.customer_id);
      console.log(email);
      const query = `query{
          subscriptions(email:"${email}",statuses:[ACTIVATED,INACTIVE]){
            nodes {
              id
              token
              name
              lastName
              activatedAt
              chargeDayOfTheMonth
              startDate
              paidAmount
              paymentMethod
              address
              houseNumber
              zipcode
              city
              country
              locale
              email
              phoneNumber
              status
              orders {
                id
                status
                shipmentDate
                amountCents
                
              }
              orderedProducts {
                id
                shipmentDate
                quantity
                status
                product {
                 id
                 title
                 imageUrl
                 priceWithSymbol
                 interval
                 intervalUnitOfMeasure
                }
              }
              invoices {
                id
                invoiceStatus
                invoiceNumber
                detailsUrl
              }
              extraFields {
                id
                extraFieldId
                name
                value
              }
              activePlan {
                id
                name
                initialAmountIncludingTaxCents
                initialAmountExcludingTaxCents
                monthlyAmountCents
              }
            }
          }
        }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// getSubscription API call
app.post(
  '/subscriptions/getSubscription',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `query{
        getSubscription(token:"${req.body.token}"){
        id
        name
        email
        fullAddress
        city
        zipcode
        country
        paymentMethod
	appliedOrderDiscountPromotions{
          active
          discountCode{
            code
          }
	  promotion{
            percentDiscount
          }
        }
        orderedProducts{
           id
           shipmentDate
           quantity
           product{
            id
            title
            priceWithSymbol
            imageUrl
            interval
            intervalUnitOfMeasure
           }
           interval
           intervalUnitOfMeasure
         }
         orders{
          id
          amountCents
          shippingCostsCents
         }
       }
     }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Set Next Shipment API call
app.post(
  '/subscriptions/setNextShipmentDate',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `mutation{
        updateOrderedProduct(input:{
          id:"${req.body.orderedProductId}"
          shipmentDate:"${req.body.nextShipmentDate}"
        }){
          orderedProduct{
            id
            shipmentDate
            quantity
            product{
             id
             title
             priceWithSymbol
             imageUrl
             interval
             intervalUnitOfMeasure
            }
            interval
            intervalUnitOfMeasure
          }
        }
      }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Update Order Schedule API call
app.post(
  '/subscriptions/updateOrderSchedule',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `mutation{
        updateOrderedProduct(input:{
          id:"${req.body.orderedProductId}",
          interval:${req.body.interval},
          intervalUnitOfMeasure:"${req.body.intervalUnitOfMeasure}"
        }){
          orderedProduct{
            id
            shipmentDate
            quantity
            product{
             id
             title
             priceWithSymbol
             imageUrl
             interval
             intervalUnitOfMeasure
            }
            interval
            intervalUnitOfMeasure
          }
        }
      }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Update Quantity API call
app.post(
  '/subscriptions/updateQuantity',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `mutation{
        updateOrderedProduct(input:{
          id:"${req.body.orderedProductId}"
          quantity:${req.body.quantity}
        }){
          orderedProduct{
            id
            shipmentDate
            quantity
            product{
             id
             title
             priceWithSymbol
             imageUrl
             interval
             intervalUnitOfMeasure
            }
            interval
            intervalUnitOfMeasure
          }
        }
      }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Swap Product API call
app.post(
  '/subscriptions/swapOrderedProduct',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `mutation{
        updateOrderedProduct(input:{
          id:"${req.body.orderedProductId}"
          quantity:${req.body.quantity}
          productId:"${req.body.productId}"
        }){
          orderedProduct{
            id
            shipmentDate
            quantity
            product{
             id
             title
             priceWithSymbol
             imageUrl
             interval
             intervalUnitOfMeasure
            }
            interval
            intervalUnitOfMeasure
          }
        }
      }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Add/Create Product API call
app.post(
  '/subscriptions/createOrderedProduct',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = ` mutation{
						createOrderedProduct(input : {
						  orderedProduct : {
						  productId : "${req.body.productId}"
						  quantity : ${req.body.quantity}
						  }
						  subscriptionId : "${req.body.subscriptionId}"
						  }){
						  orderedProduct {
							productId
							quantity
						  }
						  subscription {
							id
							token
							name
							lastName
							activatedAt
							chargeDayOfTheMonth
							startDate
							paidAmount
							paymentMethod
							address
							houseNumber
							zipcode
							city
							country
							locale
							email
							phoneNumber
							status
							orders {
								id
								status
								shipmentDate
								amountCents
								invoice {
									id
									status
									detailsUrl
								}
							}
						   orderedProducts {
							  id
							  shipmentDate
							  quantity
							  status
							  product{
									id
									title
									imageUrl
									priceWithSymbol
									interval
									intervalUnitOfMeasure
								}
							}
							extraFields{
								id
								extraFieldId
								name
								value
							}
							activePlan {
								id
								name
								initialAmountIncludingTaxCents
								initialAmountExcludingTaxCents
								monthlyAmountCents              
								}
							}
					  	}
					}`;
      console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Skip Shipment API call
app.post(
  '/subscriptions/skipShipment',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = ` mutation{
        updateOrderedProduct(input:{
          id:"${req.body.orderedProductId}"
          shipmentDate:"${req.body.nextShipmentDate}"
        }){
          orderedProduct{
            id
            shipmentDate
            quantity
            product{
             id
             title
             priceWithSymbol
             imageUrl
             interval
             intervalUnitOfMeasure
            }
            interval
            intervalUnitOfMeasure
          }
        }
      }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Cancel Subscription API call
app.post(
  '/subscriptions/cancelSubscription',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `mutation{
          cancelSubscription(input:{
           id:"${req.body.subscriptionId}"
           token:"${req.body.subscriptionToken}"
         }){
           subscription{
             id
             token
             status
           }
         }
         }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Apply Discount Code API call
app.post(
  '/subscriptions/applyDiscountCode',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      let query = `
      query{
        getDiscountCode(code:"${req.body.discountCode}"){
          promotionId
          expired
        }
      }
      `;
      //console.log(query);

      let response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });
      const { promotionId, expired } = response.data.data.getDiscountCode;
      //console.log(promotionId, expired);
      if (!expired) {
        query = `
          mutation{
            applyPromotionToSubscription(input:{
              promotionId : "${promotionId}"
              subscriptionId: "${req.body.subscriptionId}"
            }){
              appliedPromotion{
                id
                active
		promotion{
		    percentDiscount
		  }
              }
              errors{
                message
              }
            }
          }      
        `;
        //console.log(query);
        response = await axios({
          method: 'post',
          url: 'https://portal.firmhouse.com/graphql',
          headers: {
            'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          },
          data: {
            query: query,
          },
        });
        //console.log(response.data.data);
        if (
          response.data.data.applyPromotionToSubscription.errors.length == 0
        ) {
          res.status(200).send({
		  message:'Discount code applied successfully.',
		  discountPercent:response.data.data.applyPromotionToSubscription.appliedPromotion.promotion.percentDiscount
	  });
        } else {
          res.send('Invalid  or used discount');
        }
      } else {
        res.send('Discount code expired');
      }
    } catch (error) {
      //console.log(error);
      res.send('Invalid  or used discount');
    }
  }
);

// Update Added Product API call
app.post(
  '/subscriptions/updateAddedProduct',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = ` mutation{
        updateOrderedProduct(input:{
          id:"${req.body.orderedProductId}"
          shipmentDate:"${req.body.nextShipmentDate}"
          interval:${req.body.interval}
          intervalUnitOfMeasure:"${req.body.intervalUnitOfMeasure}"
        }){
          orderedProduct{
            id
            shipmentDate
            quantity
            product{
             id
             title
             priceWithSymbol
             imageUrl
             interval
             intervalUnitOfMeasure
            }
            interval
            intervalUnitOfMeasure
          }
        }
      }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
          'X-SUBSCRIPTION-TOKEN': req.body.subscriptionToken,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Create subscription API call
app.post(
  '/subscriptions/createSubscription',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      var items = JSON.parse(req.body.items);

      var orderedProductsString = '';
      items.map(product => {
        orderedProductsString += `{
        productId : "${product.firmhouseid}",
        quantity : ${product.quantity},
        customPriceCents : ${product.final_price},
    }`;
      });

      // Run the create subscription query
      let query = `
            mutation {
            createSubscription(input: {
            name: "${req.body.name}", 
            address: "${req.body.address}", 
            houseNumber: "${req.body.houseNumber}", 
            zipcode: "${req.body.zipcode}", 
            city: "${req.body.city}", 
            country: "${req.body.country}",
            email: "${req.body.email}", 
            phoneNumber: "${req.body.phoneNumber}",
            returnUrl: "https://brauzz-de.myshopify.com/pages/order-confirmation", 
            paymentPageUrl: "http://example.com/cart", 
            orderedProducts: [${orderedProductsString}]
            }) {
            paymentUrl
            subscription{
              id
              token
              paymentMethod
              orderedProducts{
                id
                productId
                interval
                intervalUnitOfMeasure
              }
            }
            errors {
              attribute
              message
              path
            }
          }
        }`;
      console.log(query);

      let response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Get all products API call
app.post(
  '/subscriptions/getAllProducts',
  urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      const query = `
      query{
        products{
          nodes{
            id
            title
            imageUrl
            interval
            intervalUnitOfMeasure
            priceWithSymbol
            productType
          }
        }
      }
    `;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Get return orders API call
app.post(
  '/subscriptions/getReturnOrders',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      //console.log(req.body);    
      const query = `query{
                        returnOrders(
                        subscriptionId:"${req.body.subscriptionId}"
                        ){
                        nodes{
                            id
                            createdAt
                            reason
                            returnDate
                            returnedOn
                            status
                            returnOrderProducts{
                            orderedProductId
                            quantity
                            product{
                                title
                                imageUrl
                            }
                            }
                        }
                        }
                    }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);


// Create return order API call
app.post(
  '/subscriptions/createReturnOrder',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      //console.log(req.body);    
      const query = `mutation{
          createReturnOrder(input:{
          subscriptionId : "${req.body.subscriptionId}"
          returnOrderProducts : {
            orderedProductId: "${req.body.orderedProductId}"
            quantity: ${req.body.quantity}
          }
          reason:"${req.body.reason}"
          }){
          returnOrder{
            id
            createdAt
            reason
            returnOrderProducts{
            id
            orderedProductId
            product{
              title
            }
            quantity
            }
          }
          errors{
            message
          }
          }
        }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Activate subscription API call
app.post(
  '/subscriptions/activateSubscription',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      //console.log(req.body);    
      const query = `mutation {
                        activateSubscription(input: {
                                id: "${req.body.subscriptionId}"
                            })
                        {
                            subscription {
                                id
				token
                                name
                                lastName
                                activatedAt
				chargeDayOfTheMonth
                                startDate
                                paidAmount
                                paymentMethod
                                address
                                houseNumber
                                zipcode
                                city
                                country
                                locale
                                email
                                phoneNumber
                                status
                                orders {
                                    id
                                    status
                                    shipmentDate
                                    amountCents
                                    invoice {
                                        id
                                        status
                                        detailsUrl
                                    }
                                }
                                orderedProducts {
                                  id
                                  shipmentDate
                                  quantity
                                  status
                                  product {
                                        id
                                        title
                                        imageUrl
                                        priceWithSymbol
                                        interval
                                        intervalUnitOfMeasure
                                    }
                                }
                                extraFields{
                                    id
                                    extraFieldId
                                    name
                                    value
                                }
                                activePlan {
                                    id
                                    name
                                    initialAmountIncludingTaxCents
                                    initialAmountExcludingTaxCents
                                    monthlyAmountCents              
                                }
                            }
                        }
                    }`;
      console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Update Size API call
app.post(
  '/subscriptions/updateSize',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      //console.log(req.body);    
      const query = `mutation {
                        updateSubscription(input: {
                                token: "${req.body.subscriptionToken}"
                                extraFields: {
                                    id: "${req.body.answerId}"
                                    extraFieldId: "987"
                                    value: "${req.body.size}"
                                }
                            })
                        {
                            subscription {
                                id
				token
                                name
                                lastName
                                activatedAt
				chargeDayOfTheMonth
                                startDate
                                paidAmount
                                paymentMethod
                                address
                                houseNumber
                                zipcode
                                city
                                country
                                locale
                                email
                                phoneNumber
                                status
                                orders {
                                    id
                                    status
                                    shipmentDate
                                    amountCents
                                    invoice {
                                        id
                                        status
                                        detailsUrl
                                    }
                                }
                                orderedProducts {
                                  id
                                  shipmentDate
                                  quantity
                                  status
                                  product {
                                        id
                                        title
                                        imageUrl
                                        priceWithSymbol
                                        interval
                                        intervalUnitOfMeasure
                                    }
                                }
                                extraFields{
                                    id
                                    extraFieldId
                                    name
                                    value
                                }
                                activePlan {
                                    id
                                    name
                                    initialAmountIncludingTaxCents
                                    initialAmountExcludingTaxCents
                                    monthlyAmountCents              
                                }
                            }
                        }
                    }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Update Refresh date API call
app.post(
  '/subscriptions/updateRefreshDate',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
      //console.log(req.body);    
      const query = `mutation {
                        updateSubscription(input: {
                                token: "${req.body.subscriptionToken}"
                                extraFields: {
                                    id: "${req.body.answerId}"
                                    extraFieldId: "1025"
                                    value: "${req.body.refreshDate}"
                                }
                            })
                        {
                            subscription {
                                id
				token
                                name
                                lastName
                                activatedAt
				chargeDayOfTheMonth
                                startDate
                                paidAmount
                                paymentMethod
                                address
                                houseNumber
                                zipcode
                                city
                                country
                                locale
                                email
                                phoneNumber
                                status
                                orders {
                                    id
                                    status
                                    shipmentDate
                                    amountCents
                                    invoice {
                                        id
                                        status
                                        detailsUrl
                                    }
                                }
                                orderedProducts {
                                  id
                                  shipmentDate
                                  quantity
                                  status
                                  product {
                                        id
                                        title
                                        imageUrl
                                        priceWithSymbol
                                        interval
                                        intervalUnitOfMeasure
                                    }
                                }
                                extraFields{
                                    id
                                    extraFieldId
                                    name
                                    value
                                }
                                activePlan {
                                    id
                                    name
                                    initialAmountIncludingTaxCents
                                    initialAmountExcludingTaxCents
                                    monthlyAmountCents              
                                }
                            }
                        }
                    }`;
      //console.log(query);

      const response = await axios({
        method: 'post',
        url: 'https://portal.firmhouse.com/graphql',
        headers: {
          'X-PROJECT-ACCESS-TOKEN': X_PROJECT_ACCESS_TOKEN,
        },
        data: {
          query: query,
        },
      });

      // console.log(response.data.data.subscriptions.nodes);
      res.json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);

// Buy product API call
app.post(
  '/subscriptions/buyProduct',
  //urlencodedParser,
  verifyRequest,
  async (req, res) => {
    try {
     let emailBody = `<div style="display:flex;border:1px solid grey">
	  <img style="width:200px;margin:10px" src="${req.body.image}"/>
	  <div style="margin:10px">
	    <p>
	      <b>Name:</b><span>${req.body.subscriptionName}</span>
	    </p>
	    <p>
	      <b>Subscription ID:</b><span>${req.body.subscriptionId}</span>
	    </p>
	    <p>
	      <b>Product:</b><span>${req.body.productTitle}</span>
	    </p>
	  </div>
	</div>`;
      let emailSent = sendEmail(req.body.subscriptionEmail,"Request to buy product",emailBody);
      console.log(emailSent);
      if(emailSent == true){
	res.status(200).send('Email sent successfully');
      }else{
	res.status(400).send('Email could not be sent. Please try later.');
      }
    } catch (error) {
      console.log(error);
      res.status(500).send('Oops ! Some error occurred');
    }
  }
);


// Function to calculate HEX Digest
function calculateHexDigest(query) {
  var hmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET);

  //passing the data to be hashed
  const data = hmac.update(query);

  //Creating the hmac in the required format
  const gen_hmac = data.digest('hex');

  //Printing the output on the console
  // console.log('hmac : ' + gen_hmac);
  return gen_hmac;
}

// Get the customer email
async function getCustomerEmail(customer_id) {
  const gid = 'gid://shopify/Customer/' + customer_id;

  // Query to retrieve customer email from customer id
  const query = `query{
        customer(id:"${gid}"){
        email
      }
    }`;
  //console.log(query);

  try {
    const response = await axios({
      method: 'post',
      url: 'https://oioioidev.myshopify.com/admin/api/graphql.json',
      headers: {
        'X-Shopify-Access-Token': X_SHOPIFY_ACCESS_TOKEN,
      },
      data: {
        query: query,
      },
    });

    //console.log(response.data);
    return response.data.data.customer.email;
  } catch (error) {
    console.log(error);
  }
}

// Test Route
app.get('/subscriptions/test', (req, res) => {
  res.send('Test Successfull');
});

// Send email
async function sendEmail(cc,subject,html){
try{
var mailOptions = {
  from: 'shahidpt0982219@gmail.com',
  to: 'shahid@deardigital.com',
  cc: [
      cc
  ],
  subject: subject,
  //text: 'That was easy!',
  html: html
}

let info = await transporter.sendMail(mailOptions);
if(info){
  console.log("Email sent: "+ info.response);
  return true;
}else{
  return false;
}
}catch(err){
  console.log(err);
  return false;
}
}

app.listen(port, () => {
  console.log('App is running on port ' + port);
});
