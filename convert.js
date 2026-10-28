// Logique pure (pas de DOM) : détection des montants et conversion en FCFA.
const FCFA = (() => {
  // Parité fixe : 1 EUR = 655,957 FCFA (XOF et XAF sont au même taux).
  const PEG = 655.957;

  const SYMBOLS = {
    'US$': 'USD', 'CA$': 'CAD', 'C$': 'CAD', 'AU$': 'AUD', 'A$': 'AUD',
    'NZ$': 'NZD', 'HK$': 'HKD', 'S$': 'SGD', 'R$': 'BRL',
    '€': 'EUR', '£': 'GBP', '₦': 'NGN', '₹': 'INR', 'GH₵': 'GHS', '₵': 'GHS',
    '$': '$'
  };
  // Codes ISO reconnus (liste volontairement restreinte pour éviter les faux positifs type "TOP 10").
  const CODES = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'INR', 'NGN', 'GHS',
    'ZAR', 'MAD', 'KES', 'EGP', 'AED', 'SAR', 'BRL', 'MXN', 'SEK', 'NOK', 'DKK', 'PLN',
    'CZK', 'HKD', 'SGD', 'KRW', 'TND', 'DZD'
  ];

  const NUM = String.raw`\d{1,3}(?:[ \u00A0\u202F.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
  const SP = String.raw`[ \u00A0\u202F]?`;

  let rates = null;      // unités de chaque devise pour 1 USD
  let dollar = 'USD';    // ce que désigne le symbole "$"
  let mode = 'replace';  // 'replace' | 'both'
  let reA = null;        // symbole/code AVANT le montant
  let reB = null;        // symbole/code APRÈS le montant

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byLength = arr => arr.sort((a, b) => b.length - a.length).map(esc).join('|');

  function configure(opts) {
    if ('rates' in opts) rates = opts.rates;
    if ('dollar' in opts) dollar = opts.dollar;
    if ('mode' in opts) mode = opts.mode;

    const codes = CODES.filter(c => c === 'EUR' || (rates && rates[c]));
    const syms = Object.keys(SYMBOLS).filter(s => SYMBOLS[s] === '$' || codes.includes(SYMBOLS[s]));
    const codeAlt = byLength([...codes]);
    const allAlt = byLength([...codes, ...syms]);

    reA = new RegExp(`(?<!\\w)(${allAlt})${SP}(${NUM})(?:${SP}(${codeAlt})(?![A-Za-z]))?(?!\\d)`, 'g');
    reB = new RegExp(`(?<![\\w.,])(${NUM})${SP}(${allAlt})(?![A-Za-z\\d])`, 'g');
  }

  // "1,234.56" / "1.234,56" / "1 234,56" / "12,99" / "1234.5" -> nombre
  function parseAmount(raw) {
    let s = raw.replace(/[ \u00A0\u202F]/g, '');
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    let dec = null;
    if (lastDot > -1 && lastComma > -1) {
      dec = lastDot > lastComma ? '.' : ',';
    } else {
      const sep = lastDot > -1 ? '.' : lastComma > -1 ? ',' : null;
      if (sep) {
        const count = s.split(sep).length - 1;
        const after = s.length - s.lastIndexOf(sep) - 1;
        if (count === 1 && after !== 3) dec = sep;
      }
    }
    if (dec) {
      s = s.replace(dec === '.' ? /,/g : /\./g, '').replace(dec, '.');
    } else {
      s = s.replace(/[.,]/g, '');
    }
    return parseFloat(s);
  }

  function xofPerUnit(code) {
    if (code === 'XOF' || code === 'XAF') return 1;
    if (code === 'EUR') return PEG;
    if (!rates || !rates.EUR || !rates[code]) return null;
    return PEG * rates.EUR / rates[code];
  }

  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const format = n => nf.format(Math.round(n)).replace(/\u202f/g, '\u00a0') + '\u00a0FCFA';

  function toCode(sym) {
    const c = SYMBOLS[sym] || sym;
    return c === '$' ? dollar : c;
  }

  function handle(whole, sym, num, trailing) {
    const rate = xofPerUnit(trailing || toCode(sym));
    const amount = parseAmount(num);
    if (rate == null || !isFinite(amount)) return whole;
    const out = format(amount * rate);
    return mode === 'both' ? `${out} (${whole.trim()})` : out;
  }

  function convert(text) {
    if (!reA) return text;
    return text
      .replace(reA, (m, sym, num, trailing) => handle(m, sym, num, trailing))
      .replace(reB, (m, num, sym) => handle(m, sym, num));
  }

  configure({});
  return { configure, convert, parseAmount };
})();

if (typeof module !== 'undefined') module.exports = FCFA;
