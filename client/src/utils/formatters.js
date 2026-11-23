export const formatCurrency = (amount, currency = 'INR') => {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
};

export const getLocalizedText = (obj, lang = 'en') => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || obj.hi || obj.gu || '';
};

export const getRoleHomePath = (role) => {
  switch (role) {
    case 'superadmin':
    case 'admin':
      return '/dashboard/admin';
    case 'waiter':
      return '/dashboard/waiter';
    case 'kitchen':
      return '/dashboard/kitchen';
    case 'cashier':
      return '/dashboard/cashier';
    default:
      return '/login';
  }
};
