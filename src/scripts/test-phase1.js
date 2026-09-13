const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const { signToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Phase 1 Integration Tests with native fetch...\n');

  // 1. Ensure server is reachable
  try {
    const health = await fetch(`${BASE_URL}/categories`);
    if (!health.ok) throw new Error(`Status ${health.status}`);
    console.log('✅ Backend server is reachable on port 5000');
  } catch (err) {
    console.error('❌ Server is not reachable at ' + BASE_URL, err.message);
    process.exit(1);
  }

  // Helper for requests
  async function request(endpoint, options = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, data };
  }

  // 2. Test Admin Login
  console.log('\n--- 1. Testing Admin Credential Login ---');
  let adminCookie = '';
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@campuscart.com',
      password: 'Admin@12345',
    }),
  });

  if (adminLogin.status !== 200) {
    console.error('❌ Admin login failed:', adminLogin.data);
    process.exit(1);
  }
  console.log('✅ Admin login succeeded:', adminLogin.data.user.email, 'Role:', adminLogin.data.user.role);

  // Extract set-cookie
  const setCookie = adminLogin.headers.get('set-cookie');
  adminCookie = setCookie ? setCookie.split(';')[0] : '';

  // Verify admin can access stats endpoint
  const statsRes = await request('/admin/stats', {
    headers: { Cookie: adminCookie },
  });
  if (statsRes.status !== 200) {
    console.error('❌ Admin access to /admin/stats failed:', statsRes.data);
    process.exit(1);
  }
  console.log('✅ Admin authenticated request succeeded. Platform total GMV:', statsRes.data.totalGMV);

  // 3. Test Account Deactivation (isActive: false)
  console.log('\n--- 2. Testing Account Deactivation Enforcement ---');
  const deactEmail = `deactivated_${Date.now()}@campuscart.com`;
  const deactPass = await bcrypt.hash('TestPass@123', 12);
  const deactivatedUser = await prisma.user.create({
    data: {
      name: 'Deactivated User',
      email: deactEmail,
      passwordHash: deactPass,
      role: 'USER',
      isActive: false,
    },
  });

  const deactLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: deactEmail,
      password: 'TestPass@123',
    }),
  });

  if (deactLogin.status === 403) {
    console.log('✅ Deactivated user login correctly rejected with 403:', deactLogin.data.message);
  } else {
    console.error('❌ Expected 403 for deactivated user login, got:', deactLogin.status, deactLogin.data);
    process.exit(1);
  }

  // 4. Test Vendor Rejection Validation
  console.log('\n--- 3. Testing Vendor Rejection Reason Validation ---');
  const pendingVendorEmail = `vendor_pending_${Date.now()}@campuscart.com`;
  await request('/auth/vendor/register', {
    method: 'POST',
    body: JSON.stringify({
      email: pendingVendorEmail,
      password: 'VendorPass@123',
      businessName: 'Pending Startup Goods',
    }),
  });
  console.log('✅ Registered test pending vendor');

  const pendingVendorUser = await prisma.user.findUnique({
    where: { email: pendingVendorEmail },
    include: { vendorProfile: true },
  });

  // Rejection without reason -> should fail with 400
  const emptyReject = await request(`/admin/vendors/${pendingVendorUser.id}/reject`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({}),
  });

  if (emptyReject.status === 400) {
    console.log('✅ Empty rejection correctly failed with 400:', emptyReject.data.message);
  } else {
    console.error('❌ Expected 400 for empty rejection, got:', emptyReject.status, emptyReject.data);
    process.exit(1);
  }

  // Rejection with reason -> should succeed
  const validReject = await request(`/admin/vendors/${pendingVendorUser.id}/reject`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ reason: 'Missing official student startup documentation' }),
  });

  if (validReject.status === 200) {
    console.log('✅ Rejection with reason succeeded:', validReject.data.message);
  } else {
    console.error('❌ Expected 200 for valid rejection, got:', validReject.status, validReject.data);
    process.exit(1);
  }

  // Attempt login as rejected vendor
  const rejectedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: pendingVendorEmail,
      password: 'VendorPass@123',
    }),
  });

  if (rejectedLogin.status === 403) {
    console.log('✅ Rejected vendor login returned 403 with reason:', rejectedLogin.data.message);
  } else {
    console.error('❌ Expected 403 for rejected vendor login, got:', rejectedLogin.status, rejectedLogin.data);
    process.exit(1);
  }

  // 5. Test Delivery Confirmation Code Workflow
  console.log('\n--- 4. Testing Delivery Confirmation Code Workflow ---');
  const activeVendorEmail = `active_vendor_${Date.now()}@campuscart.com`;
  await request('/auth/vendor/register', {
    method: 'POST',
    body: JSON.stringify({
      email: activeVendorEmail,
      password: 'VendorPass@123',
      businessName: 'Handover Test Store',
    }),
  });
  const activeVendor = await prisma.user.findUnique({ where: { email: activeVendorEmail } });
  await prisma.vendorProfile.update({
    where: { userId: activeVendor.id },
    data: { status: 'APPROVED' },
  });

  const vendorLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: activeVendorEmail,
      password: 'VendorPass@123',
    }),
  });
  const vendorCookie = vendorLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: 'Electronics Test',
        slug: 'electronics-test-' + Date.now(),
        description: 'Test category',
        isActive: true,
      },
    });
  }
  const categoryId = category.id;

  const productRes = await request('/vendor/products', {
    method: 'POST',
    headers: { Cookie: vendorCookie },
    body: JSON.stringify({
      name: 'Handover Test Item ' + Date.now(),
      description: 'Physical campus delivery test item',
      price: 15.50,
      stock: 50,
      categoryId,
      images: ['https://placehold.co/400x300.jpg'],
    }),
  });
  const product = productRes.data.product;
  console.log('✅ Created test product:', product.name, 'Stock:', product.stock);

  // Create buyer user
  const buyerEmail = `buyer_${Date.now()}@campuscart.com`;
  const buyerPass = await bcrypt.hash('BuyerPass@123', 12);
  const buyer = await prisma.user.create({
    data: {
      name: 'Campus Buyer',
      email: buyerEmail,
      passwordHash: buyerPass,
      role: 'USER',
      isActive: true,
    },
  });

  const buyerToken = signToken({ userId: buyer.id, role: 'USER' });
  const buyerCookie = `token=${buyerToken}`;

  // Add item to cart
  await request('/cart/items', {
    method: 'POST',
    headers: { Cookie: buyerCookie },
    body: JSON.stringify({
      productId: product.id,
      quantity: 2,
    }),
  });
  console.log('✅ Added item to buyer cart');

  // Place order
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: { Cookie: buyerCookie },
    body: JSON.stringify({
      shippingAddress: {
        name: 'Campus Buyer',
        phone: '01700000000',
        address: 'Dorm Hall 3, Room 402',
        city: 'Campus North',
      },
    }),
  });

  const placedOrder = orderRes.data.order;
  console.log('✅ Order created! ID:', placedOrder.id);
  console.log('🔑 Delivery Code generated for buyer:', placedOrder.deliveryCode);

  if (!placedOrder.deliveryCode || placedOrder.deliveryCode.length !== 6) {
    console.error('❌ Expected 6-digit deliveryCode, got:', placedOrder.deliveryCode);
    process.exit(1);
  }

  // Attempt wrong delivery code
  const wrongCodeRes = await request(`/orders/${placedOrder.id}/confirm-delivery`, {
    method: 'POST',
    headers: { Cookie: vendorCookie },
    body: JSON.stringify({ deliveryCode: '000000' }),
  });

  if (wrongCodeRes.status === 400) {
    console.log('✅ Invalid delivery code rejected with 400:', wrongCodeRes.data.message);
  } else {
    console.error('❌ Expected 400 for wrong delivery code, got:', wrongCodeRes.status, wrongCodeRes.data);
    process.exit(1);
  }

  // Confirm delivery with valid deliveryCode
  const validCodeRes = await request(`/orders/${placedOrder.id}/confirm-delivery`, {
    method: 'POST',
    headers: { Cookie: vendorCookie },
    body: JSON.stringify({ deliveryCode: placedOrder.deliveryCode }),
  });

  if (validCodeRes.status === 200) {
    console.log('✅ Delivery confirmed successfully! Status:', validCodeRes.data.order.status);
  } else {
    console.error('❌ Expected 200 for valid delivery code, got:', validCodeRes.status, validCodeRes.data);
    process.exit(1);
  }

  // Clean up test records
  console.log('\n🧹 Cleaning up test records...');
  await prisma.orderItem.deleteMany({ where: { orderId: placedOrder.id } });
  await prisma.order.delete({ where: { id: placedOrder.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.vendorProfile.delete({ where: { userId: activeVendor.id } });
  await prisma.user.delete({ where: { id: activeVendor.id } });
  await prisma.vendorProfile.delete({ where: { userId: pendingVendorUser.id } });
  await prisma.user.delete({ where: { id: pendingVendorUser.id } });
  await prisma.user.delete({ where: { id: buyer.id } });
  await prisma.user.delete({ where: { id: deactivatedUser.id } });

  console.log('🎉 ALL PHASE 1 INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
}

runTests()
  .catch((e) => {
    console.error('💥 Test script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
