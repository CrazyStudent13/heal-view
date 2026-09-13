import { parseImportArchive } from '@/api/fitnessApi.js';
import { formatNumber } from '@/i18n/index.js';
import { useLocaleStore } from '@/stores/localeStore.js';

export function useImportArchive() {
  const { t } = useLocaleStore();
  const parsing = ref(false);

  function platformLabel(value) {
    return value === 'huawei' ? t('import.huawei') : t('import.xiaomi');
  }

  function formatSize(size) {
    const value = Number(size);
    if (!Number.isFinite(value)) return '--';
    if (value < 1024) return `${formatNumber(value)} B`;
    if (value < 1024 * 1024) return `${formatNumber(value / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`;
    return `${formatNumber(value / 1024 / 1024, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
  }

  function normalizeIssue(issue) {
    if (typeof issue === 'string') return issue;
    return [issue?.source, issue?.rowNumber ? t('import.rowNumber', { row: issue.rowNumber }) : '', issue?.message || issue?.code]
      .filter(Boolean).join(t('common.labelSeparator'));
  }

  function normalizeResult(response, file, selectedPlatform) {
    const issues = response.issues || [];
    const status = issues.length > 0 ? 'partial' : 'success';
    const counts = response.summary?.counts || {};
    const dateRange = response.summary?.dateRange;
    const recordCount = Number(counts.metricSamples || 0) + Number(counts.bloodPressureRecords || 0)
      + Number(counts.sleepSessions || 0) + Number(counts.sportRecords || 0);
    return {
      importId: response.importId, status,
      title: status === 'partial' ? t('import.parsePartialTitle') : t('import.parseSuccessTitle'),
      message: status === 'partial' ? t('import.parsePartialMessage') : t('import.parseSuccessMessage'),
      overview: dateRange ? t('import.dateRangeValue', { start: dateRange.start, end: dateRange.end }) : t('import.recordCount', { count: recordCount }),
      platform: response.platform, platformLabel: response.platformLabel || platformLabel(selectedPlatform),
      fileName: response.fileName || file.name, fileSize: response.fileSize || file.size,
      fileSizeText: formatSize(response.fileSize || file.size), reasons: issues.map(normalizeIssue), previewItems: response.previewRows || []
    };
  }

  async function parseArchives({ platform, files }) {
    parsing.value = true;
    try {
      const parsedResults = [];
      for (const file of files) parsedResults.push(normalizeResult(await parseImportArchive(file, platform), file, platform));
      return parsedResults.length === 1 ? parsedResults[0] : {
        importId: null,
        status: parsedResults.some((item) => item.status === 'partial') ? 'partial' : 'success',
        title: t('import.batchParseTitle'), message: t('import.batchParseMessage', { count: parsedResults.length }),
        platformLabel: platformLabel(platform), fileName: t('import.archiveCount', { count: parsedResults.length }),
        fileSizeText: formatSize(files.reduce((sum, file) => sum + file.size, 0)),
        reasons: parsedResults.flatMap((item) => item.reasons.map((reason) => `${item.fileName}${t('common.labelSeparator')}${reason}`)),
        previewItems: parsedResults.flatMap((item) => item.previewItems).slice(0, 50)
      };
    } finally { parsing.value = false; }
  }

  return { parsing, parseArchives };
}
