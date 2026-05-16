const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');
const fs = require('fs');
const EventEmitter = require('events');

// We test the sync functions by requiring the server module with GITHUB_TOKEN set.
// But server.js starts listening, so we need to extract and test the logic in isolation.
// Instead, we replicate the sync logic here with the same implementation and test it.

describe('GitHub sync functions', () => {
  let originalRequest;
  let requestCalls;

  beforeEach(() => {
    originalRequest = https.request;
    requestCalls = [];
  });

  afterEach(() => {
    https.request = originalRequest;
  });

  function mockHttps(responses) {
    let callIndex = 0;
    https.request = (options, callback) => {
      const call = { options, written: [] };
      requestCalls.push(call);

      const response = responses[callIndex++] || { statusCode: 200, body: '{}' };
      const res = new EventEmitter();
      res.statusCode = response.statusCode;

      // Simulate async response
      process.nextTick(() => {
        callback(res);
        res.emit('data', response.body);
        res.emit('end');
      });

      const req = new EventEmitter();
      req.write = (data) => { call.written.push(data); };
      req.end = () => {};
      req.destroy = () => {};
      return req;
    };
  }

  // Replicate githubApi for testability (same logic as server.js)
  function githubApi(token, method, apiPath, body) {
    if (!token) return Promise.resolve(null);
    return new Promise((resolve) => {
      const postData = body ? JSON.stringify(body) : null;
      const req = https.request({
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'league-admin-cms',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {})
        },
        timeout: 15000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      if (postData) req.write(postData);
      req.end();
    });
  }

  it('githubApi returns null when no token', async () => {
    const result = await githubApi('', 'GET', '/repos/test/contents/file');
    assert.equal(result, null);
    assert.equal(requestCalls.length, 0);
  });

  it('githubApi makes GET request with correct headers', async () => {
    mockHttps([{ statusCode: 200, body: '{"sha":"abc123"}' }]);

    const result = await githubApi('ghp_test', 'GET', '/repos/test/contents/file');
    assert.deepEqual(result, { sha: 'abc123' });
    assert.equal(requestCalls.length, 1);
    assert.equal(requestCalls[0].options.method, 'GET');
    assert.equal(requestCalls[0].options.hostname, 'api.github.com');
    assert.equal(requestCalls[0].options.headers['Authorization'], 'Bearer ghp_test');
    assert.equal(requestCalls[0].options.headers['User-Agent'], 'league-admin-cms');
  });

  it('githubApi makes PUT request with body', async () => {
    mockHttps([{ statusCode: 200, body: '{"content":{"sha":"new123"}}' }]);

    const body = { message: 'test', content: 'base64data', branch: 'main' };
    const result = await githubApi('ghp_test', 'PUT', '/repos/test/contents/file', body);
    assert.deepEqual(result, { content: { sha: 'new123' } });
    assert.equal(requestCalls[0].options.method, 'PUT');
    assert.equal(requestCalls[0].written.length, 1);
    assert.deepEqual(JSON.parse(requestCalls[0].written[0]), body);
  });

  it('githubApi returns null on network error', async () => {
    https.request = (options, callback) => {
      const req = new EventEmitter();
      req.write = () => {};
      req.end = () => { process.nextTick(() => req.emit('error', new Error('ECONNREFUSED'))); };
      req.destroy = () => {};
      return req;
    };

    const result = await githubApi('ghp_test', 'GET', '/repos/test/contents/file');
    assert.equal(result, null);
  });

  it('githubApi returns null on invalid JSON response', async () => {
    mockHttps([{ statusCode: 200, body: 'not json' }]);

    const result = await githubApi('ghp_test', 'GET', '/repos/test/contents/file');
    assert.equal(result, null);
  });

  // Test syncFileToGithub flow (GET sha then PUT)
  it('syncFileToGithub creates new file when none exists', async () => {
    mockHttps([
      { statusCode: 404, body: '{"message":"Not Found"}' },
      { statusCode: 201, body: '{"content":{"sha":"new"}}' }
    ]);

    // Simulate syncFileToGithub
    const token = 'ghp_test';
    const repoPath = 'admin/data/content.json';
    const content = '{"hero":{}}';
    const message = 'cms: update hero';
    const repo = 'yourorg/your-repo';
    const branch = 'main';

    const apiPath = `/repos/${repo}/contents/${repoPath}`;
    const existing = await githubApi(token, 'GET', `${apiPath}?ref=${branch}`);
    const sha = existing && existing.sha ? existing.sha : undefined;
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha ? { sha } : {})
    };
    await githubApi(token, 'PUT', apiPath, body);

    assert.equal(requestCalls.length, 2);
    assert.equal(requestCalls[0].options.method, 'GET');
    assert.equal(requestCalls[1].options.method, 'PUT');
    // No sha in PUT body since file doesn't exist
    const putBody = JSON.parse(requestCalls[1].written[0]);
    assert.equal(putBody.sha, undefined);
    assert.equal(putBody.message, 'cms: update hero');
  });

  it('syncFileToGithub updates existing file with sha', async () => {
    mockHttps([
      { statusCode: 200, body: '{"sha":"existing123"}' },
      { statusCode: 200, body: '{"content":{"sha":"updated"}}' }
    ]);

    const token = 'ghp_test';
    const apiPath = `/repos/yourorg/your-repo/contents/admin/data/content.json`;
    const existing = await githubApi(token, 'GET', `${apiPath}?ref=main`);
    const sha = existing && existing.sha ? existing.sha : undefined;
    const body = {
      message: 'cms: update about',
      content: Buffer.from('{}').toString('base64'),
      branch: 'main',
      ...(sha ? { sha } : {})
    };
    await githubApi(token, 'PUT', apiPath, body);

    const putBody = JSON.parse(requestCalls[1].written[0]);
    assert.equal(putBody.sha, 'existing123');
  });

  it('deleteFileFromGithub sends DELETE with sha', async () => {
    mockHttps([
      { statusCode: 200, body: '{"sha":"del456"}' },
      { statusCode: 200, body: '{}' }
    ]);

    const token = 'ghp_test';
    const apiPath = `/repos/yourorg/your-repo/contents/admin/uploads/test.jpg`;
    const existing = await githubApi(token, 'GET', `${apiPath}?ref=main`);
    assert.ok(existing && existing.sha);
    await githubApi(token, 'DELETE', apiPath, {
      message: 'cms: delete test.jpg',
      sha: existing.sha,
      branch: 'main'
    });

    assert.equal(requestCalls.length, 2);
    assert.equal(requestCalls[1].options.method, 'DELETE');
    const deleteBody = JSON.parse(requestCalls[1].written[0]);
    assert.equal(deleteBody.sha, 'del456');
  });

  it('deleteFileFromGithub skips when file not found', async () => {
    mockHttps([
      { statusCode: 404, body: '{"message":"Not Found"}' }
    ]);

    const token = 'ghp_test';
    const apiPath = `/repos/yourorg/your-repo/contents/admin/uploads/gone.jpg`;
    const existing = await githubApi(token, 'GET', `${apiPath}?ref=main`);
    // No sha means we skip the delete
    const shouldDelete = existing && existing.sha;
    assert.equal(shouldDelete, undefined);
    assert.equal(requestCalls.length, 1); // Only the GET, no DELETE
  });

  // Test queue serialization
  it('queueContentSync serializes multiple syncs', async () => {
    const order = [];
    let resolvers = [];

    // Mock githubApi to track call order with controlled resolution
    const originalGithubApi = githubApi;
    const trackedCalls = [];

    // Replicate queueContentSync
    let contentSyncQueue = Promise.resolve();
    function queueContentSync(syncFn) {
      contentSyncQueue = contentSyncQueue.then(() => syncFn()).catch(() => {});
    }

    // Queue three syncs
    const results = [];
    queueContentSync(async () => { results.push('first'); });
    queueContentSync(async () => { results.push('second'); });
    queueContentSync(async () => { results.push('third'); });

    // Wait for queue to drain
    await contentSyncQueue;

    assert.deepEqual(results, ['first', 'second', 'third']);
  });

  it('queueContentSync continues after error', async () => {
    const results = [];

    let contentSyncQueue = Promise.resolve();
    function queueContentSync(syncFn) {
      contentSyncQueue = contentSyncQueue.then(() => syncFn()).catch(() => {});
    }

    queueContentSync(async () => { results.push('first'); });
    queueContentSync(async () => { throw new Error('fail'); });
    queueContentSync(async () => { results.push('third'); });

    await contentSyncQueue;

    // First runs, second fails, third still runs
    assert.deepEqual(results, ['first', 'third']);
  });
});
