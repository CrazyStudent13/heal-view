// OpenAPI 文档的唯一事实来源：server/src/docs/openapi.yaml。
// 放在 server/src 下是为了让 Docker 镜像（只 COPY server/src）也能直接提供文档。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, 'openapi.yaml');

export const openApiDocument = parse(fs.readFileSync(specPath, 'utf8'));
