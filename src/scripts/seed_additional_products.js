const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const vendor = await prisma.user.findFirst({ where: { role: 'VENDOR' } });
  if (!vendor) {
    console.error('No vendor found');
    return;
  }

  const categories = await prisma.category.findMany({
    where: {
      slug: {
        in: ['tech-gadgets-cables', 'academic-books-notes', 'dorm-life-stationery']
      }
    }
  });

  const catMap = {};
  categories.forEach(c => { catMap[c.slug] = c.id; });

  const additionalProducts = [
    // ── Tech, Gadgets & Cables (7 items) ──
    {
      name: 'Scientific Engineering Calculator FX-991EX',
      slug: 'scientific-engineering-calculator-fx-991ex',
      description: 'High-resolution natural textbook display with 552 functions. Essential for engineering, statistics, and mathematics exams.',
      price: 1850.0,
      stock: 20,
      isFeatured: true,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800'],
    },
    {
      name: 'Multi-Port USB-C Hub 6-in-1 Adapter',
      slug: 'multi-port-usb-c-hub-6-in-1',
      description: '4K HDMI, 3x USB 3.0, and 100W PD pass-through charging. Connect your campus laptop to presentation projectors and flash drives.',
      price: 1450.0,
      stock: 18,
      isFeatured: false,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=800'],
    },
    {
      name: 'Foldable Aluminum Laptop Cooling Stand',
      slug: 'foldable-aluminum-laptop-stand',
      description: 'Ergonomic 6-angle height adjustment with silicone anti-slip pads and open heat dissipation for long coding and thesis writing sessions.',
      price: 680.0,
      stock: 35,
      isFeatured: false,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800'],
    },
    {
      name: 'Ultra-Slim 10000mAh Fast Charging Power Bank',
      slug: 'ultra-slim-10000mah-power-bank',
      description: '22.5W dual USB & Type-C output with LED digital power indicator. Keeps your phone charged throughout campus classes and library marathons.',
      price: 1350.0,
      stock: 25,
      isFeatured: true,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1609592424364-75eb9a27c0fa?w=800'],
    },
    {
      name: 'High-Speed USB 3.0 Flash Drive (64GB)',
      slug: 'high-speed-usb-3-flash-drive-64gb',
      description: 'Compact metal casing with 120MB/s read speeds. Perfect for transferring lab assignments, project reports, and lecture slides.',
      price: 520.0,
      stock: 50,
      isFeatured: false,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800'],
    },
    {
      name: 'Braided 4K 60Hz HDMI Display Cable (2M)',
      slug: 'braided-4k-hdmi-display-cable-2m',
      description: 'Gold-plated connectors with nylon braided exterior. Ideal for dorm monitors and university seminar hall presentations.',
      price: 380.0,
      stock: 30,
      isFeatured: false,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=800'],
    },
    {
      name: 'Silicone Magnetic Cable Management Clips (5-Pack)',
      slug: 'magnetic-cable-clips-pack',
      description: 'Keep your dorm desk neat and prevent phone cables, charger cords, and earphones from tangling or falling behind beds.',
      price: 180.0,
      stock: 45,
      isFeatured: false,
      categoryId: catMap['tech-gadgets-cables'],
      images: ['https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800'],
    },

    // ── Academic Books & Notes (8 items) ──
    {
      name: 'Organic Chemistry Reactions & Mechanisms Handbook',
      slug: 'organic-chemistry-reactions-handbook',
      description: 'Concise visual guide covering named reactions, reaction roadmaps, and synthesis pathways for science and pharmacy students.',
      price: 280.0,
      stock: 22,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800'],
    },
    {
      name: 'Discrete Mathematics & Graph Theory Peer Notes',
      slug: 'discrete-mathematics-peer-notes',
      description: 'Compiled by top departmental honors students with solved recurrence relations, proof techniques, and previous semester question banks.',
      price: 240.0,
      stock: 30,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800'],
    },
    {
      name: 'University Physics & Circuit Analysis Problem Solver',
      slug: 'university-physics-circuit-analysis-solver',
      description: 'Step-by-step worked solutions for Ohm’s law, Kirchhoff’s rules, AC circuits, and electromagnetism lab experiments.',
      price: 340.0,
      stock: 18,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800'],
    },
    {
      name: 'Operating Systems & System Programming Revision Guide',
      slug: 'operating-systems-revision-guide',
      description: 'Comprehensive coverage of CPU scheduling, process synchronization, virtual memory, and Linux terminal command cheat sheets.',
      price: 310.0,
      stock: 25,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800'],
    },
    {
      name: 'Principles of Microeconomics & Macroeconomics (BBA)',
      slug: 'principles-of-economics-bba-guide',
      description: 'Market equilibrium, cost functions, fiscal policy, and inflation charts prepared specifically for university business faculty.',
      price: 290.0,
      stock: 20,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800'],
    },
    {
      name: 'Database Management Systems (DBMS) SQL Lab Manual',
      slug: 'dbms-sql-lab-manual',
      description: 'Relational algebra, ER diagrams, normalization up to BCNF, and practical SQL queries with sample student university database datasets.',
      price: 260.0,
      stock: 28,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800'],
    },
    {
      name: 'Medical Biochemistry Review & High-Yield Charts',
      slug: 'medical-biochemistry-review-charts',
      description: 'Full-color enzyme kinetics, Krebs cycle diagrams, and metabolic disorder summary sheets for pre-med and pharmacy students.',
      price: 350.0,
      stock: 15,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800'],
    },
    {
      name: 'Engineering Statistics & Probability Problem Manual',
      slug: 'engineering-statistics-probability-manual',
      description: 'Hypothesis testing, normal distribution, regression models, and ANOVA tables with solved past campus exam problems.',
      price: 300.0,
      stock: 20,
      isFeatured: false,
      categoryId: catMap['academic-books-notes'],
      images: ['https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800'],
    },

    // ── Dorm Life & Stationery (8 items) ──
    {
      name: 'Dual-Tip Pastel Highlighter & Aesthetic Pen Set (6 Pcs)',
      slug: 'pastel-highlighter-aesthetic-pen-set',
      description: 'Chisel and fine tips with quick-drying water-based ink that will not bleed through thin textbook or notebook pages.',
      price: 210.0,
      stock: 50,
      isFeatured: true,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800'],
    },
    {
      name: 'B5 Grid Spiral Study Notebooks (Pack of 3)',
      slug: 'b5-grid-spiral-study-notebooks-pack-of-3',
      description: '80gsm acid-free bleedproof grid paper with waterproof matte polypropylene covers and durable twin-wire binding for class notes.',
      price: 290.0,
      stock: 40,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?w=800'],
    },
    {
      name: 'Multi-Compartment Mesh Desk Stationery Organizer',
      slug: 'mesh-desk-stationery-organizer',
      description: '6 compartments with a pull-out sliding drawer. Keeps dorm study desks organized with pens, stapler, scissors, and paperclips.',
      price: 380.0,
      stock: 25,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800'],
    },
    {
      name: 'Memory Foam Ergonomic Seat Cushion for Dorm Chair',
      slug: 'memory-foam-ergonomic-seat-cushion',
      description: 'Relieves lower back and tailbone pressure during long study hours. Breathable mesh cover is removable and machine-washable.',
      price: 790.0,
      stock: 20,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800'],
    },
    {
      name: '4-Way Extension Power Strip with 2x USB Ports (3M)',
      slug: '4-way-extension-power-strip-with-usb',
      description: 'Flame-retardant casing with surge protection and individual switches. Safely powers laptops, phone chargers, and desk lamps in dorms.',
      price: 650.0,
      stock: 30,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800'],
    },
    {
      name: 'Transparent Sticky Notes & Morandi Index Tabs Bundle',
      slug: 'transparent-sticky-notes-index-tabs-bundle',
      description: 'Waterproof PET sticky notes allowing annotations directly over textbook diagrams without permanently marking library books.',
      price: 160.0,
      stock: 60,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800'],
    },
    {
      name: 'Stainless Steel Double-Wall Thermal Coffee Mug (400ml)',
      slug: 'stainless-steel-thermal-coffee-mug-400ml',
      description: 'Keeps morning coffee hot for 6 hours or cold tea chilled for 12 hours with spill-proof flip lid. Fits university backpack side pockets.',
      price: 490.0,
      stock: 28,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800'],
    },
    {
      name: 'Compact Portable Folding Clothes Drying Rack for Dorms',
      slug: 'compact-portable-folding-clothes-drying-rack',
      description: 'Lightweight rust-resistant alloy frame with 8 hanging bars. Folds flat to store under dorm bed or behind wardrobe.',
      price: 580.0,
      stock: 22,
      isFeatured: false,
      categoryId: catMap['dorm-life-stationery'],
      images: ['https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=800'],
    },
  ];

  console.log(`Seeding ${additionalProducts.length} additional products...`);
  let count = 0;
  for (const item of additionalProducts) {
    if (!item.categoryId) continue;
    await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        price: item.price,
        stock: item.stock,
        isFeatured: item.isFeatured,
        isActive: true,
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        price: item.price,
        stock: item.stock,
        isFeatured: item.isFeatured,
        isActive: true,
        vendorId: vendor.id,
        categoryId: item.categoryId,
        images: item.images,
      }
    });
    count++;
  }

  console.log(`Successfully seeded ${count} products across Tech, Academic Books, and Dorm Life!`);
  await prisma.$disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
