export const formatCurrency = (value: number, currency: string = 'EUR'): string => {
  // Always use decimal point for consistency with input fields
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  // Replace $ with € for EUR
  if (currency === 'EUR') {
    return formatted.replace('$', '€');
  }
  return formatted;
};

export const formatNumber = (value: number, decimals: number = 2): string => {
  // Use en-US locale for consistent decimal points
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value >= 0 ? '+' : ''}${formatNumber(value, decimals)}%`;
};


export const formatCompactCurrency = (value: number, currency: string = 'EUR'): string => {
  if (Math.abs(value) < 1000) {
    return formatCurrency(value, currency);
  }
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
  
  if (currency === 'EUR') {
    return formatted.replace('$', '€');
  }
  return formatted;
};