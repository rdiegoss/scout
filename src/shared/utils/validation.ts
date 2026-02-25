const VALID_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46',
  '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

function isValidLocalNumber(digits: string): boolean {
  if (digits.length === 9) {
    return digits[0] === '9';
  }
  if (digits.length === 8) {
    return true;
  }
  return false;
}

export function isValidBrazilianPhone(phone: string): boolean {
  if (!phone) return false;

  const countryCodeMatch = phone.match(/^\+55 (\d{2}) (\d{4,5})-(\d{4})$/);
  if (countryCodeMatch) {
    const ddd = countryCodeMatch[1];
    const firstPart = countryCodeMatch[2];
    const secondPart = countryCodeMatch[3];
    if (!VALID_DDDS.has(ddd)) return false;
    return isValidLocalNumber(firstPart + secondPart);
  }

  const dddMatch = phone.match(/^\((\d{2})\) (\d{4,5})-(\d{4})$/);
  if (dddMatch) {
    const ddd = dddMatch[1];
    const firstPart = dddMatch[2];
    const secondPart = dddMatch[3];
    if (!VALID_DDDS.has(ddd)) return false;
    return isValidLocalNumber(firstPart + secondPart);
  }

  const localMatch = phone.match(/^(\d{4,5})-(\d{4})$/);
  if (localMatch) {
    const firstPart = localMatch[1];
    const secondPart = localMatch[2];
    return isValidLocalNumber(firstPart + secondPart);
  }

  if (/[a-zA-Z]/.test(phone)) return false;

  const rawDigits = phone.replace(/\D/g, '');
  if (rawDigits.length === 10 || rawDigits.length === 11) {
    const ddd = rawDigits.slice(0, 2);
    const local = rawDigits.slice(2);
    if (!VALID_DDDS.has(ddd)) return false;
    return isValidLocalNumber(local);
  }

  if (rawDigits.length === 8 || rawDigits.length === 9) {
    return isValidLocalNumber(rawDigits);
  }

  return false;
}

const MAX_COMMENT_LENGTH = 500;

export function isValidComment(comment: string | undefined): boolean {
  if (comment === undefined || comment === '') return true;
  return comment.length <= MAX_COMMENT_LENGTH;
}
