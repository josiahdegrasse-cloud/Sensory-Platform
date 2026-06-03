import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Trash2, Sparkles, RefreshCw, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import type { ConceptDraft } from './types';

export function ImagesStep({ draft, onChange }: { draft: ConceptDraft; onChange: (d: ConceptDraft) => void }) {
  const [aiCandidates, setAiCandidates] = useState<{ url: string; selected: boolean; loading: boolean; failed: boolean }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [hfToken, setHfToken] = useState(() => sessionStorage.getItem('hf_token') ?? '');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  const saveToken = () => {
    const t = tokenInput.trim();
    if (!t.startsWith('hf_')) { setTokenError('Token should start with hf_'); return; }
    sessionStorage.setItem('hf_token', t);
    setHfToken(t);
    setTokenInput('');
    setTokenError('');
  };

  const generateOne = async (prompt: string, token: string): Promise<string> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt }),
      });
      if (res.status === 503) { await new Promise(r => setTimeout(r, 20000)); continue; }
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      // Convert to data URL so it persists through to the database
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    throw new Error('Model unavailable after retries');
  };

  const handleGenerate = async () => {
    if (!hfToken) return;
    const prompt = [
      draft.name ? `${draft.name} product packaging design` : 'product packaging design',
      draft.category,
      draft.description?.slice(0, 120),
      draft.keyBenefits?.slice(0, 80),
      'professional product mockup, clean white background, commercial photography, high quality',
    ].filter(Boolean).join(', ');

    setGenerating(true);
    setAiCandidates([
      { url: '', selected: true, loading: true, failed: false },
      { url: '', selected: true, loading: true, failed: false },
      { url: '', selected: true, loading: true, failed: false },
    ]);

    for (let i = 0; i < 3; i++) {
      try {
        const url = await generateOne(prompt, hfToken);
        setAiCandidates(prev => prev.map((x, j) => j === i ? { ...x, url, loading: false } : x));
      } catch {
        setAiCandidates(prev => prev.map((x, j) => j === i ? { ...x, loading: false, failed: true } : x));
      }
    }
    setGenerating(false);
  };

  const isValidImageUrl = (u: string) =>
    u.startsWith('data:image/') || ((): boolean => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })();

  const addSelected = () => {
    const toAdd = aiCandidates.filter(c => c.selected && c.url).map(c => c.url);
    onChange({ ...draft, marketingImages: [...draft.marketingImages.filter(u => u.trim()), ...toAdd] });
    setAiCandidates([]);
  };

  const removeImage = (i: number) =>
    onChange({ ...draft, marketingImages: draft.marketingImages.filter((_, j) => j !== i) });

  const validImages = draft.marketingImages.filter(u => u.trim() && isValidImageUrl(u));
  const canGenerate = !!(draft.name || draft.category || draft.description);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Generate packaging images</h2>
        <p className="text-slate-500 text-sm mt-1">
          Create AI-generated marketing visuals for your concept. Panelists will view and rate these during the survey.
        </p>
      </div>

      {/* Token setup */}
      {!hfToken ? (
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardContent className="pt-5 pb-5 space-y-3">
            <div>
              <p className="font-semibold text-amber-900">Connect Hugging Face (free)</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Go to <strong>huggingface.co/settings/tokens</strong>, create a token with Read access, and paste it below.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={tokenInput}
                onChange={e => { setTokenInput(e.target.value); setTokenError(''); }}
                onKeyDown={e => e.key === 'Enter' && saveToken()}
                placeholder="hf_…"
                className="flex-1 font-mono text-sm bg-white"
              />
              <Button type="button" onClick={saveToken} disabled={!tokenInput.trim()} className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0">
                Save
              </Button>
            </div>
            {tokenError && <p className="text-xs text-rose-600">{tokenError}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
          <span className="text-slate-600">Hugging Face connected · FLUX.1-schnell</span>
          <button
            type="button"
            onClick={() => { sessionStorage.removeItem('hf_token'); setHfToken(''); }}
            className="text-slate-400 hover:text-rose-500 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Generator panel */}
      <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-violet-900">AI Packaging Generator</p>
            <p className="text-xs text-violet-500 mt-0.5">Generates 3 variations one at a time · ~20–40 seconds each</p>
          </div>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!hfToken || generating || !canGenerate}
            className="bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
          >
            {generating
              ? <><RefreshCw className="size-4 mr-2 animate-spin" />Generating…</>
              : aiCandidates.length > 0
                ? <><RefreshCw className="size-4 mr-2" />Regenerate</>
                : <><Sparkles className="size-4 mr-2" />Generate images</>}
          </Button>
        </div>

        {!canGenerate && (
          <p className="text-xs text-violet-400 italic">Fill in your concept details on the previous step to enable generation.</p>
        )}

        {aiCandidates.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {aiCandidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => !c.loading && !c.failed && setAiCandidates(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    c.loading || c.failed ? 'border-slate-200 cursor-default'
                      : c.selected ? 'border-violet-500 shadow-lg' : 'border-slate-200 opacity-50'
                  }`}
                >
                  {c.loading && (
                    <div className="w-full h-48 bg-violet-100 animate-pulse flex flex-col items-center justify-center gap-2">
                      <Sparkles className="size-5 text-violet-300" />
                      <span className="text-xs text-violet-400 font-medium">Generating…</span>
                    </div>
                  )}
                  {c.failed && (
                    <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                      <span className="text-xs text-slate-400">Failed — try regenerating</span>
                    </div>
                  )}
                  {c.url && <img src={c.url} alt={`AI variation ${i + 1}`} className="w-full h-48 object-cover" />}
                  {!c.loading && !c.failed && c.url && (
                    <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-sm ${
                      c.selected ? 'bg-violet-600 border-violet-600' : 'bg-white/90 border-slate-300'
                    }`}>
                      {c.selected && <CheckCircle2 className="size-3.5 text-white" />}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white text-xs py-2 px-3 font-semibold">
                    Variation {i + 1}
                  </div>
                </button>
              ))}
            </div>
            {!generating && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-violet-500">Click a variation to select or deselect</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAiCandidates([])} className="text-slate-600 text-xs">
                    Discard
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addSelected}
                    disabled={!aiCandidates.some(c => c.selected && c.url)}
                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs"
                  >
                    Add {aiCandidates.filter(c => c.selected && c.url).length} to concept
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Added images */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium flex items-center gap-1.5">
            <ImageIcon className="size-3.5" /> Added images
            {validImages.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({validImages.length} · panelists will see these)</span>
            )}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...draft, marketingImages: [...draft.marketingImages, ''] })}
            className="text-slate-600 text-xs h-7"
          >
            <Plus className="size-3 mr-1" /> Add URL manually
          </Button>
        </div>

        {draft.marketingImages.map((url, i) => (
          url.startsWith('data:') ? (
            <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
              <img src={url} alt="" className="w-12 h-12 object-cover rounded flex-shrink-0" />
              <span className="text-xs text-slate-500 flex-1">AI-generated image {i + 1}</span>
              <button type="button" onClick={() => removeImage(i)} className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <div key={i} className="space-y-1">
              <div className="flex gap-2 items-center">
                <Input
                  value={url}
                  onChange={(e) => {
                    const next = [...draft.marketingImages];
                    next[i] = e.target.value;
                    onChange({ ...draft, marketingImages: next });
                  }}
                  placeholder="https://… (paste a URL)"
                  className="flex-1 text-xs"
                />
                <button type="button" onClick={() => removeImage(i)} className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {url.trim() && !isValidImageUrl(url) && (
                <p className="text-xs text-rose-500 pl-1">URL must start with https://</p>
              )}
            </div>
          )
        ))}

        {validImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {validImages.map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm group relative">
                <img src={url} alt={`Marketing concept ${i + 1}`} className="w-full h-36 object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(draft.marketingImages.indexOf(url))}
                  className="absolute top-2 right-2 bg-white/90 hover:bg-rose-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                >
                  <Trash2 className="size-3" />
                </button>
                <div className="px-2 py-1.5 bg-slate-50 text-[11px] text-slate-500 text-center font-medium">Image {i + 1}</div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed border-slate-200">
            <CardContent className="py-10 text-center">
              <ImageIcon className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No images added yet</p>
              <p className="text-slate-300 text-xs mt-1">Generate some above or paste a URL manually</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
