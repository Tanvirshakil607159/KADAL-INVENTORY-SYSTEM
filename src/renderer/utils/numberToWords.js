export function convertIntegerToWords(num) {
  if (num === 0) return 'ZERO';

  const a = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  function helper(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 !== 0 ? ' ' + helper(n % 100) : '');
    if (n < 1000000) return helper(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 !== 0 ? ' ' + helper(n % 1000) : '');
    if (n < 1000000000) return helper(Math.floor(n / 1000000)) + ' MILLION' + (n % 1000000 !== 0 ? ' ' + helper(n % 1000000) : '');
    return helper(Math.floor(n / 1000000000)) + ' BILLION' + (n % 1000000000 !== 0 ? ' ' + helper(n % 1000000000) : '');
  }

  return helper(num).trim();
}

export function numberToCurrencyWords(amount, currency = 'USD') {
  const num = Number(amount);
  if (isNaN(num)) return '';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const dollars = Math.floor(absNum);
  const cents = Math.round((absNum - dollars) * 100);

  const dollarUnit = currency === 'BDT' ? (dollars === 1 ? 'TAKA' : 'TAKA') : (dollars === 1 ? 'DOLLARS' : 'DOLLARS');
  const centUnit = currency === 'BDT' ? (cents === 1 ? 'POISHA' : 'POISHA') : (cents === 1 ? 'CENT' : 'CENTS');

  let words = '';
  if (dollars > 0) {
    words += `${convertIntegerToWords(dollars)} ${dollarUnit}`;
  } else if (cents === 0) {
    words = `ZERO ${dollarUnit}`;
  }

  if (cents > 0) {
    if (words) {
      words += ` AND ${convertIntegerToWords(cents)} ${centUnit}`;
    } else {
      words = `${convertIntegerToWords(cents)} ${centUnit}`;
    }
  }

  if (!cents && dollars > 0) {
    words += ' ONLY';
  }

  if (isNegative) {
    words = 'MINUS ' + words;
  }

  return words + '.';
}
