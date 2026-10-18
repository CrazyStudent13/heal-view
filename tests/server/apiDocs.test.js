import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openApiDocument } from '../../server/src/docs/openapi.js';

const routeSource = fs.readFileSync(fileURLToPath(new URL('../../server/src/routes/api.js', import.meta.url)), 'utf8');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/** Redoc 的静态 bundle 是文档页资源，不是业务接口，不要求写进 OpenAPI。 */
const STATIC_ASSET_ROUTES = new Set(['GET /redoc/redoc.standalone.js']);

/** Express 的 `:id` 在 OpenAPI 里写成 `{id}`。 */
function toSpecPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function routeOperations() {
  const operations = new Set();
  for (const match of routeSource.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    operations.add(`${match[1].toUpperCase()} ${toSpecPath(match[2])}`);
  }
  return operations;
}

function specOperations() {
  const operations = new Set();
  for (const [path, item] of Object.entries(openApiDocument.paths || {})) {
    for (const method of Object.keys(item)) {
      if (HTTP_METHODS.has(method)) operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

test('OpenAPI document is valid enough to serve and covers every route', () => {
  assert.equal(openApiDocument.openapi, '3.0.3');
  assert.ok(openApiDocument.info?.title);
  assert.ok(openApiDocument.servers?.length > 0);
  assert.ok(openApiDocument.components?.securitySchemes?.cookieAuth);

  const routes = [...routeOperations()].filter((operation) => !STATIC_ASSET_ROUTES.has(operation)).sort();
  const spec = [...specOperations()].sort();
  // 文档和路由必须一一对应：新增接口漏文档、或删接口留下死文档，都会在这里失败。
  assert.deepEqual(spec, routes);
});

test('OpenAPI responses and request bodies reference existing schemas', () => {
  const schemaNames = new Set(Object.keys(openApiDocument.components?.schemas || {}));
  const refs = JSON.stringify(openApiDocument).matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g);
  for (const [, name] of refs) {
    assert.ok(schemaNames.has(name), `Unknown schema reference: ${name}`);
  }
});
