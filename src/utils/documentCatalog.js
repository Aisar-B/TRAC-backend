export const DEFAULT_REQUESTS = Object.freeze([
  { id: 'cor', name: 'Certificate of Registration (COR)', category: 'Document', allowedRoles: ['student'], fee: 20, feeUnit: 'per_copy', processing_days: 1, allowsMultiple: true, active: true },
  { id: 'cog', name: 'Certificate of Grades (COG)', category: 'Document', allowedRoles: ['student'], fee: 20, feeUnit: 'per_copy', processing_days: 1, allowsMultiple: true, active: true },
  { id: 'tor', name: 'Transcript of Records (TOR)', category: 'Document', allowedRoles: ['alumni'], fee: 100, feeUnit: 'per_page', processing_days: 6, allowsMultiple: true, active: true },
  { id: 'gwa', name: 'General Weighted Average (GWA)', category: 'Document', allowedRoles: ['alumni'], fee: 70, feeUnit: 'per_copy', processing_days: 2, allowsMultiple: true, active: true },
  { id: 'cav', name: 'Certificate of Authentication and Verification (CAV)', category: 'Document', allowedRoles: ['alumni'], fee: 50, feeUnit: 'per_copy', processing_days: 2, allowsMultiple: true, active: true },
  { id: 'diploma', name: 'Diploma', category: 'Document', allowedRoles: ['alumni'], fee: 0, feeUnit: 'per_copy', processing_days: 3, allowsMultiple: true, active: true },
  { id: 'inc-form', name: 'INC Form', category: 'Form', allowedRoles: ['student'], fee: 15, feeUnit: 'per_subject', processing_days: 1, allowsMultiple: true, multipleLabel: 'subject', active: true },
  { id: 'shifting-form', name: 'Shifting Form', category: 'Form', allowedRoles: ['student'], fee: 0, feeUnit: 'per_copy', processing_days: 1, allowsMultiple: false, active: true }
]);

export const normalizeCatalog = (items) => {
  const source = Array.isArray(items) && items.length ? items : DEFAULT_REQUESTS;
  return source.map((item, index) => {
    const name = item?.name || item?.label || item?.value;
    const fallback = DEFAULT_REQUESTS.find((entry) => entry.name === name);
    const category = item?.category === 'Form' || item?.category === 'Forms' ? 'Form' : item?.category || fallback?.category;
    const feeUnit = item?.feeUnit || item?.fee_unit || fallback?.feeUnit || 'per_copy';
    const normalized = {
      ...item,
      id: item?.id ?? fallback?.id ?? `catalog-${index + 1}`,
      name,
      category,
      fee: Number(item?.fee ?? fallback?.fee ?? 0),
      feeUnit,
      processing_days: Number(item?.processing_days ?? fallback?.processing_days ?? 1),
      allowedRoles: Array.isArray(item?.allowedRoles) ? item.allowedRoles : (fallback?.allowedRoles || []),
      allowsMultiple: item?.allowsMultiple ?? fallback?.allowsMultiple ?? category === 'Document',
      active: item?.active !== false
    };
    delete normalized.serviceCategory;
    delete normalized.service_category;
    return normalized;
  }).filter((item) => item.name && ['Document', 'Form'].includes(item.category));
};