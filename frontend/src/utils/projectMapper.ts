import { ProjectData } from '../types/project';

export const mapProjectFromBackend = (data: any): ProjectData => {
  const safeData = data || {};

  const safeFormatDate = (date: any): string => {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    if (typeof date === 'string' && date.includes('T')) return date.split('T')[0];
    return '';
  };

  // collect possible margin fields (handles legacy/backwards-compatible shapes)
  const marginCandidates = [safeData.margin_goal, safeData.marginGoal, safeData.dm_goal, safeData.dm, safeData.gmbs_goal, safeData.DM];
  const firstMargin = marginCandidates.find((v: any) => v != null && v !== '');
  const normalizedMarginGoal = firstMargin != null && firstMargin !== '' ? Number(firstMargin) : '';

  const mappedProject: any = {
    id: safeData.id,
    title: safeData.title ?? '',
    crmCode: safeData.crm_code ?? safeData.crmCode ?? '',
    client: safeData.client_id ?? safeData.client ?? '', // Para el select necesitamos el client_id
    activity: safeData.activity ?? '',
    startDate: safeFormatDate(safeData.start_date ?? safeData.startDate),
    endDate: safeFormatDate(safeData.end_date ?? safeData.endDate),
    businessManager: safeData.business_manager ?? safeData.businessManager ?? '',
    businessUnit: safeData.business_unit ?? safeData.businessUnit ?? '',
    buLine: safeData.bu_line ?? safeData.buLine ?? '',
    opsDomain: safeData.ops_domain ?? safeData.opsDomain ?? '',
    country: safeData.country ?? '',
    marginType: safeData.margin_type ?? safeData.marginType ?? '',
    marginGoal: normalizedMarginGoal,
    countries: Array.isArray(safeData.countries) ? safeData.countries.map((c: any) => String(c)) : [],
    iqp: safeData.iqp ?? '',
    segmentation: safeData.segmentation ?? '',
    description: safeData.description ?? '',
  };

  Object.keys(safeData).forEach(key => {
    const mappedKeys = [
      'title', 'crm_code', 'client', 'activity', 'start_date', 'end_date',
      'business_manager', 'business_unit', 'bu_line', 'ops_domain', 'country',
      'margin_type', 'margin_goal',
      'additional_countries', 'iqp', 'segmentation', 'description',
      'crmCode', 'startDate', 'endDate', 'businessManager', 'businessUnit', 'buLine', 'marginType', 'marginGoal',
      'opsDomain', 'countries'
    ];
    if (!mappedKeys.includes(key)) {
      mappedProject[key] = safeData[key];
    }
  });

  return mappedProject;
};

export default mapProjectFromBackend;
