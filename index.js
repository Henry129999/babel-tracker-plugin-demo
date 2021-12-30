const { transformFromAstSync } = require('@babel/core');
const autoTrackPlugin = require('./src/auto-tracker-plugin');
const  parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');

// 读取 sourceCode
const sourceCode = fs.readFileSync(path.join(__dirname, './sourceCodeTest.js'), {
  encoding: 'utf-8'
});

// 生成 AST
const AST = parser.parse(sourceCode, {
  sourceType: 'unambiguous'
});

// 将转换结果生成 code
const { code } = transformFromAstSync(AST, sourceCode, {
  plugins: [[autoTrackPlugin, {
    trackerPath: 'tracker'
  }]]
});

// 将结果代码写入 sourceCodeNew 文件中
fs.writeFile(path.join(__dirname, './sourceCodeNew.js'), code, () => {})
