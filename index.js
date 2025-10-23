require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const Parser = require('rss-parser');

// ===========================
// ENVIRONMENT DETECTION
// ===========================

const isProduction = process.env.NODE_ENV === 'production';
const hasRenderUrl = !!process.env.RENDER_URL;
const enableSelfPing = isProduction && hasRenderUrl;
const enableBackgroundCron = isProduction;

console.log('\n🤖 Starting Opportunities4Africa Bot...');
console.log(`📅 ${new Date().toLocaleString()}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (isProduction) {
  console.log('🚀 Mode: PRODUCTION (Render)');
  console.log(`🏓 Self-ping: ${enableSelfPing ? 'ENABLED' : 'DISABLED'}`);
  console.log('⏰ Background cron: ENABLED');
} else {
  console.log('🧪 Mode: DEVELOPMENT (Local)');
  console.log('🏓 Self-ping: DISABLED');
  console.log('⏰ Background cron: DISABLED');
  console.log('💡 Tip: Use buttons to control the bot');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ===========================
// CONFIGURATION
// ===========================

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const RENDER_URL = process.env.RENDER_URL;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required in .env file');
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error('❌ CHANNEL_ID is required in .env file');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const rssParser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// Branding
const HEADER = '🌍 *Opportunities4Africa* 🌍\n━━━━━━━━━━━━━━━━━━━━\n\n';
const FOOTER = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Powered by Almuk* ⚡';

// State management
let postedOpportunities = new Set();
let statsCounter = { 
  total: 0, 
  scholarships: 0, 
  volunteer: 0, 
  ngo: 0, 
  tech: 0,
  lastScan: null,
  scansToday: 0
};
let botState = { 
  isPaused: false,
  pausedAt: null,
  resumedAt: null
};

// Channel management
let managedChannels = [
  {
    id: CHANNEL_ID,
    name: 'Main Channel',
    active: true,
    addedAt: new Date(),
    totalPosts: 0
  }
];

// ===========================
// SOURCES
// ===========================

const sources = {
  scholarships: {
    rss: [
      { name: 'Opportunity Desk', url: 'https://opportunitydesk.org/feed/' },
      { name: 'Opportunities for Africans', url: 'https://www.opportunitiesforafricans.com/feed/' }
    ]
  },
  volunteer: {
    rss: [
      { name: 'Go Volunteer Africa', url: 'https://govolunteerafrica.org/feed/' }
    ]
  },
  ngo: {
    rss: [
      { name: 'ReliefWeb RSS', url: 'https://reliefweb.int/updates/rss.xml' }
    ]
  },
  tech: {
    rss: [
      { name: 'RemoteOK', url: 'https://remoteok.com/remote-dev-jobs.rss' }
    ]
  }
};

// ===========================
// HELPER FUNCTIONS
// ===========================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function summarizeText(text, maxLength = 250) {
  if (!text) return 'No description available.';
  text = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
  if (!dateString) return 'Recently posted';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently posted';
  }
}

function generateOpportunityId(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function addBranding(content) {
  return HEADER + content + FOOTER;
}

function isAdmin(userId) {
  return userId.toString() === ADMIN_USER_ID;
}

// ===========================
// BUTTON KEYBOARDS
// ===========================

function getAdminKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 Dashboard' }, { text: '🔍 Scan Now' }],
      [{ text: '⏸️ Pause Bot' }, { text: '▶️ Resume Bot' }],
      [{ text: '📚 Sources' }, { text: '⚙️ Settings' }],
      [{ text: '❌ Close Menu' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

// ===========================
// RSS SCRAPER
// ===========================

async function scrapeRSSFeed(source, category) {
  try {
    console.log(`  📡 Fetching: ${source.name}`);
    
    // Shorter timeout - 20 seconds max
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const feed = await Promise.race([
      rssParser.parseURL(source.url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Feed timeout after 20s')), 20000)
      )
    ]);
    
    clearTimeout(timeoutId);
    const opportunities = [];
    
    for (const item of feed.items.slice(0, 3)) {
      const opportunityId = generateOpportunityId(item.link || item.guid);
      
      if (!postedOpportunities.has(opportunityId)) {
        opportunities.push({
          title: cleanText(item.title),
          link: item.link || item.guid,
          description: cleanText(item.contentSnippet || item.content || ''),
          date: formatDate(item.pubDate),
          source: source.name,
          category: category,
          id: opportunityId
        });
      }
    }
    
    console.log(`  ✅ Found ${opportunities.length} new opportunities`);
    return opportunities;
  } catch (error) {
    console.error(`  ⏱️  ${source.name} timed out or failed - skipping`);
    return [];
  }
}


// ===========================
// FORMAT OPPORTUNITY
// ===========================

function formatOpportunity(opp) {
  const emoji = {
    scholarships: '🎓',
    volunteer: '🤝',
    ngo: '🏢',
    tech: '💻'
  }[opp.category] || '📢';

  return `
${emoji} *${opp.category.toUpperCase()} OPPORTUNITY*

*${opp.title}*

${summarizeText(opp.description, 200)}

📅 ${opp.date}
🔗 [Apply Here](${opp.link})

📌 Source: ${opp.source}
  `.trim();
}

// ===========================
// POST TO CHANNELS
// ===========================

async function postToChannels(opp) {
  const message = addBranding(formatOpportunity(opp));
  const activeChannels = managedChannels.filter(ch => ch.active);
  
  for (const channel of activeChannels) {
    try {
      await bot.telegram.sendMessage(channel.id, message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: false 
      });
      channel.totalPosts++;
      console.log(`  ✅ Posted to ${channel.name}`);
      await sleep(3000);
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
}

// ===========================
// DISCOVERY FUNCTION
// ===========================

async function discoverAndPostOpportunities() {
  console.log('\n🔍 Starting scan...\n');
  
  for (const [category, categoryData] of Object.entries(sources)) {
    console.log(`📂 Category: ${category.toUpperCase()}`);
    
    if (categoryData.rss) {
      for (const source of categoryData.rss) {
        const opportunities = await scrapeRSSFeed(source, category);
        
        for (const opp of opportunities) {
          await postToChannels(opp);
          postedOpportunities.add(opp.id);
          statsCounter[category]++;
          statsCounter.total++;
          await sleep(5000);
        }
      }
    }
  }
  
  statsCounter.lastScan = new Date().toLocaleTimeString();
  statsCounter.scansToday++;
  console.log('\n✨ Scan complete!\n');
}

// ===========================
// BOT COMMANDS
// ===========================

bot.command('start', (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply('This bot posts to channels automatically.');
  }

  const msg = `
🤖 *Opportunities4Africa Bot*

Welcome, Admin!

Status: ${botState.isPaused ? '⏸️ Paused' : '✅ Active'}
Posts Today: ${statsCounter.total}

Use buttons below to control the bot.
  `;

  ctx.reply(msg, {
    parse_mode: 'Markdown',
    reply_markup: getAdminKeyboard()
  });
});

// Dashboard Button
bot.hears('📊 Dashboard', (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  const msg = `
📊 *Dashboard*

Status: ${botState.isPaused ? '⏸️ Paused' : '✅ Active'}
Total Posts: ${statsCounter.total}
Last Scan: ${statsCounter.lastScan || 'Not yet'}

*Breakdown:*
📚 Scholarships: ${statsCounter.scholarships}
🤝 Volunteer: ${statsCounter.volunteer}
🏢 NGO: ${statsCounter.ngo}
💻 Tech: ${statsCounter.tech}
  `;

  ctx.reply(msg, { parse_mode: 'Markdown' });
});

// Scan Now Button

bot.hears('🔍 Scan Now', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  if (botState.isPaused) {
    return ctx.reply('⚠️ Bot is paused. Resume it first.');
  }

  try {
    await ctx.reply('🔍 Starting scan... Please wait.');
    await discoverAndPostOpportunities();
    await ctx.reply(`✅ Scan complete! Posted ${statsCounter.total} total opportunities.`);
  } catch (error) {
    console.error('Scan error:', error.message);
    await ctx.reply('⚠️ Scan completed with some errors. Check console.');
  }
});


// Pause Button
bot.hears('⏸️ Pause Bot', (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  botState.isPaused = true;
  botState.pausedAt = new Date();
  ctx.reply('⏸️ Bot paused. Press [▶️ Resume Bot] to continue.');
});

// Resume Button
bot.hears('▶️ Resume Bot', (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  botState.isPaused = false;
  ctx.reply('▶️ Bot resumed!');
});

// Sources Button
bot.hears('📚 Sources', (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  let msg = '📚 *Monitored Sources*\n\n';
  
  for (const [category, data] of Object.entries(sources)) {
    msg += `*${category.toUpperCase()}*\n`;
    if (data.rss) {
      data.rss.forEach((s, i) => msg += `${i + 1}. ${s.name}\n`);
    }
    msg += '\n';
  }

  ctx.reply(msg, { parse_mode: 'Markdown' });
});

// Settings Button
bot.hears('⚙️ Settings', (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  const msg = `
⚙️ *Settings*

Mode: Development
Channel: ${CHANNEL_ID}
Auto-scan: ${enableBackgroundCron ? 'Enabled' : 'Disabled'}
  `;

  ctx.reply(msg, { parse_mode: 'Markdown' });
});

// Close Menu Button
bot.hears('❌ Close Menu', (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  ctx.reply('Menu closed.', { reply_markup: { remove_keyboard: true } });
});

// ===========================
// CRON JOBS
// ===========================

if (enableBackgroundCron) {
  cron.schedule('*/30 * * * *', async () => {
    if (!botState.isPaused) {
      console.log('⏰ Scheduled scan');
      await discoverAndPostOpportunities();
    }
  });
}

// ===========================
// EXPRESS SERVER
// ===========================

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    bot: 'Opportunities4Africa',
    total_posts: statsCounter.total,
    uptime: Math.floor(process.uptime())
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}\n`);
});

// ===========================
// START BOT
// ===========================
// ===========================
// ERROR HANDLER
// ===========================

bot.catch((err, ctx) => {
  console.error('❌ Bot error caught:', err.message);
  if (ctx) {
    ctx.reply('⚠️ An error occurred. Please try again.').catch(() => {});
  }
});

// ===========================
// START BOT
// ===========================

bot.launch()
  .then
