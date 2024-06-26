const productService = require('../services/productService');
const googleBucket = require('../utils/googleBucket');
const upload = require('../utils/multerConfig');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Define the fixed upload path
const uploadsDir = path.join(__dirname, '..', 'uploads');

const uploadMiddleware = upload.single('images');

exports.createProduct = async (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Error uploading file:', err);
      return res.status(400).json({ error: err.message });
    }

    const imageFile = req.file;
    const {
      name,
      weight,
      calories,
      fat,
      proteins,
      carbohydrate,
      sugar,
      sodium,
      potassium,
    } = req.body;

    console.log('Request data:', req.body);
    console.log('File:', imageFile);

    // Validate required fields
    const requiredFields = { name, weight, calories, fat, proteins, carbohydrate, sugar, sodium, potassium };
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        console.error(`Error: Please provide ${key}`);
        return res.status(400).json({ error: `Please provide ${key}` });
      }
    }

    if (!imageFile) {
      console.error('Error: Please provide an image');
      return res.status(400).json({ error: 'Please provide an image' });
    }

    try {
      const imageUrl = await googleBucket.uploadToGoogleBucket(imageFile, uploadsDir, imageFile.filename);
      const product = await productService.createProduct({
        name,
        weight: parseFloat(weight),
        calories: parseFloat(calories),
        fat: parseFloat(fat),
        proteins: parseFloat(proteins),
        carbohydrate: parseFloat(carbohydrate),
        sugar: parseFloat(sugar),
        sodium: parseFloat(sodium),
        potassium: parseFloat(potassium),
        imageUrl,
      });
      console.log('Product created:', product);

      await fs.unlink(path.join(uploadsDir, imageFile.filename));

      res.status(200).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: error.message });
    }
  });
};

exports.getProducts = async (req, res) => {
  try {
    const products = await productService.getProducts();
    console.log('Products:', products);
    res.status(200).json(products);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    console.log('Product:', product);
    res.status(200).json(product);
  } catch (error) {
    console.error('Error getting product by ID:', error);
    res.status(404).json({ error: error.message });
  }
};

exports.getProductByName = async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const product = await productService.getProductByName(name);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Fetch additional data from the nutrient API
    const nutrientApiUrl = 'process.env.NUTRIENT_API_URL';
    const nutrientRequestBody = {
      fat: product.fat,
      sugar: product.sugar,
      sodium: product.sodium,
    };

    const nutrientResponse = await axios.post(nutrientApiUrl, nutrientRequestBody);
    const nutrientData = nutrientResponse.data;

    // Combine the responses
    const combinedResponse = {
      ...product,
      result: nutrientData.result,
    };

    res.status(200).json(combinedResponse);
  } catch (error) {
    console.error('Error getting product by name:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Error uploading file:', err);
      return res.status(400).json({ error: err.message });
    }

    const { id } = req.params;
    const imageFile = req.file;
    const {
      name,
      weight,
      calories,
      fat,
      proteins,
      carbohydrate,
      sugar,
      sodium,
      potassium,
    } = req.body;

    console.log('Request data:', req.body);
    console.log('File:', imageFile);

    let imageUrl;
    if (imageFile) {
      try {
        imageUrl = await googleBucket.uploadToGoogleBucket(imageFile, uploadsDir, imageFile.filename);
        await fs.unlink(path.join(uploadsDir, imageFile.filename));
      } catch (error) {
        console.error('Error uploading file:', error);
        return res.status(400).json({ error: error.message });
      }
    }

    try {
      const product = await productService.updateProduct(
        id,
        {
          name,
          weight: parseFloat(weight),
          calories: parseFloat(calories),
          fat: parseFloat(fat),
          proteins: parseFloat(proteins),
          carbohydrate: parseFloat(carbohydrate),
          sugar: parseFloat(sugar),
          sodium: parseFloat(sodium),
          potassium: parseFloat(potassium),
          imageUrl,
        }
      );
      console.log('Product updated:', product);
      res.status(200).json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(400).json({ error: error.message });
    }
  });
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    if (product.images) {
      await googleBucket.deleteFromGoogleBucket(product.images);
    }
    await productService.deleteProduct(id);
    console.log('Product deleted:', id);
    res.status(204).json();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(400).json({ error: error.message });
  }
};