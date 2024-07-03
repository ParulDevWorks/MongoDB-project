const mongoose = require('mongoose');
const fetch = require('node-fetch');
//const cron = require('node-cron');

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/test');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit process on connection error
  }
}

// Define productOptionSchema
const productOptionSchema = new mongoose.Schema({
  name: String,
  position: String,
  values: [String],
});

// Define metafieldSchema
const metafieldSchema = new mongoose.Schema({
  module: {
    type: Boolean,
    default: false,
    required: true
  }
});
// Define productSchema
const productSchema = new mongoose.Schema({
  _id: String, // Using Shopify's ID as primary identifier
  shopifyId: { type: String, unique: true }, // Shopify's product ID
  title: String,
  vendor: String,
  tags: [String],
  status: String,
  productType: String,
  handle: String,
  descriptionHtml: String,
  createdAt: Date,
  publishedAt: Date,
  templateSuffix: String,
  images: [{
    id: String,
    url: String,
    width: String,
    height: String,
    altText: String,
  }],
  options: [productOptionSchema],
  variants: [{
    id: String,
    createdAt: Date,
    sku: String,
    title: String,
    taxCode: String,
    updatedAt: Date,
    selectedOptions: [{
      name: String,
      value: String,
    }],
    price: String,
    inventoryPolicy: String,
    inventoryQuantity: Number,
    image: {
      id: String,
      src: String,
      width: String,
    },
    displayName: String,
    barcode: String,
    availableForSale: Boolean,
    compareAtPrice: String,
  }],
  metafields: [metafieldSchema],
});

// Create Product model
const Product = mongoose.model('Product', productSchema);

// Main function to start synchronization process
async function startSyncProcess() {
  try {
    await connectToDatabase(); // Connect to MongoDB
   // checkTokenValidity();
    // Example: Fetch products from Shopify and upload to MongoDB
    await fetchProductsFromShopifyAndUpload();
    // Example: Add metafields to products in MongoDB
   await checkMetafieldsToProducts();
   

    console.log('Synchronization process completed successfully');
  } catch (error) {
    console.error('Error in synchronization process:', error);
  } finally {
    // Optionally disconnect from MongoDB after process completion
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
  
  
}
async function fetchProductsFromShopifyAndUpload() {
  try {
    const products = await fetchProductsFromShopify(); // Fetch products from Shopify

    for (const product of products) {
      try {
        // Check if product already exists in MongoDB by shopifyId
        const existingProduct = await Product.findOne({ shopifyId: product.shopifyId });

        if (existingProduct) {
          // If product exists, update it
          await Product.updateOne({ shopifyId: product.shopifyId }, product);
          console.log(`Updated product: ${product.title}`);
        } else {
          // If product does not exist, create new document
          await Product.create(product);
          console.log(`Created product: ${product.title}`);
        }
      } catch (error) {
        console.error(`Error uploading product ${product.title}:`, error);
      }
    }
  } catch (error) {
    console.error('Error fetching products from Shopify and uploading to MongoDB:', error);
    throw error; // Propagate the error upwards
  }
}

// Function to fetch products from Shopify (replace with your Shopify store details)
async function fetchProductsFromShopify() {
  const products = [];
  let cursor = null;

  do {
    const query = JSON.stringify({
      query: `
      query ($first: Int, $after: String) {c
   products(first: $first, after: $after){
     edges {
       node {
         id
         title
         vendor
         tags
         status
         productType
         handle
         descriptionHtml
         createdAt
         publishedAt
         templateSuffix
         images(first: 10) {
           edges {
             node {
               id
               url
               width
               height
               altText
             }
           }
         }
         options(first: 10) {
               id
               position
               name
               values
         }
         variants(first: 100) {
           edges {
             node {
               id
               createdAt
               sku
               title
               taxCode
               updatedAt
               selectedOptions {
                 name
                 value
               }
               price
               inventoryPolicy
               inventoryQuantity
               image {
                 id
                url
                 width
               }
               displayName
               barcode
               availableForSale
               compareAtPrice
             }
           }
         }
       }
     }
     pageInfo {
       hasNextPage
       endCursor
     }
   }
}
      `,
      variables: {
        first: 250, // Number of products per page
        after: cursor // Use the cursor for pagination
      }
    });
    try {
      const response = await fetch(
        `https://frst-str.myshopify.com/admin/api/2024-04/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": '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',
          },
          body: query,
        }
      );

      const responseData = await response.json();

      if (responseData.errors) {
        console.error('GraphQL Errors:', responseData.errors);
        break; // Exit loop if there are GraphQL errors
      }

      if (responseData.data.products.edges) {
        const edges = responseData.data.products.edges;

        products.push(...edges.map(edge => mapProduct(edge.node)));
        console.log (products);
        cursor = responseData.data.products.pageInfo.endCursor;

        // Check if there are more pages to fetch
        if (!responseData.data.products.pageInfo.hasNextPage) {
          cursor = null; // Set cursor to null to exit the loop
        }
      } else {
        console.error('Products edges not found in GraphQL response');
        break;
      }
    } catch (error) {
      console.error('Error fetching products from Shopify:', error);
      throw error; // Propagate the error upwards
    }
  } while (cursor !== null);

  return products;
}

// Helper function to map GraphQL node to MongoDB schema
function mapProduct(node) {
  return {
    _id: node.id, // Use Shopify's ID as _id
    shopifyId: node.id,
    title: node.title,
    vendor: node.vendor,
    tags: node.tags || [], // Handle cases where tags might be undefined
    status: node.status,
    productType: node.productType,
    handle: node.handle,
    descriptionHtml: node.descriptionHtml,
    createdAt: node.createdAt,
    publishedAt: node.publishedAt,
    templateSuffix: node.templateSuffix,
    images: (node.images && node.images.edges) ? node.images.edges.map(image => ({
      id: image.node.id,
      url: image.node.url,
      width: image.node.width,
      height: image.node.height,
      altText: image.node.altText,
    })) : [],
    options: (node.options && node.options.edges) ? node.options.edges.map(option => ({
      id: option.node.id,
      position: option.node.position,
      name: option.node.name,
      values: option.node.values || [], // Handle cases where values might be undefined
    })) : [],
    variants: (node.variants && node.variants.edges) ? node.variants.edges.map(variant => ({
      id: variant.node.id,
      createdAt: variant.node.createdAt,
      sku: variant.node.sku,
      title: variant.node.title,
      taxCode: variant.node.taxCode,
      updatedAt: variant.node.updatedAt,
      selectedOptions: (variant.node.selectedOptions) ? variant.node.selectedOptions.map(option => ({
        name: option.name,
        value: option.value,
      })) : [],
      price: variant.node.price,
      inventoryPolicy: variant.node.inventoryPolicy,
      inventoryQuantity: variant.node.inventoryQuantity,
      image: (variant.node.image) ? {
        id: variant.node.image.id,
        src: variant.node.image.src,
        width: variant.node.image.width,
      } : {},
      displayName: variant.node.displayName,
      barcode: variant.node.barcode,
      availableForSale: variant.node.availableForSale,
      compareAtPrice: variant.node.compareAtPrice,
    })) : [],
    metafields: [
      { module: false } // Example default value for module
    ],
  };
}

async function checkMetafieldsToProducts() {
  const bulkOperations = [];
  try {
    // Fetch products from MongoDB where metafield.module is false
    const productsToUpdate = await Product.find({ 'metafields.module': false }).limit(1000).exec();

    for (const product of productsToUpdate) {
      const shopifyId = product.shopifyId;
        console.log(shopifyId);
      // Check if metafield 'default_value:release_Date' exists in Shopify for this product
      const metafieldExists = await checkMetafieldInShopify(shopifyId);
      async function checkMetafieldInShopify(shopifyId) {
        const query = JSON.stringify({
          query: `
            query ($productId: ID!) {
              product(id: $productId) {
                metafields(first: 1, namespace: "default_value") {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          `,
          variables: {
            productId: shopifyId,
          }
        });
      
        try {
          const response = await fetch('https://frst-str.myshopify.com/admin/api/2024-04/graphql.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': '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'
            },
            body: query,
          });
      
          const responseData = await response.json();
      
          if (responseData.errors) {
            console.error('GraphQL Errors:', responseData.errors);
            return false;
          }
      
          return responseData.data.product.metafields.edges.length > 0;
        } catch (error) {
          console.error('Error checking metafield in Shopify:', error);
          return false;
        }
      }

      if (metafieldExists) {
        // Update metafield in MongoDB
        await Product.updateOne(
          { shopifyId: shopifyId },
          { $set: { 'metafields.$.value': true } }
        );
        console.log(`Updated metafield for product ${product.title}`);
      } else {
        bulkOperations.push(shopifyId);
      }
    }

    // Create metafields in bulk in Shopify
    const metafields = bulkOperations.map(productId => ({
      namespace: 'default_value',
      key: 'release_Date',
      value: '29-06-2024', // Set your desired default value
      ownerId: productId,
      type: 'string'
    }));
    const batchSize = 200;
    // Execute GraphQL mutation to create metafields in Shopify
try {
      // Splitting metafields array into batches
      for (let i = 0; i < metafields.length; i += batchSize) {
        const batch = metafields.slice(i, i + batchSize);
       console.log(metafields);
    const mutation = `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      }
    }
  }
    `;

    const variables = {
      metafields: batch,
    };

    const response = await fetch('https://frst-str.myshopify.com/admin/api/2024-04/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': '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',
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables,
      }),
    });

    const responseData = await response.json();

    if (responseData.errors) {
      console.error('GraphQL Errors:', responseData.errors);
      return false;
    }

    const createdMetafields = responseData.data.metafieldsSet.metafields;
    console.log('Metafields created successfully:', createdMetafields);
 } } catch (error) {
    console.error('Error creating metafields:', error);
    return false;
  }
    // Update metafield.module to true in MongoDB for each product
    for (const product of productsToUpdate) {
      await Product.updateOne(
        //{ shopifyId: product.shopifyId },
        //{ $set: { 'metafields.module': true } }
        { shopifyId: product.shopifyId, 'metafields.module': false }, // Find by shopifyId and metafields.module: false
        { $set: { 'metafields.$.module': true } } // Update metafields.$.module to true
      );
      console.log(`Updated metafield.module for product ${product.title}`);
    }

    return true; // Return true if process completes successfully
  } catch (error) {
    console.error('Error checking metafield in Shopify:', error);
    return false;
  }
}
/*async function checkTokenValidity() {
  const token = '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';
  const apiEndpoint = 'https://frst-str.myshopify.com/admin/api/2024-04/graphql.json'; // Replace with an endpoint that requires authentication

  try {
    const response = await fetch(apiEndpoint, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
    });

    if (response.status === 401) {
      console.log('Token is expired or invalid.');
      return false;
    }

    const responseData = await response.json();

    if (responseData.errors) {
      console.error('GraphQL Errors:', responseData.errors);
      return false;
    }

    console.log('Token is valid.');
    return true;

  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
}*/

// Example usage

























































/*const Shopify = require('shopify-api-node');
const mongoose= require('mongoose');
//const { request } = require('graphql-request');
//const Product= require('./Db');
const cron = require('node-cron');
const fetch = require("node-fetch");
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/test');
 // cron.start();
  console.log('db connected');
}
main().catch(err => console.error(err));
const productOptionSchema = new mongoose.Schema({
  id: String,
  name: String,
  position: String,
  values: [String], // Assuming values are stored as String
});

const metafieldSchema = new mongoose.Schema({
  id: String,
  namespace: String,
  key: String,
  value: mongoose.Schema.Types.Mixed,
});

const productSchema = new mongoose.Schema({
  shopifyId: { type: String },
  title: String,
  vendor: String,
  tags: [String],
  status: String,
  product_type: String,
  handle: String,
  descriptionHtml: String,
  created_at: Date,
  published_at: Date,
  template_suffix: String,
  images: [{
    id: String,
    url: String,
    width: String,
    height: String,
    altText: String,
  }],
  options: [productOptionSchema],
  variants: [{
    id: String,
    created_at: Date,
    sku: String,
    title: String,
    taxCode: String,
    updated_at: Date,
    selectedOptions: [{
      name: String,
      value: String,
    }],
    price: String,
    inventoryPolicy: String,
    inventoryQuantity: Number,
    image: {
      id: String, // Assuming this should be String, not Number
      src: String,
      width: String,
    },
    displayName: String,
    barcode: String,
    availableForSale: Boolean,
    compareAtPrice: String,
  }],
  metafields: [metafieldSchema], // Adding metafields array to store metafield objects
});
const Product = mongoose.model('Product', productSchema);
async function home(req, res) {
  try {
    // Trigger synchronization process (fetch from Shopify and upload to MongoDB)
    await fetchAllProducts(); // Example: Fetch from Shopify
    await uploadProductsToMongoDB();// Example: Upload to MongoDB
    await addMetafieldsToProducts();
    res.status(200).json({ message: 'Scheduler started successfully' });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
}

let cursor = null; // Initialize cursor variable

async function fetchAllProducts() {
  const products = [];

  do {
    const query = JSON.stringify({
      query: `
       query ($first: Int, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
        id
        title
        vendor
        tags
        status
        productType
        handle
        descriptionHtml
        createdAt
        publishedAt
        templateSuffix
        images(first: 10) {
          edges {
            node {
              id
              url
              width
              height
              altText
            }
          }
        }
        options(first: 10) {
          id
          position
          name
          values
        }
        variants(first: 100) {
          edges {
            node {
              id
              createdAt
              sku
              title
              taxCode
              updatedAt
              selectedOptions {
                name
                value
              }
              price
              inventoryPolicy
              inventoryQuantity
              image {
                id
                url
                width
              }
              displayName
              barcode
              availableForSale
              compareAtPrice
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
      `,
      variables: {
        first: 250, // Number of products per page
        after: cursor // Use the cursor for pagination
      }
    });*/
   /*   query: `
        query ($first: Int, $after: String) {
          products(first: $first, after: $after) {
            edges {
              cursor
              node {
                id
                title
                vendor
                tags
                status
                productType
                handle
                descriptionHtml
                createdAt
                publishedAt
                templateSuffix
                images(first: 10) {
                  edges {
                    node {
                      id
                      url
                      width
                      height
                      altText
                    }
                  }
                }
                options(first: 10) {
                  id
                  position
                  name
                  values
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      createdAt
                      sku
                      title
                      taxCode
                      updatedAt
                      selectedOptions {
                        name
                        value
                      }
                      price
                      inventoryPolicy
                      inventoryQuantity
                      image {
                        id
                        url
                        width
                      }
                      displayName
                      barcode
                      availableForSale
                      compareAtPrice
                    }
                  }
                }
                metafields(first: 10) {
                  edges {
                    node {
                      id
                      namespace
                      key
                      value
                    }
                  }
                }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        first: 250, // Number of products per page
        after: cursor // Use the cursor for pagination
      }
    });*/

   /* try {
      const response = await fetch(
        `https://frst-str.myshopify.com/admin/api/2024-04/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": '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',
          },
          body: query,
        }
      );

      const responseJson = await response.json();
      if (responseJson.errors) {
        console.error('GraphQL Errors:', responseJson.errors);
        break; // Exit loop if there are GraphQL errors
      }

      if (responseJson.data.products.edges) {
        const edges = responseJson.data.products.edges;
        products.push(...edges.map(edge => edge.node));
        cursor = responseJson.data.products.pageInfo.endCursor;

        // Check if there are more pages to fetch
        if (!responseJson.data.products.pageInfo.hasNextPage) {
          cursor = null; // Set cursor to null to exit the loop
        }
      } else {
        console.error('Products edges not found in GraphQL response');
        break;
      }
    } catch (error) {
      console.error('Error fetching Shopify products via GraphQL:', error);
      break;
    }
  } while (cursor !== null);

  return products;
}
async function uploadProductsToMongoDB() {
  const products = await fetchAllProducts();
  console.log(products);
  let inputProduct=products.slice(0, 1000);
  try {
    const insertedProducts = await Product.insertMany(inputProduct);
    console.log('Products inserted into MongoDB:', insertedProducts.length);
  } catch (error) {
    console.error('Error inserting products into MongoDB:', error);
  }
}
const addMetafieldsToProducts = async () => {
  try {
    // Fetch up to 1000 products that do not have metafields
    const productsWithoutMetafields = await Product.find()//.limit(1000);
    console.log(productsWithoutMetafields);
    for (const product of productsWithoutMetafields) {
      const query = JSON.stringify({
        query: `
          query {
            product(id: "${product.shopifyId}") {
              metafields(namespace: "custom_fields", key: "new_field") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    valueType
                  }
                }
              }
            }
          }
        `
      });

      try {
        const response = await fetch(
          'https://frst-str.myshopify.com/admin/api/2024-04/graphql.json',
            {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': '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',
            },
            body: query,
          }
        );

        const responseJson = await response.json();
         console.log(responseJson);
        if (responseJson.data.product.metafields.edges.length > 0) {
          // Update metafields in MongoDB if they exist
          await Product.updateOne(
            { shopifyId: product.shopifyId },
            { metafields: responseJson.data.product.metafields.edges.map(edge => edge.node) }
          );
          console.log(`Metafields updated for product with Shopify ID ${product.shopifyId}`);
        } else {
          // Create metafields if none exist
          const createMetafieldsQuery = JSON.stringify({
            query: `
              mutation {
                productUpdate(input: {
                  id: "${product.shopifyId}",
                  metafields: [
                    { namespace: "custom_fields", key: "new_field", value: "default_value", valueType: STRING }
                    // Add more metafields as needed
                  ]
                }) {
                  product {
                    id
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `
          });

          const createResponse = await fetch(
            'https://your-shopify-store.myshopify.com/admin/api/2024-04/graphql.json',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': 'your-shopify-access-token',
              },
              body: createMetafieldsQuery,
            }
          );

          const createResponseJson = await createResponse.json();

          if (createResponseJson.data.productUpdate.product) {
            console.log(`Metafields created for product with Shopify ID ${product.shopifyId}`);
          } else {
            console.error(`Failed to create metafields for product with Shopify ID ${product.shopifyId}:`, createResponseJson.data.productUpdate.userErrors);
          }
        }
      } catch (error) {
        console.error(`Error fetching or creating metafields for product with Shopify ID ${product.shopifyId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error querying products without metafields:', error);
  }
};



/*cron.schedule('0 * * * *', async () => {
  try {
    // Fetch up to 1000 products that do not have metafields
    const productsWithoutMetafields = await Product.find({ 'metafields': { $exists: false } }).limit(1000);

    for (const product of productsWithoutMetafields) {
      const query = JSON.stringify({
        query: `
          query {
            product(id: "${product.shopifyId}") {
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    valueType
                  }
                }
              }
            }
          }
        `
      });

      try {
        const response = await fetch(
          `https://frst-str.myshopify.com/admin/api/2024-04/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": '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',
            },
            body: query,
          }
        );

        const responseJson = await response.json();

        if (responseJson.data.product.metafields.edges.length > 0) {
          // Update metafields in MongoDB
          await Product.updateOne({ shopifyId: product.shopifyId }, { metafields: responseJson.data.product.metafields.edges.map(edge => edge.node) });
          console.log(`Metafields updated for product with Shopify ID ${product.shopifyId}`);
        }
      } catch (error) {
        console.error(`Error fetching metafields for product with Shopify ID ${product.shopifyId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error querying products without metafields:', error);
  }
});*/
/*const productOptionSchema = new mongoose.Schema({
  id: String,
  name: String,
  position: String,
  values: [String], // Assuming values are stored as String
});

const productSchema = new mongoose.Schema({
  shopifyId: { type: String},
  title: String,
  vendor: String,
  tags: [String], // Allow tags to be an array of strings
  status: String,
  product_type: String, // Renamed productType to product_type
  handle: String,
  descriptionHtml: String,
  created_at: Date, // Mapped createdAt to created_at
  published_at: Date, // Mapped publishedAt to published_at
  template_suffix: String,
  images: [{
    id: String,
    url: String, // Mapped url to src
    width: String,
    height:String,
    altText: String, // Mapped altText to alt
  }],
  options: [productOptionSchema], // Embed options schema
  variants: [{
    id: String,
    created_at: Date, // Mapped createdAt to created_at
    sku: String,
    title: String,
    taxCode: String,
    updated_at: Date, // Mapped updatedAt to updated_at
    selectedOptions: [{
      name: String,
      value: String,
    }],
    price: String,
    inventoryPolicy: String,
    inventoryQuantity: Number,
    image: {
      id: Number,
      src:String,
     width: String
       // Mapped url to src
    },
    displayName: String, // If needed
    barcode: String,
    availableForSale: Boolean, // If needed
    compareAtPrice: String,
  }],
});

const Product = mongoose.model('Product', productSchema);
let cursor = null; // Initialize cursor variable

async function fetchAllProducts() {
  const products = [];

  do {
    const query = JSON.stringify({
      query: `
        query ($first: Int, $after: String) {
          products(first: $first, after: $after) {
            edges {
              cursor
              node {
                id
                title
                vendor
                tags
                status
                productType
                handle
                descriptionHtml
                createdAt
                publishedAt
                templateSuffix
                images(first: 10) {
                  edges {
                    node {
                      id
                      url
                      width
                      height
                      altText
                    }
                  }
                }
                options(first: 10) {
                  id
                  position
                  name
                  values
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      createdAt
                      sku
                      title
                      taxCode
                      updatedAt
                      selectedOptions {
                        name
                        value
                      }
                      price
                      inventoryPolicy
                      inventoryQuantity
                      image {
                        id
                        url
                        width
                      }
                      displayName
                      barcode
                      availableForSale
                      compareAtPrice
                    }
                  }
                }
                metafields(first: 10) {
                  edges {
                    node {
                      id
                      namespace
                      key
                      value
                      valueType
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        first: 250, // Number of products per page
        after: cursor // Use the cursor for pagination
      }
    });

    try {
      const response = await fetch(
        `https://frst-str.myshopify.com/admin/api/2024-04/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": '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',
          },
          body: query,
        }
      );

      const responseJson = await response.json();

      if (responseJson.data.products.edges) {
        const edges = responseJson.data.products.edges;
        products.push(...edges.map(edge => edge.node));
        cursor = responseJson.data.products.pageInfo.endCursor;

        // Check if there are more pages to fetch
        if (!responseJson.data.products.pageInfo.hasNextPage) {
          cursor = null; // Set cursor to null to exit the loop
        }
      } else {
        console.error('Products edges not found in GraphQL response');
        break;
      }
    } catch (error) {
      console.error('Error fetching Shopify products via GraphQL:', error);
      break;
    }
  } while (cursor !== null);

  return products;
}

// Function to handle MongoDB updates
async function processProducts(products) {
  // Process each product and update MongoDB
  const updates = [];

  for (const product of products) {
    const existingProduct = await Product.findOne({ shopifyId: product.id });

    if (existingProduct) {
      // Update existingProduct with fetched data (including metafields)
      existingProduct.title = product.title;
      existingProduct.vendor = product.vendor;
      // Update other fields similarly...

      // Handle metafields
      existingProduct.metafields = product.metafields.edges.map(edge => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        valueType: edge.node.valueType
      }));

      updates.push({
        updateOne: {
          filter: { _id: existingProduct._id },
          update: existingProduct,
        }
      });
    } else {
      // Create new Product document in MongoDB
      const newProduct = new Product({
        shopifyId: product.id,
        title: product.title,
        vendor: product.vendor,
        // Set other fields as needed...
        metafields: product.metafields.edges.map(edge => ({
          id: edge.node.id,
          namespace: edge.node.namespace,
          key: edge.node.key,
          value: edge.node.value,
          valueType: edge.node.valueType
        }))
      });

      updates.push({
        insertOne: {
          document: newProduct
        }
      });
    }
  }

  // Perform bulk operations in MongoDB
  if (updates.length > 0) {
    try {
      const bulkWriteResult = await Product.bulkWrite(updates);
      console.log('Bulk write operation result:', bulkWriteResult);
    } catch (error) {
      console.error('Error performing bulk write operation in MongoDB:', error);
    }
  } else {
    console.log('No updates or inserts needed.');
  }
}

// Main function to fetch and process all products
async function main() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/test');
    console.log('Connected to MongoDB');

    // Fetch all products from Shopify
    const products = await fetchAllProducts();
    console.log('Fetched products:', products.length);

    // Process products (update or insert into MongoDB)
    await processProducts(products);

    // Disconnect from MongoDB after processing
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error in main function:', error);
    await mongoose.disconnect(); // Ensure to disconnect in case of error
  }
}

// Call the main function to start the process
main().catch(err => console.error('Unhandled error in main function:', err));

//async function getProducts() {
/*  async function home(req,res) {
    console.log('yeah');
  const query = JSON.stringify({
   query : `
   query  {
  products(first: 250) {
    edges {
      node {
        id
        title
        vendor
        tags
        status
        productType
        handle
        descriptionHtml
        createdAt
        publishedAt
        templateSuffix
        images(first: 10) {
          edges {
            node {
              id
              url
              width
              height
              altText
            }
          }
        }
        options(first: 10) {
          id
          position
          name
          values
        }
        variants(first: 10) {
          edges {
            node {
              id
              createdAt
              sku
              title
              taxCode
              updatedAt
              selectedOptions {
                name
                value
              }
              price
              inventoryPolicy
              inventoryQuantity
              image {
                id
                url
                width
              }
              displayName
              barcode
              availableForSale
              compareAtPrice
            }
          }
        }
      }
    }
  }
}
  `
  })
  try {
  const response = await fetch(
    `https://frst-str.myshopify.com/admin/api/2024-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": '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',
      },
      body: query,
    }
    
  );
  const responseJson = await response.json();
  if (responseJson.data.products.edges) {
    const products = responseJson.data.products.edges.map(edge => edge.node);
    // Filter out products without a valid shopifyId
    const validProducts = products.filter(product => product.id);
    // Prepare array to store new products
    const newProducts = [];

    // Check if each product already exists by shopifyId
    for (const product of validProducts) {
      const existingProduct = await Product.findOne({ shopifyId: product.id });
      if (!existingProduct) {
        newProducts.push(product);
      }
    }

    // Insert new products into MongoDB
    if (newProducts.length > 0) {
      try {
        console.log(validProducts);
        const insertedProducts = await Product.insertMany(newProducts, { ordered: false });
        console.log('Products inserted into MongoDB:', insertedProducts.length);
      } catch (error) {
        console.error('Error inserting products into MongoDB:', error);
        // Handle specific errors here if needed
      }
    } else {
      console.log('No new products to insert.');
    }
  } else {
    console.error('Products edges not found in GraphQL response');
  }
} catch (error) {
  console.error('Error fetching Shopify products via GraphQL:', error);
  res.status(500).json({ error: 'Failed to fetch and insert Shopify products.' });
}
}*/
  




 /* console.log(responseJson);
  try {
    //const data = await request(shopifyGraphQLEndpoint, query);

    // Extract and save products to MongoDB
    const data = responseJson.data.products.edges[0]
    console.log("data: ", data);
    const products = responseJson.products.edges.map(edge => edge.node);
    for (const product of products) {
      await Product.findOneAndUpdate(
        { id: product.id },
        product,
        { upsert: true, new: true }
      );
    }

    return products;
  } catch (error) {
    console.log("error: ", error);
    console.error('Error fetching Shopify products via GraphQL:', error);
    throw error;
  }
}*/
/*const shopifyGraphQLEndpoint = 'https://frst-str/admin/api/2024-04/graphql.json';
const home = async (req, res) => {
  const query = `
    {
      products(first: 250) {
        edges {
          node {
            id
            title
            bodyHtml
            vendor
            productType
            createdAt
            handle
            updatedAt
            publishedAt
            tags
            status
            admin_graphql_api_id
            variants(first: 1) {
              edges {
                node {
                  id
                  product_id
                  position
                  inventory_policy
                  compare_at_price
                  fulfillment_service
                  inventory_management
                  option1
                  option2
                  option3
                  created_at
                  updated_at
                  taxable
                  barcode
                  grams
                  weight
                  weight_unit
                  inventory_item_id
                  inventory_quantity
                  old_inventory_quantity
                  requires_shipping
                  admin_graphql_api_id
                  image_id
                }
              }
            }
            options(first: 1) {
              edges {
                node {
                  id
                  product_id
                  name
                  position
                  values
                }
              }
            }
            images(first: 1) {
              edges {
                node {
                  id
                  alt
                  position
                  product_id
                  created_at
                  updated_at
                  admin_graphql_api_id
                  width
                  height
                  src
                  variant_ids
                }
              }
            }
            image(first: 1) {
              edges {
                node {
                  id
                  alt
                  position
                  product_id
                  created_at
                  updated_at
                  admin_graphql_api_id
                  width
                  height
                  src
                  variant_ids
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    console.log('trAL');
    const response = await fetch(shopifyGraphQLEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': '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',
      },
      body: JSON.stringify({ query }),
    });
    console.log('df');
    if (!response.ok) {
      throw new Error(`GraphQL request failed with status ${response.status}`);
    }

    const { data } = await response.json();
    console.log(data);

    // Extract and save products to MongoDB
    /*const products = data.products.edges.map(edge => edge.node);
    for (const product of products) {
      await Product.findOneAndUpdate(
        { s: product.id },
        product,
        { upsert: true, new: true }
      );
    }

    const products = data.products.map(edge => edge.node);
     
    
    for (const Product of products) {
    await Product.insertMany(products);
    }
    console.log('Products inserted into MongoDB:', products);
    return products;

    res.json(products); // Respond with products or handle as needed
  } catch (error) {
    console.error('Error fetching Shopify products via GraphQL:', error);
    res.status(500).json({ error: 'Failed to fetch Shopify products' });
  }
};*/
module.exports = startSyncProcess;
/*const shopify = new Shopify({
  shopName: 'frst-str.myshopify.com',
  accessToken: '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',
  
 autoLimit: { calls: 2, interval: 1000, bucketSize: 35 }
});
const home= async(req,res)=>{
  const products = await getProducts();
    try{
        console.log(req.body);
        res.status(200).send({message:"Heloo buddy"});
    }catch(error){
      console.log(error);
    }
}
const register= async(req,res)=>{
    try{
        res.status(200).send('Welcome to registeration Page');
    }catch(error){
      console.log(error);
    }
}*/


