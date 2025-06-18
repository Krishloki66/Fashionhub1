const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function extractSelectors(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const selectors = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*')).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className
    }))
  );
  await browser.close();
  return selectors;
}

async function explainChange(oldSelector, newSelector) {
  const prompt = `Explain difference:\nOld: ${oldSelector}\nNew: ${newSelector}`;
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }]
    },
    { headers: { "Content-Type": "application/json" } }
  );

  return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation";
}

(async () => {
  const oldSelectors = await extractSelectors('https://your-site.com/version1'); // Replace
  const newSelectors = await extractSelectors('https://your-site.com/version2'); // Replace

  const changes = [];

  for (const oldSel of oldSelectors) {
    const match = newSelectors.find(newSel =>
      oldSel.tag === newSel.tag && oldSel.id !== newSel.id
    );
    if (match) {
      const oldStr = `${oldSel.tag}#${oldSel.id}.${oldSel.class}`;
      const newStr = `${match.tag}#${match.id}.${match.class}`;
      const explanation = await explainChange(oldStr, newStr);
      changes.push({ oldSelector: oldStr, newSelector: newStr, explanation });
    }
  }

  fs.writeFileSync('changes.json', JSON.stringify(changes, null, 2));
})();
