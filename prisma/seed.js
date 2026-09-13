require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed...');

  const adminPassword = await bcrypt.hash('Admin@12345', 12);
  const vendorPassword = await bcrypt.hash('Vendor@12345', 12);

  // 1. Seed Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@campuscart.com' },
    update: {
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      name: 'Campus Cart Admin',
      email: 'admin@campuscart.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user ready:', admin.email);

  // 2. Seed Approved Vendor User + Profile
  const vendor = await prisma.user.upsert({
    where: { email: 'vendor@campuscart.com' },
    update: {
      passwordHash: vendorPassword,
      role: 'VENDOR',
      isActive: true,
    },
    create: {
      name: 'Student Tech & Dorm Startup',
      email: 'vendor@campuscart.com',
      passwordHash: vendorPassword,
      role: 'VENDOR',
      isActive: true,
    },
  });

  await prisma.vendorProfile.upsert({
    where: { userId: vendor.id },
    update: {
      businessName: 'Dorm Essentials & Tech Labs',
      description: 'Official student-led startup offering dorm bakes, cables, curated accessories, and textbooks.',
      status: 'APPROVED',
      commissionRate: 10.0,
    },
    create: {
      userId: vendor.id,
      businessName: 'Dorm Essentials & Tech Labs',
      description: 'Official student-led startup offering dorm bakes, cables, curated accessories, and textbooks.',
      status: 'APPROVED',
      commissionRate: 10.0,
    },
  });
  console.log('✅ Approved Vendor ready:', vendor.email);

  // 3. Seed Categories
  const categoriesData = [
    {
      name: 'Food & Dorm Snacks',
      slug: 'food-dorm-snacks',
      description: 'Freshly baked goods, midnight dorm treats, snacks, and homemade refreshments.',
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300',
    },
    {
      name: 'Academic Books & Notes',
      slug: 'academic-books-notes',
      description: 'Engineering, business, and medical textbooks, lab manuals, and peer course notes.',
      imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300',
    },
    {
      name: 'Tech, Gadgets & Cables',
      slug: 'tech-gadgets-cables',
      description: 'Fast chargers, USB-C adapters, calculators, power banks, and electronics kits.',
      imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=300',
    },
    {
      name: 'Campus Merch & Hoodies',
      slug: 'campus-merch-hoodies',
      description: 'University hoodies, departmental club jerseys, and student-designed merchandise.',
      imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=300',
    },
    {
      name: 'Dorm Life & Stationery',
      slug: 'dorm-life-stationery',
      description: 'Study lamps, organizers, notebook packs, highlighters, and room accessories.',
      imageUrl: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300',
    },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
        isActive: true,
      },
      create: cat,
    });
    categoryMap[cat.slug] = record.id;
  }
  console.log('✅ 5 Marketplace categories seeded');

  // 4. Seed Products
  const productsData = [
    {
      name: 'Fresh Dorm Chocolate Chip Cookies (Box of 6)',
      slug: 'fresh-dorm-chocolate-chip-cookies',
      description: 'Freshly baked soft-center chocolate chip cookies made daily in the dorm bakery. Perfect midnight snack during exam weeks! Free handover to your hall room.',
      price: 180.0,
      stock: 35,
      isFeatured: true,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800',
        'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800',
      ],
    },
    {
      name: 'Braided Type-C Fast Charging Cable (2M)',
      slug: 'braided-type-c-fast-charging-cable-2m',
      description: 'Ultra-durable nylon braided 65W fast-charging cable with reinforced stress-relief collars. Extra long 2 meters for easy charging from high dorm wall sockets.',
      price: 220.0,
      stock: 50,
      isFeatured: true,
      categorySlug: 'tech-gadgets-cables',
      images: [
        'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800',
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800',
      ],
    },
    {
      name: 'Official Campus Navy Premium Hoodie (Size M)',
      slug: 'official-campus-navy-premium-hoodie-m',
      description: 'Super soft 320 GSM fleece cotton hoodie featuring embroidered university lettering and kangaroo pocket. Ideal for chilly campus lecture halls and library nights.',
      price: 850.0,
      stock: 20,
      isFeatured: true,
      categorySlug: 'campus-merch-hoodies',
      images: [
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800',
        'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800',
      ],
    },
    {
      name: 'Calculus & Linear Algebra Course Companion',
      slug: 'calculus-linear-algebra-course-companion',
      description: 'Comprehensive university reference book with worked exam problems, midterm revision cheatsheets, and concept breakdowns compiled by senior honors students.',
      price: 320.0,
      stock: 15,
      isFeatured: true,
      categorySlug: 'academic-books-notes',
      images: [
        'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800',
      ],
    },
    {
      name: 'Arduino Uno R3 Microcontroller Learning Kit',
      slug: 'arduino-uno-r3-microcontroller-learning-kit',
      description: 'Complete DIY electronics starter bundle with breadboard, jumper wires, LED pack, and ultrasonic sensors for engineering lab projects and prototyping.',
      price: 1250.0,
      stock: 12,
      isFeatured: false,
      categorySlug: 'tech-gadgets-cables',
      images: [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800',
      ],
    },
    {
      name: 'Rechargeable LED Desk Study Lamp with Phone Stand',
      slug: 'rechargeable-led-desk-study-lamp',
      description: '3-mode dimmable eye-protection lamp with flexible neck, 2000mAh battery for power-cut study sessions, and built-in mobile stand for attending online lectures.',
      price: 450.0,
      stock: 25,
      isFeatured: false,
      categorySlug: 'dorm-life-stationery',
      images: [
        'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
        'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800',
      ],
    },
    {
      name: 'Eco-Friendly Campus Canvas Tote Bag',
      slug: 'eco-friendly-campus-canvas-tote-bag',
      description: 'Heavyweight organic cotton canvas tote bag with reinforced handles and interior zipper pocket for carrying notebooks, tablets, and daily class essentials.',
      price: 260.0,
      stock: 40,
      isFeatured: false,
      categorySlug: 'campus-merch-hoodies',
      images: [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800',
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800',
      ],
    },
    {
      name: 'Crispy Salted Dorm Banana Chips (200g)',
      slug: 'crispy-salted-dorm-banana-chips-200g',
      description: 'Deliciously crunchy sliced green plantain chips seasoned with sea salt. Hand-fried in small batches by student bakes.',
      price: 110.0,
      stock: 60,
      isFeatured: false,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=800',
        'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800',
      ],
    },
    {
      name: 'Sundarban Pure Raw Honey (500g)',
      slug: 'sundarban-pure-raw-honey-500g',
      description: '100% natural pure unprocessed Sundarban wild flower honey. Sourced and bottled by campus bio-agriculture student initiative.',
      price: 480.0,
      stock: 25,
      isFeatured: true,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
        'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800',
      ],
    },
    {
      name: 'Spicy Masala Roasted Cashew Nuts (250g)',
      slug: 'spicy-masala-roasted-cashew-nuts-250g',
      description: 'Freshly roasted whole cashews tossed with campus secret spicy masala mix. Crunchy, energizing snack for long study nights.',
      price: 380.0,
      stock: 30,
      isFeatured: true,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1509912760195-45543c7b28fa?w=800',
      ],
    },
    {
      name: 'Premium Fresh Dates Pack (500g)',
      slug: 'premium-fresh-dates-pack-500g',
      description: 'Soft, naturally sweet and energy-packed dates. Perfect for quick nutrition between university classes and sports.',
      price: 290.0,
      stock: 45,
      isFeatured: false,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
      ],
    },
    {
      name: 'Wireless Ergonomic Silent Mouse (Rechargeable)',
      slug: 'wireless-ergonomic-silent-mouse',
      description: 'Zero-click-noise 2.4G wireless optical mouse with dual Bluetooth modes. Library and silent exam hall friendly.',
      price: 550.0,
      stock: 30,
      isFeatured: false,
      categorySlug: 'tech-gadgets-cables',
      images: [
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800',
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800',
      ],
    },
    {
      name: 'Data Structures & Algorithms Handbook (CSE)',
      slug: 'data-structures-algorithms-handbook-cse',
      description: 'Exam-focused DSA guide covering trees, graphs, dynamic programming, and LeetCode top 100 questions explained simply.',
      price: 340.0,
      stock: 20,
      isFeatured: false,
      categorySlug: 'academic-books-notes',
      images: [
        'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=800',
      ],
    },
    {
      name: 'Stainless Steel Insulated Water Bottle (750ml)',
      slug: 'stainless-steel-insulated-water-bottle-750ml',
      description: 'Double-walled vacuum insulated flask keeps ice water cold for 24h and hot coffee warm for 12h throughout full lecture days.',
      price: 420.0,
      stock: 35,
      isFeatured: false,
      categorySlug: 'dorm-life-stationery',
      images: [
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800',
      ],
    },
    {
      name: 'Deshi Mustard Oil (1 Liter Pure)',
      slug: 'deshi-mustard-oil-1-liter-pure',
      description: 'Cold-pressed traditional mustard oil made from organic mustard seeds. Healthy, aromatic, and rich in natural pungent flavor.',
      price: 280.0,
      stock: 40,
      isFeatured: true,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800',
      ],
    },
    {
      name: 'Honey Roasted Mixed Nuts (500g Jar)',
      slug: 'honey-roasted-mixed-nuts-500g',
      description: 'Premium blend of almonds, cashews, walnuts, and pumpkin seeds glazed with organic honey. Ultimate brain food for study sessions.',
      price: 650.0,
      stock: 25,
      isFeatured: true,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800',
      ],
    },
    {
      name: 'Traditional Organic Ghee (500g)',
      slug: 'traditional-organic-ghee-500g',
      description: 'Pure clarified cow butter ghee prepared traditionally. Rich aroma and taste for homemade dorm cooking and parathas.',
      price: 520.0,
      stock: 20,
      isFeatured: false,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800',
      ],
    },
    {
      name: 'Organic Brown Sugar Pack (800g)',
      slug: 'organic-brown-sugar-pack-800g',
      description: 'Unrefined natural brown cane sugar with high molasses content. Ideal for tea, coffee, and hostel baking.',
      price: 160.0,
      stock: 50,
      isFeatured: false,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1581781870027-04212e231e96?w=800',
      ],
    },
    {
      name: 'Premium Ajwa Dates Box (1kg)',
      slug: 'premium-ajwa-dates-box-1kg',
      description: 'Authentic premium dark soft Ajwa dates directly imported and packed for university students.',
      price: 950.0,
      stock: 30,
      isFeatured: true,
      categorySlug: 'food-dorm-snacks',
      images: [
        'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800',
      ],
    },
  ];

  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {
        name: prod.name,
        description: prod.description,
        price: prod.price,
        stock: prod.stock,
        isFeatured: prod.isFeatured,
        images: prod.images,
        isActive: true,
        categoryId: categoryMap[prod.categorySlug],
        vendorId: vendor.id,
      },
      create: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        stock: prod.stock,
        isFeatured: prod.isFeatured,
        images: prod.images,
        isActive: true,
        categoryId: categoryMap[prod.categorySlug],
        vendorId: vendor.id,
      },
    });
  }
  console.log('✅ 8 Student Startup products seeded');
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
