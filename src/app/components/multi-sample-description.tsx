import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../contexts/auth-context';
import { type Product } from '../data/mock-users';
import { fetchProduct } from '../lib/database';
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Layers, Target, Trophy, Lock } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

export function MultiSampleDescription() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!productId) return;
    fetchProduct(productId).then(p => { setProduct(p); setLoading(false); }).catch(() => setLoading(false));
  }, [productId]);

  if (loading) return <div className="max-w-4xl mx-auto p-8 text-slate-500">Loading…</div>;

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>Product not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!product.isMultiSample || !product.samples) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>This is not a multi-sample survey</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="size-6 text-purple-600" />
            <CardTitle className="text-2xl">Multi-Sample Evaluation</CardTitle>
          </div>
          <div className="space-y-1 text-sm text-slate-600">
            <p><strong>Study:</strong> {product.name}</p>
            <p><strong>Category:</strong> {product.category}</p>
            <p><strong>Your Panelist ID:</strong> {user?.panelistId}</p>
            <p><strong>Number of Samples:</strong> {product.samples.length}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Samples Information */}
      <Card className="border-2 border-purple-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-6 text-purple-600" />
            Samples You'll Evaluate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-slate-700 mb-4">
            You will taste and evaluate <strong>{product.samples.length} different samples</strong> in this session.
            Each sample is identified by a unique 3-digit code.
          </p>
          <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <p className="text-sm text-blue-900 font-medium mb-3 flex items-center gap-1.5"><Lock className="size-3.5" />Blind Evaluation</p>
            <p className="text-sm text-slate-700">
              Sample identities are concealed to ensure unbiased evaluation. You will only see sample codes during the test.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {product.samples.map((sample, idx) => (
              <div key={sample.id} className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-lg border-2 border-purple-300">
                <div className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  {sample.code}
                </div>
                <div className="text-xs text-slate-600 font-medium">Sample {idx + 1}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Process Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Process</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-700">
            This multi-sample evaluation consists of <strong>5 main steps</strong>:
          </p>

          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">1-{product.samples.length}</div>
              <div>
                <h4 className="font-bold text-slate-900">Sequential Sample Evaluation</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Evaluate each sample individually using the same questionnaire:
                </p>
                <ul className="text-sm text-slate-600 mt-2 ml-4 list-disc space-y-1">
                  <li>Flavor & Aroma Attributes (CATA)</li>
                  <li>Intensity Ratings</li>
                  <li>Hedonic Scores (Overall Liking)</li>
                  <li>Emotional Response</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold flex-shrink-0">{product.samples.length + 1}</div>
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  Discrimination Test
                  <Target className="size-4 text-amber-600" />
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Identify which sample is different from the others based on taste, texture, aroma, and appearance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold flex-shrink-0">{product.samples.length + 2}</div>
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  Preference Ranking
                  <Trophy className="size-4 text-purple-600" />
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Rank all {product.samples.length} samples from <strong>best to worst</strong> based on your overall preference.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Information */}
      <Card className="border-2 border-amber-300 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="size-5 text-amber-600" />
            Before You Begin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Estimated Time:</strong> {15 + (product.samples.length - 3) * 5}-{20 + (product.samples.length - 3) * 5} minutes
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Evaluate samples in order</strong> - complete each sample before moving to the next
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Hover over any attribute</strong> for its definition if you're unsure
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              <strong>Cannot edit after submission</strong> - please review carefully before final submit
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/panelist')}
          className="flex-1"
        >
          Back to Dashboard
        </Button>
        <Button
          onClick={() => navigate(`/multi-sample/${productId}`)}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
        >
          <Layers className="size-4 mr-2" />
          Begin Multi-Sample Evaluation
        </Button>
      </div>
    </div>
  );
}
