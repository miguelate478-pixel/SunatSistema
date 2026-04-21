// Test environment setup
// Uses a real test DB if TEST_DATABASE_URL is set, otherwise skips DB tests

process.env.JWT_SECRET = "test-secret-key-for-vitest-only-32chars";
// NODE_ENV is read-only in strict TS — set via vitest config instead
process.env.STORAGE_PROVIDER = "local";

// Suppress console output in tests unless DEBUG=1
if (!process.env.DEBUG) {
  console.log = () => {};
  console.info = () => {};
}
