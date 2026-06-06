import { useMemo, useState } from 'react';
import { CheckCircle2, Columns3, Save, Trash2, WandSparkles } from 'lucide-react';
import {
  IMPORT_FIELDS,
  type ImportColumnMapping,
  type ImportConversion,
  type ImportFieldKey,
  validateImportMappings,
} from '../lib/csv-import-mapping';
import {
  useDeleteImportMappingPreset,
  useImportMappingPresets,
  useSaveImportMappingPreset,
} from '../lib/hooks';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const CONVERSIONS: Array<{ value: ImportConversion; label: string }> = [
  { value: 'none', label: 'As supplied' },
  { value: 'fraction-to-percent', label: 'Fraction to %' },
  { value: 'mg-g-to-percent', label: 'mg/g to %' },
  { value: 'g-kg-to-percent', label: 'g/kg to %' },
];

export function ImportMappingStudio({
  mappings,
  sourceRows,
  userId,
  onMappingsChange,
  onApply,
}: {
  mappings: ImportColumnMapping[];
  sourceRows: Record<string, string>[];
  userId?: string;
  onMappingsChange: (mappings: ImportColumnMapping[]) => void;
  onApply: () => void;
}) {
  const [presetName, setPresetName] = useState('');
  const [message, setMessage] = useState('');
  const { data: presets = [] } = useImportMappingPresets();
  const savePreset = useSaveImportMappingPreset();
  const deletePreset = useDeleteImportMappingPreset();
  const validation = useMemo(() => validateImportMappings(mappings), [mappings]);

  const updateMapping = (source: string, patch: Partial<ImportColumnMapping>) => {
    onMappingsChange(mappings.map(mapping => mapping.source === source ? { ...mapping, ...patch } : mapping));
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(item => item.id === presetId);
    if (!preset) return;
    const presetBySource = new Map(preset.mappings.map(item => [item.source, item]));
    onMappingsChange(mappings.map(mapping => {
      const saved = presetBySource.get(mapping.source);
      return saved
        ? { source: mapping.source, target: saved.target as ImportFieldKey | 'ignore', conversion: saved.conversion as ImportConversion }
        : mapping;
    }));
    setPresetName(preset.name);
    setMessage(`Loaded ${preset.name}.`);
  };

  const saveCurrentPreset = async () => {
    if (!userId || !presetName.trim() || validation.errors.length) return;
    try {
      await savePreset.mutateAsync({ name: presetName, mappings, createdBy: userId });
      setMessage(`Saved ${presetName.trim()} for future imports.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this import format.');
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
            <Columns3 className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Import mapping studio</h3>
            <p className="mt-0.5 text-xs text-slate-600">Match laboratory columns to platform fields and normalize units before import.</p>
          </div>
        </div>
        {presets.length > 0 && (
          <Select onValueChange={loadPreset}>
            <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="Load saved format" /></SelectTrigger>
            <SelectContent>
              {presets.map(preset => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Source column</th>
              <th className="px-3 py-2 font-semibold">Platform field</th>
              <th className="px-3 py-2 font-semibold">Unit conversion</th>
              <th className="px-3 py-2 font-semibold">Example value</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map(mapping => (
              <tr key={mapping.source} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{mapping.source}</td>
                <td className="px-3 py-2">
                  <Select value={mapping.target} onValueChange={value => updateMapping(mapping.source, { target: value as ImportFieldKey | 'ignore' })}>
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Ignore column</SelectItem>
                      {IMPORT_FIELDS.map(field => <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select value={mapping.conversion} onValueChange={value => updateMapping(mapping.source, { conversion: value as ImportConversion })}>
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONVERSIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs text-slate-600">
                  {sourceRows[0]?.[mapping.source] || 'Empty'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validation.errors.map(error => (
        <Alert key={error} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ))}
      {validation.warnings.map(warning => (
        <Alert key={warning} className="border-amber-200 bg-amber-50 text-amber-900"><AlertDescription>{warning}</AlertDescription></Alert>
      ))}

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex w-full max-w-xl gap-2">
          <Input value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Format name, e.g. Agilent GC-MS export" />
          <Button variant="outline" onClick={saveCurrentPreset} disabled={!userId || !presetName.trim() || !!validation.errors.length || savePreset.isPending}>
            <Save className="size-4" />Save format
          </Button>
          {presets.some(item => item.name === presetName) && (
            <Button
              variant="ghost"
              size="icon"
              title="Delete saved format"
              onClick={async () => {
                const preset = presets.find(item => item.name === presetName);
                try {
                  if (preset) await deletePreset.mutateAsync(preset.id);
                  setPresetName('');
                  setMessage('Saved format deleted.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Unable to delete this import format.');
                }
              }}
            >
              <Trash2 className="size-4 text-rose-600" />
            </Button>
          )}
        </div>
        <Button onClick={onApply} disabled={!!validation.errors.length}>
          <WandSparkles className="size-4" />Apply mapping
        </Button>
      </div>
      {message && <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" />{message}</p>}
    </section>
  );
}
