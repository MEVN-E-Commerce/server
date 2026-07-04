import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mevn-marketplace';

const fallbackProducts = [
  {
    title: "Wireless Premium Headphones",
    description: "High quality over-ear headphones with active noise cancellation and 40 hour battery life.",
    price: 199.99,
    stock: 25,
    category: "electronics",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"]
  },
  {
    title: "Minimalist Leather Quartz Watch",
    description: "Genuine brown leather strap watch with sleek dial face and Swiss quartz movement.",
    price: 129.50,
    stock: 12,
    category: "accessories",
    images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600"]
  },
  {
    title: "Ergonomic Office Chair",
    description: "Breathable mesh back desk chair with adjustable lumbar support and armrests for home office.",
    price: 249.99,
    stock: 8,
    category: "furniture",
    images: ["https://images.unsplash.com/photo-1580481072645-022f9a6dbf27?w=600"]
  },
  {
    title: "Ultra-thin Mechanical Keyboard",
    description: "Compact 75% mechanical wireless keyboard with low-profile red switches and RGB backlighting.",
    price: 89.99,
    stock: 45,
    category: "electronics",
    images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600"]
  },
  {
    title: "Athletic Premium Running Shoes",
    description: "Lightweight and breathable knit mesh sneakers designed for maximum comfort and mileage.",
    price: 145.00,
    stock: 30,
    category: "shoes",
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"]
  }
];

const seed = async () => {
  console.log('[Seeder] Starting database seeding...');
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[Seeder] MonogDB connected successfully.');

    // 1. Clear Database
    console.log('[Seeder] Clearing old records...');
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Seller.deleteMany({});
    console.log('[Seeder] Database cleared.');

    // 2. Create Users (Admin, Sellers, Customers)
    console.log('[Seeder] Creating user accounts...');
    const defaultPassword = 'password123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const usersToCreate = [
      {
        name: 'Admin User 1',
        email: 'admin@market.com',
        passwordHash,
        role: 'admin',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Admin User 2',
        email: 'admin2@market.com',
        passwordHash,
        role: 'admin',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Admin User 3',
        email: 'admin3@market.com',
        passwordHash,
        role: 'admin',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Seller Alpha',
        email: 'seller1@market.com',
        passwordHash,
        role: 'seller',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Seller Beta',
        email: 'seller2@market.com',
        passwordHash,
        role: 'seller',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Pending Seller 1',
        email: 'seller_pending1@market.com',
        passwordHash,
        role: 'seller',
        sellerStatus: 'pending',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Pending Seller 2',
        email: 'seller_pending2@market.com',
        passwordHash,
        role: 'seller',
        sellerStatus: 'pending',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Jane Customer',
        email: 'customer1@market.com',
        passwordHash,
        role: 'customer',
        isVerified: true,
        isActive: true
      },
      {
        name: 'John Customer',
        email: 'customer2@market.com',
        passwordHash,
        role: 'customer',
        isVerified: true,
        isActive: true
      }
    ];

    const createdUsers = await User.create(usersToCreate);
    console.log(`[Seeder] Created ${createdUsers.length} users.`);

    const adminUser = createdUsers.find(u => u.role === 'admin');
    const sellers = createdUsers.filter(u => u.role === 'seller');
    const customers = createdUsers.filter(u => u.role === 'customer');

    // Create corresponding Seller profiles
    console.log('[Seeder] Creating seller profiles...');
    const sellerProfiles = [];
    for (const u of createdUsers) {
      if (u.role === 'seller') {
        const profile = await Seller.create({
          userId: u._id,
          storeName: u.name === 'Seller Alpha' ? 'Alpha Store' : u.name === 'Seller Beta' ? 'Beta Store' : `${u.name} Shop`,
          description: `Welcome to ${u.name}'s official store. We sell premium goods and top-tier merchandise.`,
          phone: '123-456-7890',
          address: 'Marketplace Plaza, Suite 100',
          payoutInfo: {
            method: 'bank',
            bank: {
              bankName: 'Chase Bank',
              holderName: u.name,
              accountNumber: '1234567890'
            }
          },
          status: u.sellerStatus || 'approved'
        });
        sellerProfiles.push(profile);
      }
    }
    console.log(`[Seeder] Created ${sellerProfiles.length} seller profiles.`);

    // 3. Fetch Products from DummyJSON
    let apiProducts = [];
    try {
      console.log('[Seeder] Fetching products from DummyJSON API...');
      const response = await fetch('https://dummyjson.com/products?limit=100');
      if (response.ok) {
        const data = await response.json();
        apiProducts = data.products || [];
        console.log(`[Seeder] Successfully fetched ${apiProducts.length} products dynamically.`);
      } else {
        throw new Error('API response not ok');
      }
    } catch (fetchErr) {
      console.warn('[Seeder] Could not fetch from DummyJSON. Using offline fallback products.', fetchErr.message);
      apiProducts = fallbackProducts;
    }

    // 4. Extract and Create Categories
    console.log('[Seeder] Extracting categories...');
    const categoryNames = [...new Set(apiProducts.map(p => p.category))];
    const categoryDocs = [];

    for (const catName of categoryNames) {
      // Capitalize first letter
      const prettyName = catName.charAt(0).toUpperCase() + catName.slice(1);
      const catDoc = await Category.create({
        name: prettyName,
        description: `High quality items and products in the ${prettyName} category.`
      });
      categoryDocs.push(catDoc);
    }
    console.log(`[Seeder] Created ${categoryDocs.length} categories.`);

    // Map category name to Category Document
    const categoryMap = {};
    categoryDocs.forEach(c => {
      categoryMap[c.name.toLowerCase()] = c._id;
    });

    // 5. Create Products
    console.log('[Seeder] Creating product records...');
    const productsToCreate = apiProducts.map((p, index) => {
      // Assign randomly to Seller A or Seller B
      const seller = sellers[index % sellers.length];
      
      // Map category
      const targetCatName = p.category.toLowerCase();
      const categoryId = categoryMap[targetCatName] || categoryDocs[0]._id;

      // Extract relevant fields
      return {
        sellerId: seller._id,
        name: p.title,
        description: p.description,
        price: p.price,
        categoryId: categoryId,
        images: p.images && p.images.length > 0 ? p.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'],
        stock: p.stock || Math.floor(Math.random() * 50) + 10,
        isActive: true,
        rating: p.rating || parseFloat((3.0 + Math.random() * 2.0).toFixed(1))
      };
    });

    const createdProducts = await Product.create(productsToCreate);
    console.log(`[Seeder] Seeded ${createdProducts.length} products inside categories!`);

    console.log('\n[Seeder] ==========================================');
    console.log('[Seeder] Database seeded successfully!');
    console.log('[Seeder] Credentials for testing:');
    console.log(' - Admin 1:         admin@market.com    / password123');
    console.log(' - Admin 2:         admin2@market.com   / password123');
    console.log(' - Admin 3:         admin3@market.com   / password123');
    console.log(' - Seller A:        seller1@market.com  / password123');
    console.log(' - Seller B:        seller2@market.com  / password123');
    console.log(' - Pending Seller 1: seller_pending1@market.com / password123');
    console.log(' - Pending Seller 2: seller_pending2@market.com / password123');
    console.log(' - Customer A:      customer1@market.com/ password123');
    console.log(' - Customer B:      customer2@market.com/ password123');
    console.log('[Seeder] ==========================================\n');

  } catch (err) {
    console.error('[Seeder] Seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[Seeder] Connection closed.');
  }
};

seed();
