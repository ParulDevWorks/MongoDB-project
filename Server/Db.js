const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/myshopifydb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});
const productSchema = new mongoose.Schema({
    id: String,
  title: String,
  body_html: String,
  vendor: String,
  product_type: String,
  created_at: String,
  handle: String,
  updated_at: String,
  published_at: String,
  template_suffix: String,
  published_scope: String,
  tags: String,
  status: String,
  admin_graphql_api_id: String,
  variants: [{ 
    id: String,
    product_id: String,
    title: String,
    price: String,
    sku: String,
    position: String,
    inventory_policy: String,
    compare_at_price: String,
    fulfillment_service: String,
    inventory_management: String,
    option1: String,
    option2: String,
    option3: String,
    created_at: String,
    updated_at: String,
    taxable: String,
    barcode: String,
    grams: String,
    weight: String,
    weight_unit: String,
    inventory_item_id: String,
    inventory_quantity: Number,
    old_inventory_quantity: String,
    requires_shipping: Boolean,
    admin_graphql_api_id: String,
    image_id: String
  }],
  options: [{
    id: String,
    product_id: String,
    name: String,
    position: String,
    values: [String],
  }],
  images: [{
    id: String,
    alt: String,
    position: String,
    product_id: String,
    created_at: String,
    updated_at: String,
    admin_graphql_api_id: String,
    width: String,
    height: String,
    src: String,
    variant_ids: [String],
  }],
  image: [{
    id: String,
    alt: String,
    position: String,
    product_id: String,
    created_at: String,
    updated_at: String,
    admin_graphql_api_id: String,
    width: String,
    height: String,
    src: String,
    variant_ids: [String],
  }],
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;