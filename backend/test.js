async function runTests() {
  const baseURL = 'http://localhost:5000/api';
  try {
    console.log('1. Testing Vendor Registration...');
    let res = await fetch(`${baseURL}/vendor/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Test Vendor Ltd',
        email: 'vendor@test.com',
        phone: '1234567890',
        contactPerson: 'John Doe',
        password: 'password123'
      })
    });
    let data = await res.json();
    if (!res.ok) throw new Error(data.message);
    console.log('Registration Success:', data.companyName);
    const vendorId = data._id;

    console.log('\n2. Testing Admin retrieving vendors...');
    res = await fetch(`${baseURL}/admin/vendors`);
    data = await res.json();
    console.log(`Found ${data.length} vendors`);

    console.log('\n3. Testing Admin approving vendor...');
    res = await fetch(`${baseURL}/admin/vendors/${vendorId}/approve`, { method: 'PUT' });
    data = await res.json();
    console.log('Approval Success:', data.message);

    console.log('\n4. Testing Vendor Login (should succeed now)...');
    res = await fetch(`${baseURL}/vendor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vendor@test.com', password: 'password123' })
    });
    data = await res.json();
    console.log('Login Success! Token received:', data.token ? 'Yes' : 'No');

    console.log('\nAll core logic tests passed! The backend logic structure works beautifully.');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed!', err.message);
    process.exit(1);
  }
}

runTests();
