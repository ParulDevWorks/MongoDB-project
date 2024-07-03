const express = require("express");
//const { ApolloServer } = require('@apollo/server');
//const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const cors = require('cors');
//onst axious = require("axios");
//const Product = require('./Db');
//async function startServer() {
//  const app = express();
/*  const server = new ApolloServer({
    typeDefs: `
        type Product {
            id: ID!
            title: String!
            body_html: String!
            vendor: String!
            product_type: String!
            created_at: String!
            handle: String!
            updated_at: String!
            published_at: String!
            template_suffix: String
            published_scope: String!
            tags: String!
            status: String!
            admin_graphql_api_id: String!
            variants: [Variant!]!
            options: [Option!]!
            images: [Image!]!
            image: [Image!]!
        }

        type Variant {
            id: String!
            product_id: String!
            title: String!
            price: String!
            sku: String!
            position: String!
            inventory_policy: String!
            compare_at_price: String
            fulfillment_service: String!
            inventory_management: String!
            option1: String!
            option2: String
            option3: String
            created_at: String!
            updated_at: String!
            taxable: String!
            barcode: String!
            grams: String!
            weight: String!
            weight_unit: String!
            inventory_item_id: String!
            inventory_quantity: Int!
            old_inventory_quantity: String!
            requires_shipping: Boolean!
            admin_graphql_api_id: String!
            image_id: String
        }

        type Option {
            id: String!
            product_id: String!
            name: String!
            position: String!
            values: [String!]!
        }

        type Images {
            id: String!
            alt: String
            position: String!
            product_id: String!
            created_at: String!
            updated_at: String!
            admin_graphql_api_id: String!
            width: String!
            height: String!
            src: String!
            variant_ids: [String!]!
        }

    type Image {
     id: String!
     alt: String
     position: String!
     product_id: String!
     created_at: String!
     updated_at: String!
     admin_graphql_api_id: String!
     width: String!
     height: String!
     src: String!
     variant_ids: [String!]!
 }
               type Query {
                getProducts: [Product!]!
            }
        `,
    resolvers: {
      Query: {
        getProducts: async () => {
          try {
            const url = `https://frst-str.myshopify.com/admin/api/2024-04/products.json`;
            const response = await axious.get(url, {
              auth: {
                username: 'a2cd54b8d8a0e035f4f460e6d4595cf8',
                password: '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'
              },
            });
            const products = response.data.products.map(product => ({
              ...product,
              image: [product.image] // Convert single image to array
            }));
            await Product.insertMany(products);

            console.log('Products inserted into MongoDB:', products);

            return products;
          } catch (error) {
            console.error("Error fetching products:", error);
            throw new Error("Failed to fetch products from Shopify API");
          }
        },
      },
    },
  });
  app.use(bodyParser.json());
  app.use(cors());
  //await server.start();
  //app.use("/graphql", expressMiddleware(server))
  app.listen(8000, () => console.log("Server Started on http://localhost:8000"));
}*/
//startServer();

const app= express();
app.use(bodyParser.urlencoded({ extended: true }));

// Parse application/json
app.use(bodyParser.json());
const route= require('./Router/router');

const PORT=8087;
app.use(cors());





app.use('/shopify',route);
//app.use(bodyParser.json());


app.listen(PORT,(req,res)=>{
    console.log('connected',PORT);
})

