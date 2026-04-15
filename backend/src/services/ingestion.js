const axios = require('axios');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');

const extractFromPDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text.replace(/\s+/g, ' ').trim();
};

const extractFromText = (text) => {
  return text.replace(/\s+/g, ' ').trim();
};

const extractFromURL = async (url) => {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudyAI/1.0)' }
  });
  const $ = cheerio.load(response.data);
  $('script, style, nav, footer, header, aside, .ads, .advertisement, .sidebar').remove();
  const contentSelectors = ['article', 'main', '.content', '.post-content', '#content', 'body'];
  let text = '';
  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length && el.text().trim().length > 200) { text = el.text(); break; }
  }
  if (!text) text = $('body').text();
  return text.replace(/\s+/g, ' ').trim();
};

module.exports = { extractFromPDF, extractFromText, extractFromURL };
