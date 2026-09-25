import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
test('liveness independe do banco; readiness detecta falha e recuperação', async () => {
  let available = false;
  let closed = false;
  const app = buildApp({ async check() { if (!available) throw new Error('sensitive_connection_details'); }, async close() { closed = true; } }, false);
  try {
    assert.equal((await app.inject('/health')).statusCode, 200);
    const failure = await app.inject('/health/ready');
    assert.equal(failure.statusCode, 503);
    assert.equal(failure.json().checks.database, 'down');
    assert.ok(!failure.body.includes('sensitive_connection_details'));
    available = true;
    const recovered = await app.inject('/health/ready');
    assert.equal(recovered.statusCode, 200);
    assert.equal(recovered.json().checks.database, 'up');
    assert.equal((await app.inject('/missing')).statusCode, 404);
  } finally { await app.close(); }
  assert.equal(closed, true);
});
