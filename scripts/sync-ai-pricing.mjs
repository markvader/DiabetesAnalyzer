#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MODELS_FILE = path.join(ROOT, 'src/constants/openaiModels.ts');

const PROVIDER_SOURCES = {
  openai: 'https://developers.openai.com/api/docs/pricing',
  google: 'https://ai.google.dev/gemini-api/docs/pricing',
  anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  deepseek: 'https://api-docs.deepseek.com/quick_start/pricing'
};

const OPENAI_MODELS = [
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.2-pro',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo'
];

const GEMINI_HEADINGS = {
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
  'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
  'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash-Lite Preview',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash-Lite'
};

const ANTHROPIC_NAMES = {
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-haiku-3-5': 'Claude Haiku 3.5',
  'claude-haiku-3': 'Claude Haiku 3'
};

const DEEPSEEK_MODELS = ['deepseek-chat', 'deepseek-reasoner'];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDollar(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function findOpenAIRowPrices(page, modelId) {
  const re = new RegExp(
    `\\|\\s*${escapeRegExp(modelId)}[^|]*\\|\\s*\\$([\\d.]+)\\s*\\|\\s*(?:\\$[\\d.]+|-)\\s*\\|\\s*\\$([\\d.]+)\\s*\\|`,
    'i'
  );
  const m = page.match(re);
  if (!m) return null;
  return {
    input: parseDollar(m[1]),
    output: parseDollar(m[2])
  };
}

function extractSection(page, heading) {
  const headingRe = new RegExp(`##\\s*${escapeRegExp(heading)}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
  const m = page.match(headingRe);
  return m ? m[0] : null;
}

function findGeminiPrices(page, heading) {
  const section = extractSection(page, heading);
  if (!section) return null;

  const inputLine = section.match(/Input price[^\n]*\$([\d.]+)/i);
  const outputLine = section.match(/Output price[^\n]*\$([\d.]+)/i);
  if (!inputLine || !outputLine) return null;

  return {
    input: parseDollar(inputLine[1]),
    output: parseDollar(outputLine[1])
  };
}

function findAnthropicPrices(page, name) {
  const lineRe = new RegExp(`\\|\\s*${escapeRegExp(name)}\\s*\\|([^\\n]+)`, 'i');
  const m = page.match(lineRe);
  if (!m) return null;

  const dollars = [...m[1].matchAll(/\$([\d.]+)\s*\/\s*MTok/gi)].map(x => parseDollar(x[1]));
  if (dollars.length < 2) return null;

  return {
    input: dollars[0],
    output: dollars[dollars.length - 1]
  };
}

function findDeepSeekPrices(page, modelId) {
  const rowRe = new RegExp(`\\|\\s*${escapeRegExp(modelId)}\\s*\\|([\\s\\S]*?)(?=\\n\\|\\s*---|\\n\\|\\s*deepseek-|$)`, 'i');
  const row = page.match(rowRe);

  const inputMiss = page.match(/1M INPUT TOKENS \(CACHE MISS\)\s*\|\s*\$([\d.]+)/i);
  const output = page.match(/1M OUTPUT TOKENS\s*\|\s*\$([\d.]+)/i);

  if (!row || !inputMiss || !output) return null;

  return {
    input: parseDollar(inputMiss[1]),
    output: parseDollar(output[1])
  };
}

function updateModelPricing(source, modelId, input, output, pricingAsOf) {
  const blockRe = new RegExp(
    `(id:\\s*'${escapeRegExp(modelId)}',[\\s\\S]*?inputCostPer1M:\\s*)([^,]+)(,[\\s\\S]*?outputCostPer1M:\\s*)([^,]+)(,[\\s\\S]*?pricingAsOf:\\s*')([^']*)(')`,
    'm'
  );

  if (!blockRe.test(source)) {
    return { updated: false, reason: 'model block not found' };
  }

  const next = source.replace(blockRe, `$1${input}$3${output}$5${pricingAsOf}$7`);
  const updated = next !== source;
  return { updated, next };
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DiabetesAnalyzer-PricingSync/1.0',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function main() {
  console.log('Syncing AI pricing from official provider pages...');
  const pricingAsOf = new Date().toISOString().slice(0, 10);

  const [openaiPage, googlePage, anthropicPage, deepseekPage] = await Promise.all([
    fetchPage(PROVIDER_SOURCES.openai),
    fetchPage(PROVIDER_SOURCES.google),
    fetchPage(PROVIDER_SOURCES.anthropic),
    fetchPage(PROVIDER_SOURCES.deepseek)
  ]);

  let file = await fs.readFile(MODELS_FILE, 'utf8');
  const changes = [];

  for (const id of OPENAI_MODELS) {
    const price = findOpenAIRowPrices(openaiPage, id);
    if (!price || price.input == null || price.output == null) continue;

    const result = updateModelPricing(file, id, price.input, price.output, pricingAsOf);
    if (result.updated && result.next) {
      file = result.next;
      changes.push(`${id}: input $${price.input}, output $${price.output}`);
    }
  }

  for (const [id, heading] of Object.entries(GEMINI_HEADINGS)) {
    const price = findGeminiPrices(googlePage, heading);
    if (!price || price.input == null || price.output == null) continue;

    const result = updateModelPricing(file, id, price.input, price.output, pricingAsOf);
    if (result.updated && result.next) {
      file = result.next;
      changes.push(`${id}: input $${price.input}, output $${price.output}`);
    }
  }

  for (const [id, name] of Object.entries(ANTHROPIC_NAMES)) {
    const price = findAnthropicPrices(anthropicPage, name);
    if (!price || price.input == null || price.output == null) continue;

    const result = updateModelPricing(file, id, price.input, price.output, pricingAsOf);
    if (result.updated && result.next) {
      file = result.next;
      changes.push(`${id}: input $${price.input}, output $${price.output}`);
    }
  }

  for (const id of DEEPSEEK_MODELS) {
    const price = findDeepSeekPrices(deepseekPage, id);
    if (!price || price.input == null || price.output == null) continue;

    const result = updateModelPricing(file, id, price.input, price.output, pricingAsOf);
    if (result.updated && result.next) {
      file = result.next;
      changes.push(`${id}: input $${price.input}, output $${price.output}`);
    }
  }

  if (changes.length === 0) {
    console.log('No pricing values changed.');
    return;
  }

  await fs.writeFile(MODELS_FILE, file, 'utf8');
  console.log(`Updated ${changes.length} model pricing entries in src/constants/openaiModels.ts`);
  for (const line of changes) {
    console.log(`- ${line}`);
  }
}

main().catch(err => {
  console.error('Pricing sync failed:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
