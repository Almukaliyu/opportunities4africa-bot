#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verifying Opportunities4Africa Bot Setup...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let errors = 0;
let warnings = 0;

// Check Node.js version
console.log('📦 Checking Node.js version...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion >= 18) {
  console.log(`✅ Node.js version: ${nodeVersion} (Compatible)\n`);
} else {
  console.log(`❌ Node.js version: ${nodeVersion} (Required: v18+)\n`);
  errors++;
}

// Check if .env file exists
console.log('📄 Checking .env file...');
if (fs.existsSync('.env')) {
  console.log('✅ .env file found\n');
} else {
  console.log('❌ .env file not found');
  console.log('💡 Copy .env.example to .env and fill in your values\n');
  errors++;
}

// Check environment variables
console.log('🔑 Checking environment variables...');

const requiredVars = {
  BOT_TOKEN: {
    required: true,
    format: /^\d+:[A-Za-z0-9_-]+$/,
    example: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'
  },
  CHANNEL_ID: {
    required: true,
    format: /^@[A-Za-z0-9_]+$|^-\d+$/,
    example: '@opportunities4africa or -1001234567890'
  },
  ADMIN_USER_ID: {
    required: true,
    format: /^\d+$/,
    example: '123456789'
  },
  NODE_ENV: {
    required: false,
    values: ['development', 'production']
  },
  RENDER_URL: {
    required: false,
    format: /^https?:\/\/.+/
  }
};

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  
  if (!value) {
    if (config.required) {
      console.log(`❌ ${varName}: Missing (Required)`);
      console.log(`   Example: ${config.example || 'See .env.example'}`);
      errors++;
    } else {
      console.log(`⚠️  ${varName}: Not set (Optional)`);
      warnings++;
    }
  } else {
    // Check format if specified
    if (config.format && !config.format.test(value)) {
      console.log(`❌ ${varName}: Invalid format`);
      console.log(`   Current: ${value.substring(0, 20)}...`);
      console.log(`   Expected: ${config.example}`);
      errors++;
    } else if (config.values && !config.values.includes(value)) {
      console.log(`⚠️  ${varName}: ${value} (Valid: ${config.values.join(', ')})`);
      warnings++;
    } else {
      console.log(`✅ ${varName}: Set correctly`);
    }
  }
}

console.log('');

// Check package.json
console.log('📦 Checking package.json...');
if (fs.existsSync('package.json')) {
  console.log('✅ package.json found\n');
} else {
  console.log('❌ package.json not found\n');
  errors++;
}

// Check if node_modules exists
console.log('📚 Checking dependencies...');
if (fs.existsSync('node_modules')) {
  console.log('✅ node_modules found (dependencies installed)\n');
} else {
  console.log('❌ node_modules not found');
  console.log('💡 Run: npm install\n');
  errors++;
}

// Check main index.js file
console.log('📄 Checking main bot file...');
if (fs.existsSync('index.js')) {
  console.log('✅ index.js found\n');
} else {
  console.log('❌ index.js not found\n');
  errors++;
}

// Check docs folder
console.log('📚 Checking documentation...');
if (fs.existsSync('docs')) {
  const docFiles = ['LOCAL_SETUP.md', 'RENDER_DEPLOYMENT.md', 'TROUBLESHOOTING.md'];
  let foundDocs = 0;
  docFiles.forEach(file => {
    if (fs.existsSync(path.join('docs', file))) {
      foundDocs++;
    }
  });
  console.log(`✅ Found ${foundDocs}/${docFiles.length} documentation files\n`);
} else {
  console.log('⚠️  docs folder not found (optional)\n');
  warnings++;
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 VERIFICATION SUMMARY\n');

if (errors === 0 && warnings === 0) {
  console.log('🎉 Perfect! All checks passed!\n');
  console.log('✅ Your bot is ready to run!');
  console.log('💡 Next step: npm run dev\n');
  process.exit(0);
} else if (errors === 0) {
  console.log(`⚠️  ${warnings} warning(s) found (non-critical)\n`);
  console.log('✅ Your bot should work fine!');
  console.log('💡 Next step: npm run dev\n');
  process.exit(0);
} else {
  console.log(`❌ ${errors} error(s) found`);
  console.log(`⚠️  ${warnings} warning(s) found\n`);
  console.log('🔧 Please fix the errors above before running the bot.\n');
  process.exit(1);
}
