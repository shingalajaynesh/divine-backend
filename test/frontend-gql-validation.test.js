process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'fs';
import path from 'path';
import { parse, validate } from 'graphql';
import schema from '../src/gql/schema/index.js';

// Recursive finder for files
const findFiles = (dir, ext, fileList = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        findFiles(filePath, ext, fileList);
      }
    } else if (filePath.endsWith(ext)) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

// Extracts GQL documents from JSX/JS files
const extractGqlDocuments = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  // Match gql`...` blocks
  const regex = /gql`([\s\S]*?)`/g;
  const docs = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    docs.push({
      doc: match[1],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  return docs;
};

test('Validate all frontend GraphQL queries and mutations against backend schema', () => {
  // Path to frontend src directory (relative to divine-backend)
  const frontendSrcDir = path.resolve(process.cwd(), '../divine-web/src');
  if (!fs.existsSync(frontendSrcDir)) {
    console.log('Skipping frontend query validation: divine-web src dir not found.');
    return;
  }

  const files = [
    ...findFiles(frontendSrcDir, '.jsx'),
    ...findFiles(frontendSrcDir, '.js')
  ];

  let totalDocs = 0;
  let validationErrorsCount = 0;

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const documents = extractGqlDocuments(file);
    for (const { doc, line } of documents) {
      if (!doc.trim()) continue;
      totalDocs++;
      try {
        const ast = parse(doc);
        const errors = validate(schema, ast);
        if (errors.length > 0) {
          validationErrorsCount += errors.length;
          console.error(`Validation failed in ${relativePath} at line ${line}:`);
          errors.forEach(err => console.error(`  - ${err.message}`));
        }
      } catch (err) {
        validationErrorsCount++;
        console.error(`Syntax parse error in ${relativePath} at line ${line}: ${err.message}`);
      }
    }
  }

  console.log(`Audited ${totalDocs} frontend GraphQL documents.`);
  assert.equal(validationErrorsCount, 0, `Found ${validationErrorsCount} GraphQL document validation/parsing errors in frontend.`);
});
